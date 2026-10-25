//! Spectral analysis windows (periodic / DFT-even form).

use std::f64::consts::PI;

use crate::model::WindowKind;

#[derive(Debug, Clone)]
pub struct Window {
    pub kind: WindowKind,
    pub coeffs: Vec<f32>,
    /// Sum of the coefficients; normalises a bin-centred tone to its true amplitude.
    pub sum: f64,
    /// Equivalent noise bandwidth in bins: `N · Σw² / (Σw)²`.
    pub enbw_bins: f64,
    /// Scalloping loss in dB for tone offsets 0..=0.5 bin, in `SCALLOP_STEPS` steps.
    scallop_db: Vec<f64>,
}

const SCALLOP_STEPS: usize = 64;

impl Window {
    pub fn new(kind: WindowKind, len: usize) -> Self {
        let n = len as f64;
        let cosine_sum = |a: &[f64], i: usize| -> f64 {
            a.iter()
                .enumerate()
                .map(|(k, ak)| {
                    let sign = if k % 2 == 0 { 1.0 } else { -1.0 };
                    sign * ak * (2.0 * PI * k as f64 * i as f64 / n).cos()
                })
                .sum()
        };
        let coeffs: Vec<f64> = (0..len)
            .map(|i| match kind {
                WindowKind::Rectangular => 1.0,
                WindowKind::Hann => cosine_sum(&[0.5, 0.5], i),
                WindowKind::BlackmanHarris => {
                    cosine_sum(&[0.358_75, 0.488_29, 0.141_28, 0.011_68], i)
                }
                // Matlab/SciPy flat-top: < 0.01 dB scalloping loss, for amplitude accuracy.
                WindowKind::FlatTop => cosine_sum(
                    &[
                        0.215_578_95,
                        0.416_631_58,
                        0.277_263_158,
                        0.083_578_947,
                        0.006_947_368,
                    ],
                    i,
                ),
            })
            .collect();
        let sum: f64 = coeffs.iter().sum();
        let sum_sq: f64 = coeffs.iter().map(|w| w * w).sum();
        // Window response |W(δ)| / W(0) for a tone δ bins away from a bin centre (exact DTFT).
        let scallop_db = (0..=SCALLOP_STEPS)
            .map(|i| {
                let delta = 0.5 * i as f64 / SCALLOP_STEPS as f64;
                // Σ w[k]·e^{j2πδk/N}, with the phasor advanced by rotation (no per-term sin/cos).
                let (step_sin, step_cos) = (2.0 * PI * delta / n).sin_cos();
                let (mut c, mut s) = (1.0f64, 0.0f64);
                let (mut re, mut im) = (0.0, 0.0);
                for w in &coeffs {
                    re += w * c;
                    im += w * s;
                    (c, s) = (c * step_cos - s * step_sin, s * step_cos + c * step_sin);
                }
                -20.0 * ((re * re + im * im).sqrt() / sum).log10()
            })
            .collect();
        Self {
            kind,
            coeffs: coeffs.iter().map(|&w| w as f32).collect(),
            sum,
            enbw_bins: n * sum_sq / (sum * sum),
            scallop_db,
        }
    }

    /// Loss in dB (≥ 0) of a tone `delta` bins (|delta| ≤ 0.5) from the nearest bin centre.
    pub fn scallop_loss_db(&self, delta: f64) -> f64 {
        let x = (delta.abs().min(0.5) / 0.5) * SCALLOP_STEPS as f64;
        let i = (x.floor() as usize).min(SCALLOP_STEPS - 1);
        let t = x - i as f64;
        self.scallop_db[i] * (1.0 - t) + self.scallop_db[i + 1] * t
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_enbw_values() {
        let cases = [
            (WindowKind::Rectangular, 1.0),
            (WindowKind::Hann, 1.5),
            (WindowKind::BlackmanHarris, 2.0044),
            (WindowKind::FlatTop, 3.7702),
        ];
        for (kind, enbw) in cases {
            let w = Window::new(kind, 4096);
            assert!(
                (w.enbw_bins - enbw).abs() < 1e-3,
                "{kind:?}: {}",
                w.enbw_bins
            );
        }
    }

    #[test]
    fn known_scalloping_losses() {
        // Classic worst-case (half-bin) scalloping losses.
        let cases = [
            (WindowKind::Rectangular, 3.92),
            (WindowKind::Hann, 1.42),
            (WindowKind::BlackmanHarris, 0.83),
            (WindowKind::FlatTop, 0.0),
        ];
        for (kind, loss) in cases {
            let w = Window::new(kind, 1024);
            assert!(w.scallop_loss_db(0.0).abs() < 1e-9);
            assert!(
                (w.scallop_loss_db(0.5) - loss).abs() < 0.02,
                "{kind:?}: {}",
                w.scallop_loss_db(0.5)
            );
        }
    }

    #[test]
    fn hann_is_periodic_and_peaks_in_the_middle() {
        let w = Window::new(WindowKind::Hann, 8);
        assert!(w.coeffs[0].abs() < 1e-7);
        assert!((w.coeffs[4] - 1.0).abs() < 1e-7);
        assert!((w.coeffs[1] - w.coeffs[7]).abs() < 1e-7);
        assert!((w.sum - 4.0).abs() < 1e-9);
    }
}
