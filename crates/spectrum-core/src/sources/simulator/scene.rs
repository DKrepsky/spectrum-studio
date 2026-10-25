//! The simulated RF scene: emitter parameters and sample synthesis.

use std::f64::consts::TAU;

use rustfft::num_complex::{Complex32, Complex64};

use super::rng::Rng;
use crate::model::{ParamMap, ParamMapExt, ParamSpec};

const MAX_HZ: f64 = 6e9;

fn freq(id: &str, group: &str, default: f64) -> ParamSpec {
    ParamSpec::number(id, "Frequency", 0.0, MAX_HZ, 1_000.0, default)
        .with_unit("Hz")
        .in_group(group)
}

fn level(id: &str, group: &str, default: f64) -> ParamSpec {
    ParamSpec::number(id, "Level", -140.0, 0.0, 1.0, default)
        .with_unit("dBFS")
        .in_group(group)
}

fn enabled(id: &str, group: &str, default: bool) -> ParamSpec {
    ParamSpec::boolean(id, "Enabled", default).in_group(group)
}

pub fn param_specs() -> Vec<ParamSpec> {
    vec![
        ParamSpec::number("noiseDbfs", "Noise power", -150.0, 0.0, 1.0, -50.0)
            .with_unit("dBFS")
            .in_group("Noise")
            .with_help("Total complex white-noise power across the sampled bandwidth."),
        enabled("tone1Enabled", "Tone 1", true),
        freq("tone1Hz", "Tone 1", 100.25e6),
        level("tone1Dbfs", "Tone 1", -20.0),
        enabled("tone2Enabled", "Tone 2", true),
        freq("tone2Hz", "Tone 2", 99.6e6),
        level("tone2Dbfs", "Tone 2", -42.0),
        enabled("tone3Enabled", "Tone 3", false),
        freq("tone3Hz", "Tone 3", 100.7e6),
        level("tone3Dbfs", "Tone 3", -60.0),
        enabled("driftEnabled", "Drifting carrier", true),
        freq("driftHz", "Drifting carrier", 99.85e6),
        ParamSpec::number("driftDevHz", "Deviation", 0.0, 5e6, 1_000.0, 40e3)
            .with_unit("Hz")
            .in_group("Drifting carrier"),
        ParamSpec::number("driftPeriodS", "Period", 0.1, 600.0, 0.1, 8.0)
            .with_unit("s")
            .in_group("Drifting carrier"),
        level("driftDbfs", "Drifting carrier", -48.0),
        enabled("burstEnabled", "Bursts", true),
        freq("burstHz", "Bursts", 100.45e6),
        ParamSpec::number("burstPeriodS", "Period", 0.1, 60.0, 0.1, 1.5)
            .with_unit("s")
            .in_group("Bursts"),
        ParamSpec::number("burstDuty", "Duty cycle", 0.01, 1.0, 0.01, 0.3).in_group("Bursts"),
        level("burstDbfs", "Bursts", -35.0),
        enabled("fmEnabled", "FM carrier", true),
        freq("fmHz", "FM carrier", 99.35e6),
        ParamSpec::number("fmDevHz", "Deviation", 0.0, 500e3, 100.0, 4e3)
            .with_unit("Hz")
            .in_group("FM carrier"),
        ParamSpec::number("fmRateHz", "Modulation rate", 1.0, 100e3, 1.0, 1e3)
            .with_unit("Hz")
            .in_group("FM carrier"),
        level("fmDbfs", "FM carrier", -38.0),
        enabled("sweepEnabled", "Sweep", false),
        ParamSpec::number("sweepPeriodS", "Period", 0.2, 600.0, 0.1, 6.0)
            .with_unit("s")
            .in_group("Sweep")
            .with_help("Time to sweep across 90 % of the current span."),
        level("sweepDbfs", "Sweep", -45.0),
        ParamSpec::number("seed", "Random seed", 0.0, 4_294_967_295.0, 1.0, 1.0)
            .in_group("Testing")
            .with_help("Same seed and settings always produce the same samples."),
        ParamSpec::number(
            "faultAfterS",
            "Simulate device loss after",
            0.0,
            3600.0,
            1.0,
            0.0,
        )
        .with_unit("s")
        .in_group("Testing")
        .with_help("0 disables. Makes acquisition fail as if the device was unplugged."),
    ]
}

#[derive(Debug, Clone, Copy)]
struct Emitter {
    hz: f64,
    amplitude: f64,
}

