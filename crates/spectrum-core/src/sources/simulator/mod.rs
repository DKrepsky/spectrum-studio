//! Built-in signal simulator: a virtual tunable IQ receiver observing a fixed scene of emitters.
//!
//! Emitters have absolute RF frequencies; the receiver's centre frequency and sample rate decide
//! which are visible (an ideal anti-aliasing filter removes everything outside ±fs/2). Simulated
//! time advances by a fixed hop per block, so the output depends only on the seed and settings.

pub mod rng;
mod scene;

use rustfft::num_complex::Complex32;

use self::rng::Rng;
use self::scene::Scene;
use super::pacer::Pacer;
use super::{IqBlock, OpenedSource, Source, SourceData, SourceDriver, SourceError};
use crate::model::params::resolve_params;
use crate::model::{
    AmplitudeUnit, Capabilities, DataKind, DeviceDescriptor, DriverInfo, DriverStatus,
    FrequencyRange, ParamMap, ParamMapExt, ParamSpec, SettingsPatch, SourceConfig, SourceKind,
    SourceSettings, Transport,
};

pub const DRIVER_ID: &str = "simulator";
/// Blocks per second of simulated time (and of wall-clock time when paced).
pub const BLOCK_RATE_HZ: f64 = 30.0;
pub const DEFAULT_CENTER_HZ: f64 = 100e6;
pub const DEFAULT_SPAN_HZ: f64 = 2.048e6;
pub const SPAN_OPTIONS_HZ: [f64; 7] = [250e3, 1.024e6, 2.048e6, 2.4e6, 3.2e6, 5e6, 10e6];
const MAX_TUNING_HZ: f64 = 6e9;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pacing {
    /// Sleep so blocks are produced at `BLOCK_RATE_HZ` in wall-clock time.
    RealTime,
    /// Produce blocks as fast as they are read (tests, benchmarks).
    Unpaced,
}

pub struct SimulatorDriver {
    pacing: Pacing,
}

impl SimulatorDriver {
    pub fn new() -> Self {
        Self {
            pacing: Pacing::RealTime,
        }
    }

    pub fn unpaced() -> Self {
        Self {
            pacing: Pacing::Unpaced,
        }
    }
}

impl Default for SimulatorDriver {
    fn default() -> Self {
        Self::new()
    }
}

fn connection_params() -> Vec<ParamSpec> {
    vec![
        ParamSpec::boolean("failConnect", "Fail to connect", false)
            .in_group("Testing")
            .with_help("Makes the connection attempt fail, to exercise error handling."),
    ]
}

impl SourceDriver for SimulatorDriver {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: DRIVER_ID.into(),
            name: "Signal simulator".into(),
            description: "Built-in virtual receiver producing repeatable IQ test signals: tones, \
                          noise, drifting, bursting, FM and swept signals."
                .into(),
            kind: SourceKind::Simulator,
            transport: Transport::Internal,
            status: DriverStatus::Available,
            supports_discovery: true,
            connection_params: connection_params(),
        }
    }

    fn discover(&self) -> Result<Vec<DeviceDescriptor>, SourceError> {
        Ok(vec![DeviceDescriptor {
            driver_id: DRIVER_ID.into(),
            device_id: "sim0".into(),
            label: "Built-in simulator".into(),
            details: vec![
                ("Type".into(), "Virtual IQ receiver".into()),
                ("Tuning".into(), "0 Hz – 6 GHz".into()),
                ("Sample rates".into(), "250 kS/s – 10 MS/s".into()),
            ],
        }])
    }

    fn open(&self, config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        let connection = resolve_params(&connection_params(), &config.connection)
            .map_err(SourceError::InvalidSettings)?;
        if connection.flag("failConnect") == Some(true) {
            return Err(SourceError::Unavailable(
                "The simulator refused the connection because \"Fail to connect\" is enabled in \
                 its Testing options."
                    .into(),
            ));
        }
        Ok(OpenedSource {
            source: Box::new(SimulatorSource::new(self.pacing)),
            label: "Built-in simulator".into(),
            simulated: true,
        })
    }
}

pub struct SimulatorSource {
    caps: Capabilities,
    settings: SourceSettings,
    scene: Scene,
    rng: Rng,
    pacer: Pacer,
    /// Blocks generated since the source was opened; defines simulated time.
    block_index: u64,
    running: bool,
    started_at_block: u64,
    discontinuity: bool,
}

