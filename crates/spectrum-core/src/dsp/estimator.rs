//! IQ samples → power spectrum in dBFS.

use std::sync::Arc;

use rustfft::num_complex::Complex32;
use rustfft::{Fft, FftPlanner};

use super::window::Window;
use crate::model::WindowKind;
use crate::model::units::power_to_db;

/// Computes windowed, FFT-shifted power spectra normalised so that a complex sinusoid of
/// magnitude `A` centred on a bin reads `20·log10(A)` dBFS.
pub struct SpectrumEstimator {
    fft: Arc<dyn Fft<f32>>,
    window: Window,
    buffer: Vec<Complex32>,
    scratch: Vec<Complex32>,
}

impl SpectrumEstimator {
    pub fn new(fft_size: usize, window: WindowKind) -> Self {
        let fft = FftPlanner::new().plan_fft_forward(fft_size);
        let scratch = vec![Complex32::default(); fft.get_inplace_scratch_len()];
        Self {
            fft,
            window: Window::new(window, fft_size),
            buffer: vec![Complex32::default(); fft_size],
            scratch,
        }
    }

    pub fn fft_size(&self) -> usize {
        self.buffer.len()
    }

    pub fn window(&self) -> &Window {
        &self.window
    }

    /// Computes the spectrum of exactly `fft_size` samples into `out` (resized to `fft_size`).
    /// Bin 0 of the output is the most negative frequency (`-fs/2`), bin `N/2` is DC.
    pub fn compute(&mut self, samples: &[Complex32], out: &mut Vec<f32>) {
        let n = self.fft_size();
        assert_eq!(
            samples.len(),
            n,
            "estimator expects exactly fft_size samples"
        );
        for ((dst, &x), &w) in self.buffer.iter_mut().zip(samples).zip(&self.window.coeffs) {
            *dst = x * w;
        }
        self.fft
            .process_with_scratch(&mut self.buffer, &mut self.scratch);

        let norm = (1.0 / (self.window.sum * self.window.sum)) as f32;
        out.clear();
        out.extend(
            self.buffer[n / 2..]
                .iter()
                .chain(&self.buffer[..n / 2])
                .map(|x| power_to_db(x.norm_sqr() * norm)),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    fn tone(n: usize, cycles_per_sample: f64, amplitude: f64) -> Vec<Complex32> {
        (0..n)
            .map(|i| {
                let ph = 2.0 * PI * cycles_per_sample * i as f64;
                Complex32::new((amplitude * ph.cos()) as f32, (amplitude * ph.sin()) as f32)
            })
            .collect()
    }

    #[test]
    fn bin_centred_tone_reads_its_amplitude_in_dbfs() {
        let n = 1024;
        for window in [
            WindowKind::Rectangular,
            WindowKind::Hann,
            WindowKind::BlackmanHarris,
            WindowKind::FlatTop,
        ] {
            let mut est = SpectrumEstimator::new(n, window);
            let mut out = Vec::new();
            // +100 bins above DC, amplitude 0.1 → -20 dBFS
            est.compute(&tone(n, 100.0 / n as f64, 0.1), &mut out);
            let dc = n / 2;
            let (peak_bin, peak) = out
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.total_cmp(b.1))
                .unwrap();
            assert_eq!(peak_bin, dc + 100, "{window:?}");
            assert!((peak + 20.0).abs() < 0.01, "{window:?}: {peak}");
        }
    }

    #[test]
    fn negative_frequencies_land_below_dc() {
        let n = 256;
        let mut est = SpectrumEstimator::new(n, WindowKind::Hann);
        let mut out = Vec::new();
        est.compute(&tone(n, -32.0 / n as f64, 1.0), &mut out);
        let peak_bin = out
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .unwrap()
            .0;
        assert_eq!(peak_bin, n / 2 - 32);
        assert!(out[peak_bin].abs() < 0.01);
    }

    #[test]
    fn flat_top_is_amplitude_accurate_between_bins() {
        let n = 2048;
        let mut est = SpectrumEstimator::new(n, WindowKind::FlatTop);
        let mut out = Vec::new();
        est.compute(&tone(n, 300.5 / n as f64, 0.5), &mut out);
        let peak = out.iter().copied().fold(f32::MIN, f32::max);
        assert!((peak - 20.0 * 0.5f32.log10()).abs() < 0.02, "{peak}");
    }

    #[test]
    fn white_noise_level_matches_theory() {
        // Complex white noise of total power P spreads P/N per bin, scaled by the ENBW.
        let n = 4096;
        let total_power_db = -30.0f64;
        let sigma = (10f64.powf(total_power_db / 10.0) / 2.0).sqrt();
        let mut rng = crate::sources::simulator::rng::Rng::new(42);
        let mut est = SpectrumEstimator::new(n, WindowKind::Hann);
        let mut acc = vec![0f64; n];
        let mut out = Vec::new();
        let trials = 64;
        for _ in 0..trials {
            let samples: Vec<Complex32> = (0..n)
                .map(|_| {
                    let (a, b) = rng.gaussian_pair();
                    Complex32::new((a * sigma) as f32, (b * sigma) as f32)
                })
                .collect();
            est.compute(&samples, &mut out);
            for (a, v) in acc.iter_mut().zip(&out) {
                *a += 10f64.powf(*v as f64 / 10.0);
            }
        }
        let mean_power = acc.iter().sum::<f64>() / (n * trials) as f64;
        let measured_db = 10.0 * mean_power.log10();
        let expected = total_power_db - 10.0 * (n as f64).log10() + 10.0 * 1.5f64.log10();
        assert!(
            (measured_db - expected).abs() < 0.2,
            "{measured_db} vs {expected}"
        );
    }
}