#[derive(Debug, Clone)]
pub struct Scene {
    noise_sigma: f64,
    tones: Vec<Emitter>,
    drift: Option<(Emitter, f64, f64)>,
    burst: Option<(Emitter, f64, f64)>,
    fm: Option<(Emitter, f64, f64)>,
    sweep: Option<(f64, f64)>,
    pub seed: u64,
    pub fault_after_s: f64,
}

fn amplitude(dbfs: f64) -> f64 {
    10f64.powf(dbfs / 20.0)
}

impl Scene {
    /// Builds the scene from a parameter map already resolved against [`param_specs`].
    pub fn from_params(p: &ParamMap) -> Self {
        let num = |id: &str| p.number(id).unwrap_or(0.0);
        let on = |id: &str| p.flag(id).unwrap_or(false);
        let emitter = |prefix: &str| Emitter {
            hz: num(&format!("{prefix}Hz")),
            amplitude: amplitude(num(&format!("{prefix}Dbfs"))),
        };
        let tones = ["tone1", "tone2", "tone3"]
            .iter()
            .filter(|t| on(&format!("{t}Enabled")))
            .map(|t| emitter(t))
            .collect();
        Self {
            noise_sigma: amplitude(num("noiseDbfs")),
            tones,
            drift: on("driftEnabled")
                .then(|| (emitter("drift"), num("driftDevHz"), num("driftPeriodS"))),
            burst: on("burstEnabled")
                .then(|| (emitter("burst"), num("burstPeriodS"), num("burstDuty"))),
            fm: on("fmEnabled").then(|| (emitter("fm"), num("fmDevHz"), num("fmRateHz"))),
            sweep: on("sweepEnabled").then(|| (num("sweepPeriodS"), amplitude(num("sweepDbfs")))),
            seed: num("seed") as u64,
            fault_after_s: num("faultAfterS"),
        }
    }

    /// Renders `n` samples starting at simulated time `t0` as seen by a receiver tuned to
    /// `center_hz` sampling at `fs` complex samples per second.
    pub fn render(
        &self,
        rng: &mut Rng,
        t0: f64,
        n: usize,
        center_hz: f64,
        fs: f64,
    ) -> Vec<Complex32> {
        let nyquist = fs / 2.0;
        let visible = |offset: f64| offset.abs() < nyquist;
        // Phase as a fraction of a cycle, reduced to keep precision for large t.
        let rot = |cycles: f64| -> Complex64 {
            let (s, c) = (TAU * (cycles - cycles.floor())).sin_cos();
            Complex64::new(c, s)
        };
        let noise_component = self.noise_sigma / std::f64::consts::SQRT_2;
        let tones: Vec<(f64, f64)> = self
            .tones
            .iter()
            .map(|e| (e.hz - center_hz, e.amplitude))
            .filter(|(off, _)| visible(*off))
            .collect();

        (0..n)
            .map(|i| {
                let t = t0 + i as f64 / fs;
                let mut z = Complex64::default();
                for &(offset, a) in &tones {
                    z += rot(offset * t) * a;
                }
                if let Some((e, dev, period)) = self.drift {
                    // Instantaneous frequency offset + dev·sin(ωt); phase in cycles is its integral.
                    let w = TAU / period;
                    let offset = e.hz - center_hz;
                    if visible(offset + dev * (w * t).sin()) {
                        z += rot(offset * t - dev / w * (w * t).cos()) * e.amplitude;
                    }
                }
                if let Some((e, period, duty)) = self.burst {
                    let offset = e.hz - center_hz;
                    let phase = t / period;
                    if visible(offset) && phase - phase.floor() < duty {
                        z += rot(offset * t) * e.amplitude;
                    }
                }
                if let Some((e, dev, rate)) = self.fm {
                    let offset = e.hz - center_hz;
                    if visible(offset + dev * (TAU * rate * t).cos()) {
                        z += rot(offset * t + dev / (TAU * rate) * (TAU * rate * t).sin())
                            * e.amplitude;
                    }
                }
                if let Some((period, a)) = self.sweep {
                    // Linear chirp from -0.45 fs to +0.45 fs, restarting every period.
                    let tau = t - (t / period).floor() * period;
                    let k = 0.9 * fs / period;
                    z += rot(-0.45 * fs * tau + 0.5 * k * tau * tau) * a;
                }
                if noise_component > 0.0 {
                    let (a, b) = rng.gaussian_pair();
                    z += Complex64::new(a, b) * noise_component;
                }
                // ADC full scale: each component saturates at ±1.
                Complex32::new(z.re.clamp(-1.0, 1.0) as f32, z.im.clamp(-1.0, 1.0) as f32)
            })
            .collect()
    }
}