impl SimulatorSource {
    pub fn new(pacing: Pacing) -> Self {
        let params = scene::param_specs();
        let defaults = resolve_params(&params, &ParamMap::new()).unwrap_or_default();
        let scene = Scene::from_params(&defaults);
        Self {
            caps: Capabilities {
                data_kind: DataKind::Iq,
                tuning: Some(FrequencyRange {
                    min_hz: 0.0,
                    max_hz: MAX_TUNING_HZ,
                }),
                span_options_hz: SPAN_OPTIONS_HZ.to_vec(),
                amplitude_unit: AmplitudeUnit::Dbfs,
                finite: false,
                params,
            },
            rng: Rng::new(scene.seed),
            scene,
            settings: SourceSettings {
                center_hz: DEFAULT_CENTER_HZ,
                span_hz: DEFAULT_SPAN_HZ,
                params: defaults,
            },
            pacer: Pacer::new(BLOCK_RATE_HZ, pacing == Pacing::RealTime),
            block_index: 0,
            running: false,
            started_at_block: 0,
            discontinuity: true,
        }
    }
}

impl Source for SimulatorSource {
    fn capabilities(&self) -> &Capabilities {
        &self.caps
    }

    fn settings(&self) -> &SourceSettings {
        &self.settings
    }

    fn apply(&mut self, patch: &SettingsPatch) -> Result<(), SourceError> {
        let mut params = self.settings.params.clone();
        params.extend(patch.params.clone());
        let params =
            resolve_params(&self.caps.params, &params).map_err(SourceError::InvalidSettings)?;
        let scene = Scene::from_params(&params);
        if scene.seed != self.scene.seed {
            self.rng = Rng::new(scene.seed);
        }
        self.scene = scene;
        self.settings.params = params;
        if let Some(center) = patch.center_hz {
            self.settings.center_hz = center;
        }
        if let Some(span) = patch.span_hz {
            self.settings.span_hz = span;
        }
        self.discontinuity = true;
        Ok(())
    }

    fn start(&mut self) -> Result<(), SourceError> {
        self.running = true;
        self.started_at_block = self.block_index;
        self.pacer.reset();
        self.discontinuity = true;
        Ok(())
    }

    fn read(&mut self, samples_wanted: usize) -> Result<SourceData, SourceError> {
        if !self.running {
            return Err(SourceError::Io("The simulator is not running.".into()));
        }
        let elapsed_s = (self.block_index - self.started_at_block) as f64 / BLOCK_RATE_HZ;
        if self.scene.fault_after_s > 0.0 && elapsed_s >= self.scene.fault_after_s {
            self.running = false;
            return Err(SourceError::Disconnected(format!(
                "Simulated device loss after {} s (fault injection is enabled in the simulator's \
                 Testing settings).",
                self.scene.fault_after_s
            )));
        }
        self.pacer.wait(self.block_index);
        let t0 = self.block_index as f64 / BLOCK_RATE_HZ;
        let samples: Vec<Complex32> = self.scene.render(
            &mut self.rng,
            t0,
            samples_wanted.max(1),
            self.settings.center_hz,
            self.settings.span_hz,
        );
        self.block_index += 1;
        let discontinuity = std::mem::take(&mut self.discontinuity);
        Ok(SourceData::Iq(IqBlock {
            samples,
            sample_rate_hz: self.settings.span_hz,
            center_hz: self.settings.center_hz,
            discontinuity,
        }))
    }

