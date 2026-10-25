//! Peak search on a dB trace using topographic prominence and parabolic interpolation.

use super::window::Window;
use crate::model::{Peak, PeakSettings, WindowKind};

/// Robust noise-floor estimate: the median of the trace (valid while signals occupy less than
/// half of the bins). Returns `None` for an empty trace.
pub fn noise_floor(trace: &[f32]) -> Option<f32> {
    if trace.is_empty() {
        return None;
    }
    let mut values = trace.to_vec();
    let mid = values.len() / 2;
    let (_, median, _) = values.select_nth_unstable_by(mid, f32::total_cmp);
    Some(*median)
}

/// Finds peaks in `trace` (dB values on a uniform frequency grid).
///
/// A peak is a local maximum at least `min_excess_db` above `floor` (see [`noise_floor`]), at
/// or above the optional absolute threshold, and whose prominence — height above the higher of the two lowest
/// points separating it from a higher sample (or the trace edge) — is at least
/// `min_prominence_db`. Frequency and amplitude are refined by fitting a parabola through the
/// peak bin and its neighbours. For FFT spectra pass the `window`: the amplitude is then
/// corrected with the window's exact scalloping loss at the interpolated offset, which is more
/// accurate than the parabola's height. Results are sorted by amplitude, strongest first.
pub fn find_peaks(
    trace: &[f32],
    start_hz: f64,
    bin_hz: f64,
    floor: f32,
    settings: &PeakSettings,
    window: Option<&Window>,
) -> Vec<Peak> {
    if !settings.enabled || settings.max_count == 0 || trace.len() < 3 {
        return Vec::new();
    }
    let min_level = (f64::from(floor) + settings.min_excess_db)
        .max(settings.threshold.unwrap_or(f64::NEG_INFINITY));
    let mut peaks = Vec::new();
    let n = trace.len();
    let mut i = 1;
    while i < n - 1 {
        let v = trace[i];
        if v > trace[i - 1] {
            // Walk across a plateau of equal values.
            let mut j = i;
            while j + 1 < n && trace[j + 1] == v {
                j += 1;
            }
            if j + 1 < n && trace[j + 1] < v {
                let bin = (i + j) / 2;
                let prominence = prominence(trace, bin);
                if prominence >= settings.min_prominence_db && f64::from(v) >= min_level {
                    peaks.push(interpolate(
                        trace, bin, start_hz, bin_hz, prominence, window,
                    ));
                }
            }
            i = j + 1;
        } else {
            i += 1;
        }
    }
    peaks.sort_by(|a, b| b.amplitude.total_cmp(&a.amplitude));
    peaks.truncate(settings.max_count as usize);
    peaks
}

fn prominence(trace: &[f32], bin: usize) -> f64 {
    let v = trace[bin];
    let mut left_min = v;
    for &x in trace[..bin].iter().rev() {
        if x > v {
            break;
        }
        left_min = left_min.min(x);
    }
    let mut right_min = v;
    for &x in &trace[bin + 1..] {
        if x > v {
            break;
        }
        right_min = right_min.min(x);
    }
    f64::from(v - left_min.max(right_min))
}

fn interpolate(
    trace: &[f32],
    bin: usize,
    start_hz: f64,
    bin_hz: f64,
    prominence: f64,
    window: Option<&Window>,
) -> Peak {
    let beta = f64::from(trace[bin]);
    let (mut offset, mut amplitude) = (0.0, beta);
    if bin > 0 && bin + 1 < trace.len() {
        let alpha = f64::from(trace[bin - 1]);
        let gamma = f64::from(trace[bin + 1]);
        match window {
            Some(w) => {
                offset = window_offset(w.kind, alpha, beta, gamma);
                amplitude = beta + w.scallop_loss_db(offset);
            }
            None => {
                let denom = alpha - 2.0 * beta + gamma;
                if denom < 0.0 {
                    offset = (0.5 * (alpha - gamma) / denom).clamp(-0.5, 0.5);
                    amplitude = beta - 0.25 * (alpha - gamma) * offset;
                }
            }
        }
    }
    Peak {
        frequency_hz: start_hz + (bin as f64 + offset) * bin_hz,
        amplitude,
        bin: bin as u32,
        prominence_db: prominence,
    }
}

