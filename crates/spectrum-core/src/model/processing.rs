use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub enum WindowKind {
    Rectangular,
    Hann,
    BlackmanHarris,
    FlatTop,
}

pub const MIN_FFT_SIZE: u32 = 256;
pub const MAX_FFT_SIZE: u32 = 32768;
pub const MAX_AVERAGING: u32 = 1000;
pub const MAX_PEAKS: u32 = 50;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct PeakSettings {
    pub enabled: bool,
    /// Maximum number of peaks reported, strongest first.
    pub max_count: u32,
    /// Minimum topographic prominence in dB for a local maximum to count as a peak.
    pub min_prominence_db: f64,
    /// Minimum height above the estimated noise floor (median of the trace) in dB.
    pub min_excess_db: f64,
    /// Optional absolute level a peak must reach, in the trace's unit.
    pub threshold: Option<f64>,
}

impl Default for PeakSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            max_count: 8,
            min_prominence_db: 6.0,
            min_excess_db: 15.0,
            threshold: None,
        }
    }
}

/// How spectra are computed and post-processed. Applies to every source.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct ProcessingSettings {
    /// FFT length for IQ sources (power of two, 256..=32768). Ignored for trace sources.
    pub fft_size: u32,
    pub window: WindowKind,
    /// Number of traces in the power average; 1 disables averaging.
    pub averaging: u32,
    pub max_hold: bool,
    pub min_hold: bool,
    pub peaks: PeakSettings,
}

impl Default for ProcessingSettings {
    fn default() -> Self {
        Self {
            fft_size: 4096,
            window: WindowKind::Hann,
            averaging: 1,
            max_hold: false,
            min_hold: false,
            peaks: PeakSettings::default(),
        }
    }
}

impl ProcessingSettings {
    pub fn validate(&self) -> Result<(), String> {
        if !self.fft_size.is_power_of_two()
            || !(MIN_FFT_SIZE..=MAX_FFT_SIZE).contains(&self.fft_size)
        {
            return Err(format!(
                "FFT size must be a power of two between {MIN_FFT_SIZE} and {MAX_FFT_SIZE}."
            ));
        }
        if !(1..=MAX_AVERAGING).contains(&self.averaging) {
            return Err(format!(
                "Averaging must be between 1 and {MAX_AVERAGING} traces."
            ));
        }
        let p = &self.peaks;
        if p.max_count > MAX_PEAKS {
            return Err(format!("At most {MAX_PEAKS} peaks can be tracked."));
        }
        if !p.min_prominence_db.is_finite() || !(0.0..=200.0).contains(&p.min_prominence_db) {
            return Err("Peak prominence must be between 0 and 200 dB.".into());
        }
        if !p.min_excess_db.is_finite() || !(0.0..=200.0).contains(&p.min_excess_db) {
            return Err("Peak level above noise floor must be between 0 and 200 dB.".into());
        }
        if p.threshold.is_some_and(|t| !t.is_finite()) {
            return Err("Peak threshold must be a finite number.".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_is_valid() {
        assert!(ProcessingSettings::default().validate().is_ok());
    }

    #[test]
    fn rejects_invalid_values() {
        let bad = [
            ProcessingSettings {
                fft_size: 1000,
                ..Default::default()
            },
            ProcessingSettings {
                fft_size: 65536,
                ..Default::default()
            },
            ProcessingSettings {
                averaging: 0,
                ..Default::default()
            },
            ProcessingSettings {
                peaks: PeakSettings {
                    max_count: 51,
                    ..Default::default()
                },
                ..Default::default()
            },
            ProcessingSettings {
                peaks: PeakSettings {
                    threshold: Some(f64::INFINITY),
                    ..Default::default()
                },
                ..Default::default()
            },
        ];
        for settings in bad {
            assert!(settings.validate().is_err(), "{settings:?}");
        }
    }
}
