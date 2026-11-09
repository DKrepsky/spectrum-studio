//! Descriptions of drivers, devices, capabilities and settings.

use serde::{Deserialize, Serialize};

use super::params::{ParamMap, ParamSpec};
use super::units::AmplitudeUnit;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub enum SourceKind {
    /// Software-defined radio delivering raw IQ samples.
    Sdr,
    /// Instrument that measures and returns spectrum traces itself.
    SpectrumAnalyzer,
    /// Built-in signal generator.
    Simulator,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub enum Transport {
    Usb,
    Serial,
    Network,
    Internal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub enum DriverStatus {
    /// Implemented and usable.
    Available,
    /// Listed so users know it is on the roadmap; cannot be connected.
    Planned,
}

/// Static information about an integration type.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct DriverInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub kind: SourceKind,
    pub transport: Transport,
    pub status: DriverStatus,
    pub supports_discovery: bool,
    /// Parameters needed to open a connection (host, port, ...), shown in "add manually".
    pub connection_params: Vec<ParamSpec>,
}

/// A device instance found by discovery.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct DeviceDescriptor {
    pub driver_id: String,
    pub device_id: String,
    pub label: String,
    /// Where the device is attached now (e.g. a serial port). Display text and connection hint.
    #[serde(default)]
    pub location: Option<String>,
    /// Human-readable key/value details (serial number, firmware, address...).
    pub details: Vec<(String, String)>,
}

/// Edits to a remembered source: its name and how it is reached.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct SourceUpdate {
    /// Trimmed, 1..=60 characters.
    pub name: String,
    /// `None` keeps the stored identity; `Some` (re)binds the entry to this identity.
    pub device_id: Option<String>,
    /// The new connection hint / manual parameters.
    pub connection: ParamMap,
}

/// Outcome of a non-destructive connection test.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct SourceTestResult {
    pub ok: bool,
    /// Success: "Connection OK. <driver name> found."; failure: the backend message verbatim.
    pub message: String,
    /// Identity read from the device (only when `ok`).
    pub device_id: Option<String>,
    /// Automatic label, e.g. "SA430 08FF41E50F8B3A34" (only when `ok`).
    pub label: Option<String>,
    /// True when the port belongs to the active source (`ok` is then false).
    pub in_use: bool,
}

/// Outcome of scanning one driver for devices; a failing driver reports `error` instead of
/// failing the whole scan.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct DiscoveryResult {
    pub driver_id: String,
    pub devices: Vec<DeviceDescriptor>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub enum DataKind {
    /// Complex baseband samples; the application computes the spectrum.
    Iq,
    /// Spectrum traces measured by the source itself.
    Trace,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct FrequencyRange {
    pub min_hz: f64,
    pub max_hz: f64,
}

impl FrequencyRange {
    pub fn contains(&self, hz: f64) -> bool {
        hz >= self.min_hz && hz <= self.max_hz
    }
}

/// What an opened source can do. Controls absent here are hidden or disabled in the UI.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct Capabilities {
    pub data_kind: DataKind,
    /// Tunable centre-frequency range; `None` if the source cannot be tuned.
    pub tuning: Option<FrequencyRange>,
    /// Selectable spans (the IQ sample rate for IQ sources). Empty means the span is fixed.
    pub span_options_hz: Vec<f64>,
    pub amplitude_unit: AmplitudeUnit,
    /// Device-specific runtime settings.
    pub params: Vec<ParamSpec>,
}

/// Settings currently in effect on an opened source.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct SourceSettings {
    pub center_hz: f64,
    /// Displayed span; equal to the complex sample rate for IQ sources.
    pub span_hz: f64,
    pub params: ParamMap,
}

/// A requested change of source settings; absent fields stay unchanged.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase", default)]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct SettingsPatch {
    pub center_hz: Option<f64>,
    pub span_hz: Option<f64>,
    pub params: ParamMap,
}

impl SettingsPatch {
    pub fn is_empty(&self) -> bool {
        self.center_hz.is_none() && self.span_hz.is_none() && self.params.is_empty()
    }
}

/// Everything needed to (re)open a source; this is what saved configurations store.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct SourceConfig {
    pub driver_id: String,
    /// Device chosen from discovery, if the driver supports several devices.
    #[serde(default)]
    pub device_id: Option<String>,
    #[serde(default)]
    pub connection: ParamMap,
    /// Settings applied right after connecting.
    #[serde(default)]
    pub settings: SettingsPatch,
}

impl SourceConfig {
    pub fn new(driver_id: &str) -> Self {
        Self {
            driver_id: driver_id.into(),
            device_id: None,
            connection: ParamMap::new(),
            settings: SettingsPatch::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Payloads written before the `finite` field was removed still deserialize: unknown keys are ignored.
    #[test]
    fn capabilities_ignore_the_removed_finite_key() {
        let json = r#"{
            "dataKind": "trace",
            "tuning": null,
            "spanOptionsHz": [],
            "amplitudeUnit": "dbm",
            "finite": true,
            "params": []
        }"#;
        let caps: Capabilities = serde_json::from_str(json).unwrap();
        assert_eq!(caps.data_kind, DataKind::Trace);
        assert_eq!(caps.amplitude_unit, AmplitudeUnit::Dbm);
        assert!(caps.tuning.is_none());
    }
}