    fn stop(&mut self) -> Result<(), SourceError> {
        self.running = false;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dsp::{SpectrumEstimator, find_peaks, noise_floor};
    use crate::model::{ParamValue, PeakSettings, WindowKind};

    fn read_iq(src: &mut SimulatorSource, n: usize) -> IqBlock {
        match src.read(n).unwrap() {
            SourceData::Iq(b) => b,
            other => panic!("unexpected {other:?}"),
        }
    }

    fn only(params: &[(&str, ParamValue)]) -> SettingsPatch {
        // Disable every emitter, then enable what the test needs.
        let mut map: ParamMap = [
            "tone1Enabled",
            "tone2Enabled",
            "tone3Enabled",
            "driftEnabled",
            "burstEnabled",
            "fmEnabled",
            "sweepEnabled",
        ]
        .iter()
        .map(|k| ((*k).to_string(), ParamValue::Bool(false)))
        .collect();
        for (k, v) in params {
            map.insert((*k).to_string(), v.clone());
        }
        SettingsPatch {
            params: map,
            ..Default::default()
        }
    }

    #[test]
    fn same_seed_gives_identical_samples() {
        let mut a = SimulatorSource::new(Pacing::Unpaced);
        let mut b = SimulatorSource::new(Pacing::Unpaced);
        a.start().unwrap();
        b.start().unwrap();
        for _ in 0..3 {
            assert_eq!(read_iq(&mut a, 1024).samples, read_iq(&mut b, 1024).samples);
        }
        let mut c = SimulatorSource::new(Pacing::Unpaced);
        c.apply(&SettingsPatch {
            params: [("seed".to_string(), ParamValue::Number(99.0))].into(),
            ..Default::default()
        })
        .unwrap();
        c.start().unwrap();
        let mut d = SimulatorSource::new(Pacing::Unpaced);
        d.start().unwrap();
        assert_ne!(read_iq(&mut c, 1024).samples, read_iq(&mut d, 1024).samples);
    }

    #[test]
    fn tone_appears_at_its_frequency_and_level() {
        let mut src = SimulatorSource::new(Pacing::Unpaced);
        src.apply(&only(&[
            ("tone1Enabled", ParamValue::Bool(true)),
            ("tone1Hz", ParamValue::Number(100.3e6)),
            ("tone1Dbfs", ParamValue::Number(-25.0)),
            ("noiseDbfs", ParamValue::Number(-90.0)),
        ]))
        .unwrap();
        src.start().unwrap();
        let n = 4096;
        let block = read_iq(&mut src, n);
        assert_eq!(block.samples.len(), n);
        assert!(block.discontinuity);
        let mut est = SpectrumEstimator::new(n, WindowKind::Hann);
        let mut trace = Vec::new();
        est.compute(&block.samples, &mut trace);
        let bin_hz = block.sample_rate_hz / n as f64;
        let start = block.center_hz - block.sample_rate_hz / 2.0;
        let floor = noise_floor(&trace).unwrap();
        let peaks = find_peaks(
            &trace,
            start,
            bin_hz,
            floor,
            &PeakSettings::default(),
            Some(est.window()),
        );
        assert_eq!(peaks.len(), 1, "{peaks:?}");
        assert!((peaks[0].frequency_hz - 100.3e6).abs() < 0.1 * bin_hz);
        assert!((peaks[0].amplitude + 25.0).abs() < 0.2);
    }

    #[test]
    fn tones_outside_the_span_are_filtered_and_retuning_reveals_them() {
        let mut src = SimulatorSource::new(Pacing::Unpaced);
        src.apply(&only(&[
            ("tone1Enabled", ParamValue::Bool(true)),
            ("tone1Hz", ParamValue::Number(105e6)),
            ("noiseDbfs", ParamValue::Number(-120.0)),
        ]))
        .unwrap();
        src.start().unwrap();
        let power = |b: &IqBlock| b.samples.iter().map(|s| s.norm_sqr()).sum::<f32>();
        assert!(power(&read_iq(&mut src, 1024)) < 1e-6);
        src.apply(&SettingsPatch {
            center_hz: Some(105.1e6),
            ..Default::default()
        })
        .unwrap();
        let block = read_iq(&mut src, 1024);
        assert!(block.discontinuity);
        assert!(power(&block) > 1.0);
    }

    #[test]
    fn fault_injection_reports_disconnection() {
        let mut src = SimulatorSource::new(Pacing::Unpaced);
        src.apply(&SettingsPatch {
            params: [("faultAfterS".to_string(), ParamValue::Number(0.1))].into(),
            ..Default::default()
        })
        .unwrap();
        src.start().unwrap();
        let mut ok_blocks = 0;
        let err = loop {
            match src.read(256) {
                Ok(_) => ok_blocks += 1,
                Err(e) => break e,
            }
        };
        assert_eq!(ok_blocks, 3);
        assert!(err.is_fatal());
    }

    #[test]
    fn connect_failure_option_is_honoured() {
        let mut config = SourceConfig::new(DRIVER_ID);
        config
            .connection
            .insert("failConnect".into(), ParamValue::Bool(true));
        let err = SimulatorDriver::unpaced().open(&config).err().unwrap();
        assert!(matches!(err, SourceError::Unavailable(_)));
        assert!(
            SimulatorDriver::unpaced()
                .open(&SourceConfig::new(DRIVER_ID))
                .is_ok()
        );
    }

    #[test]
    fn real_time_pacing_runs_near_block_rate() {
        let mut src = SimulatorSource::new(Pacing::RealTime);
        src.start().unwrap();
        let t = std::time::Instant::now();
        for _ in 0..7 {
            read_iq(&mut src, 256);
        }
        // 6 hops after the first block ≈ 200 ms.
        let elapsed = t.elapsed().as_secs_f64();
        assert!((0.17..0.6).contains(&elapsed), "{elapsed}");
    }
}
