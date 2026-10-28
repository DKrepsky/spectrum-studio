//! Signal source integrations.
//!
//! A [`SourceDriver`] represents an integration type (the simulator, an IQ file reader, a family
//! of SDRs...). Opening it yields a [`Source`]: a live connection that reports its
//! [`Capabilities`] and produces [`SourceData`]. Sources run on the session worker thread.

pub mod files;
pub mod pacer;
pub mod planned;
pub mod registry;
pub mod simulator;

use rustfft::num_complex::Complex32;
use thiserror::Error;

use crate::model::{
    AmplitudeUnit, Capabilities, DeviceDescriptor, DriverInfo, SettingsPatch, SourceConfig,
    SourceSettings,
};

pub use registry::DriverRegistry;

#[derive(Debug, Clone, PartialEq, Error)]
pub enum SourceError {
    /// The device is gone or the connection broke; the source must be closed.
    #[error("{0}")]
    Disconnected(String),
    /// The source could not be opened (not found, busy, permission denied...).
    #[error("{0}")]
    Unavailable(String),
    /// Configuration or settings rejected by the source.
    #[error("{0}")]
    InvalidSettings(String),
    /// A recoverable I/O or protocol error; acquisition may be retried.
    #[error("{0}")]
    Io(String),
    /// The driver does not support this operation.
    #[error("{0}")]
    Unsupported(String),
}

impl SourceError {
    /// Whether the source can no longer be used after this error.
    pub fn is_fatal(&self) -> bool {
        matches!(self, Self::Disconnected(_))
    }
}

/// A block of contiguous complex baseband samples.
#[derive(Debug, Clone, PartialEq)]
pub struct IqBlock {
    pub samples: Vec<Complex32>,
    pub sample_rate_hz: f64,
    pub center_hz: f64,
    /// Set when samples were lost before this block (overflow, retune, gap in time).
    pub discontinuity: bool,
}

/// A spectrum measured by the source on a uniform frequency grid.
#[derive(Debug, Clone, PartialEq)]
pub struct TraceBlock {
    pub values: Vec<f32>,
    pub start_hz: f64,
    pub bin_hz: f64,
    pub unit: AmplitudeUnit,
    pub rbw_hz: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SourceData {
    Iq(IqBlock),
    Trace(TraceBlock),
    /// A finite source has no more data.
    EndOfStream,
}

/// An integration type. Implementations must be cheap to construct and thread-safe.
pub trait SourceDriver: Send + Sync {
    fn info(&self) -> DriverInfo;

    /// Lists devices currently available. Drivers without discovery return an empty list.
    fn discover(&self) -> Result<Vec<DeviceDescriptor>, SourceError> {
        Ok(Vec::new())
    }

    /// Opens a connection. `config.connection` has been validated against
    /// `info().connection_params` by the caller.
    fn open(&self, config: &SourceConfig) -> Result<OpenedSource, SourceError>;
}

pub struct OpenedSource {
    pub source: Box<dyn Source>,
    /// Human-readable name of the opened device (e.g. "RTL2838 SN 0001" or a file name).
    pub label: String,
    pub simulated: bool,
}

/// An open connection. All methods are called from a single worker thread.
pub trait Source: Send {
    fn capabilities(&self) -> &Capabilities;

    fn settings(&self) -> &SourceSettings;

    /// Applies a patch already validated against [`Source::capabilities`]. On error the previous
    /// settings must remain in effect.
    fn apply(&mut self, patch: &SettingsPatch) -> Result<(), SourceError>;

    fn start(&mut self) -> Result<(), SourceError>;

    /// Returns the next block of data, blocking for at most ~250 ms.
    ///
    /// `samples_wanted` is the number of contiguous IQ samples the consumer needs for one
    /// spectrum; IQ sources should return at least that many when they can. Trace sources ignore
    /// it.
    fn read(&mut self, samples_wanted: usize) -> Result<SourceData, SourceError>;