/// Fractional bin offset of a tone from the peak bin, given the power levels (dB) of the peak
/// bin `beta` and its neighbours. Uses the exact magnitude-ratio estimators for rectangular and
/// Hann windows and a parabola on the dB values otherwise.
fn window_offset(kind: WindowKind, alpha: f64, beta: f64, gamma: f64) -> f64 {
    let (neighbour, sign) = if gamma >= alpha {
        (gamma, 1.0)
    } else {
        (alpha, -1.0)
    };
    // Magnitude ratio of the larger neighbour to the peak bin (≤ 1).
    let r = 10f64.powf((neighbour - beta) / 20.0).min(1.0);
    let offset = match kind {
        WindowKind::Rectangular => r / (1.0 + r),
        WindowKind::Hann => (2.0 * r - 1.0) / (r + 1.0),
        WindowKind::BlackmanHarris | WindowKind::FlatTop => {
            let denom = alpha - 2.0 * beta + gamma;
            return if denom < 0.0 {
                (0.5 * (alpha - gamma) / denom).clamp(-0.5, 0.5)
            } else {
                0.0
            };
        }
    };
    sign * offset.clamp(0.0, 0.5)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dsp::SpectrumEstimator;
    use rustfft::num_complex::Complex32;

    fn settings(min_prominence_db: f64) -> PeakSettings {
        PeakSettings {
            enabled: true,
            max_count: 10,
            min_prominence_db,
            min_excess_db: 0.0,
            threshold: None,
        }
    }

    fn peaks(trace: &[f32], s: &PeakSettings) -> Vec<Peak> {
        find_peaks(trace, 0.0, 1.0, f32::MIN, s, None)
    }

    #[test]
    fn finds_peaks_sorted_by_amplitude() {
        let trace = [-90.0, -50.0, -90.0, -90.0, -30.0, -90.0, -60.0, -61.0];
        let found = peaks(&trace, &settings(10.0));
        let bins: Vec<u32> = found.iter().map(|p| p.bin).collect();
        assert_eq!(bins, vec![4, 1]);
        // bin 6 is a local max but only 1 dB prominent.
        assert!((found[0].prominence_db - 60.0).abs() < 1e-9);
    }

    #[test]
    fn prominence_is_relative_to_the_higher_saddle() {
        // Small bump on the flank of a big peak: prominence = -40 - (-45) = 5 dB.
        let trace = [-100.0, -45.0, -40.0, -45.0, -10.0, -100.0];
        let found = peaks(&trace, &settings(0.0));
        let bump = found.iter().find(|p| p.bin == 2).unwrap();
        assert!((bump.prominence_db - 5.0).abs() < 1e-9);
    }

    #[test]
    fn respects_threshold_count_and_disable() {
        let trace = [-90.0, -50.0, -90.0, -30.0, -90.0, -40.0, -90.0];
        let mut s = settings(3.0);
        s.threshold = Some(-45.0);
        assert_eq!(peaks(&trace, &s).len(), 2);
        s.max_count = 1;
        assert_eq!(peaks(&trace, &s)[0].bin, 3);
        s.enabled = false;
        assert!(peaks(&trace, &s).is_empty());
    }

    #[test]
    fn level_above_noise_floor_rejects_noise_spikes() {
        let mut trace = vec![-100.0f32; 101];
        trace[10] = -92.0; // noise spike, 8 dB above floor
        trace[50] = -40.0;
        let mut s = settings(3.0);
        s.min_excess_db = 15.0;
        let floor = noise_floor(&trace).unwrap();
        assert_eq!(floor, -100.0);
        let found = find_peaks(&trace, 0.0, 1.0, floor, &s, None);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].bin, 50);
    }

    #[test]
    fn plateau_reports_its_centre() {
        let trace = [-90.0, -20.0, -20.0, -20.0, -90.0];
        let found = peaks(&trace, &settings(10.0));
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].bin, 2);
    }

    fn off_bin_tone(n: usize, offset_bins: f64, amplitude: f64) -> Vec<Complex32> {
        // Real signals always carry noise; without it the f32 round-off floor is spiky.
        let mut rng = crate::sources::simulator::rng::Rng::new(3);
        let noise_sigma = 1e-5; // -100 dBFS total
        (0..n)
            .map(|i| {
                let ph = 2.0 * std::f64::consts::PI * offset_bins * i as f64 / n as f64;
                let (a, b) = rng.gaussian_pair();
                Complex32::new(
                    (amplitude * ph.cos() + a * noise_sigma) as f32,
                    (amplitude * ph.sin() + b * noise_sigma) as f32,
                )
            })
            .collect()
    }

    #[test]
    fn windowed_peaks_recover_frequency_and_amplitude_between_bins() {
        let n = 4096;
        let fs = 2_048_000.0;
        let bin_hz = fs / n as f64;
        let mut s = settings(6.0);
        s.min_excess_db = 15.0;
        // (window, max frequency error in bins, max amplitude error in dB)
        let cases = [
            (WindowKind::Hann, 0.02, 0.05),
            (WindowKind::Rectangular, 0.02, 0.05),
            (WindowKind::BlackmanHarris, 0.05, 0.1),
            // Flat main lobe: amplitude-accurate by design, frequency only approximate.
            (WindowKind::FlatTop, 0.2, 0.05),
        ];
        for (window, max_bin_error, max_db_error) in cases {
            for frac in [0.0, 0.2, 0.4, 0.5] {
                let offset_bins = 123.0 + frac;
                let mut est = SpectrumEstimator::new(n, window);
                let mut trace = Vec::new();
                est.compute(&off_bin_tone(n, offset_bins, 0.1), &mut trace);
                let floor = noise_floor(&trace).unwrap();
                let peaks = find_peaks(&trace, -fs / 2.0, bin_hz, floor, &s, Some(est.window()));
                let p = &peaks[0];
                let true_hz = offset_bins * bin_hz;
                assert!(
                    (p.frequency_hz - true_hz).abs() < max_bin_error * bin_hz,
                    "{window:?} {frac}: {} vs {true_hz}",
                    p.frequency_hz
                );
                assert!(
                    (p.amplitude + 20.0).abs() < max_db_error,
                    "{window:?} {frac}: {}",
                    p.amplitude
                );
            }
        }
    }
}