    fn stop(&mut self) -> Result<(), SourceError>;
}

/// Validates a settings patch against a source's capabilities.
pub fn validate_patch(
    caps: &Capabilities,
    current: &SourceSettings,
    patch: &SettingsPatch,
) -> Result<(), SourceError> {
    if let Some(center) = patch.center_hz {
        if !center.is_finite() {
            return Err(SourceError::InvalidSettings(
                "Center frequency must be a finite number.".into(),
            ));
        }
        match &caps.tuning {
            Some(range) if !range.contains(center) => {
                return Err(SourceError::InvalidSettings(format!(
                    "Center frequency {} is outside the tunable range {} – {}.",
                    crate::format::hz(center),
                    crate::format::hz(range.min_hz),
                    crate::format::hz(range.max_hz)
                )));
            }
            None if center != current.center_hz => {
                return Err(SourceError::InvalidSettings(
                    "This source cannot be tuned.".into(),
                ));
            }
            _ => {}
        }
    }
    if let Some(span) = patch.span_hz
        && span != current.span_hz
        && !caps.span_options_hz.contains(&span)
    {
        return Err(SourceError::InvalidSettings(
            if caps.span_options_hz.is_empty() {
                "This source has a fixed span.".into()
            } else {
                format!("Span {} is not supported.", crate::format::hz(span))
            },
        ));
    }
    crate::model::params::check_partial(&caps.params, &patch.params)
        .map_err(SourceError::InvalidSettings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{DataKind, FrequencyRange, ParamMap, ParamSpec, ParamValue};

    fn caps(tunable: bool) -> Capabilities {
        Capabilities {
            data_kind: DataKind::Iq,
            tuning: tunable.then_some(FrequencyRange {
                min_hz: 1e6,
                max_hz: 1e9,
            }),
            span_options_hz: vec![1e6, 2e6],
            amplitude_unit: AmplitudeUnit::Dbfs,
            finite: false,
            params: vec![ParamSpec::number("gain", "Gain", 0.0, 10.0, 1.0, 0.0)],
        }
    }

    fn current() -> SourceSettings {
        SourceSettings {
            center_hz: 100e6,
            span_hz: 1e6,
            params: ParamMap::new(),
        }
    }

    #[test]
    fn accepts_valid_patch() {
        let patch = SettingsPatch {
            center_hz: Some(200e6),
            span_hz: Some(2e6),
            params: [("gain".to_string(), ParamValue::Number(5.0))].into(),
        };
        assert!(validate_patch(&caps(true), &current(), &patch).is_ok());
    }

    #[test]
    fn rejects_out_of_range_tuning_and_untunable_sources() {
        let patch = SettingsPatch {
            center_hz: Some(2e9),
            ..Default::default()
        };
        let err = validate_patch(&caps(true), &current(), &patch).unwrap_err();
        assert!(err.to_string().contains("outside the tunable range"));

        let patch = SettingsPatch {
            center_hz: Some(101e6),
            ..Default::default()
        };
        assert_eq!(
            validate_patch(&caps(false), &current(), &patch)
                .unwrap_err()
                .to_string(),
            "This source cannot be tuned."
        );
        // Re-sending the current value is harmless.
        let same = SettingsPatch {
            center_hz: Some(100e6),
            ..Default::default()
        };
        assert!(validate_patch(&caps(false), &current(), &same).is_ok());
    }

    #[test]
    fn rejects_unsupported_span_and_bad_params() {
        let patch = SettingsPatch {
            span_hz: Some(3e6),
            ..Default::default()
        };
        assert!(validate_patch(&caps(true), &current(), &patch).is_err());
        let patch = SettingsPatch {
            params: [("gain".to_string(), ParamValue::Number(50.0))].into(),
            ..Default::default()
        };
        assert!(validate_patch(&caps(true), &current(), &patch).is_err());
    }
}
