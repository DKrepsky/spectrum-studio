use serde::{Deserialize, Serialize};

use super::processing::ProcessingSettings;
use super::source::{Capabilities, SourceConfig, SourceKind, SourceSettings, Transport};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub enum SessionState {
    Disconnected,
    Connecting,
    /// Source open and idle.
    Connected,
    /// Source open and producing frames.
    Acquiring,
    Disconnecting,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub enum NoticeKind {
    /// Opening the source failed.
    ConnectFailed,
    /// The device disappeared or the connection broke; the source was closed.
    DeviceLost,
    /// A read failed but the source is still open.
    AcquisitionFailed,
    /// An internal error (bug); the session was reset.
    Internal,
}

/// How acquisition runs: until stopped, or one complete sweep and then stop (owned by the session).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub enum CaptureMode {
    /// Acquire until stopped.
    #[default]
    Continuous,
    /// Acquire one complete sweep, then stop automatically.
    Single,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct SessionNotice {
    pub kind: NoticeKind,
    pub message: String,
    pub timestamp_ms: f64,
}

/// The connected source as seen by the UI.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct ActiveSource {
    pub config: SourceConfig,
    pub driver_name: String,
    pub device_label: String,
    pub kind: SourceKind,
    pub transport: Transport,
    pub simulated: bool,
    pub capabilities: Capabilities,
    pub settings: SourceSettings,
}

/// Authoritative session state pushed to the UI on every change.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct SessionStatus {
    /// Increments on every change so the UI can drop out-of-order updates.
    pub revision: u32,
    pub state: SessionState,
    pub source: Option<ActiveSource>,
    pub last_notice: Option<SessionNotice>,
    /// Configuration of the most recent connection attempt, used for "Reconnect".
    pub last_config: Option<SourceConfig>,
    pub processing: ProcessingSettings,
    /// The selected capture mode. Always set; the backend refuses to change it while acquiring,
    /// so while acquiring it is also the running mode.
    pub capture_mode: CaptureMode,
    /// True from the start of auto-connect until its launch rule has finished (ADR 0017), so the UI
    /// can show "Loading" instead of a stale selection. Always false for a session that auto-connect
    /// never started.
    pub launching: bool,
}

impl SessionStatus {
    pub fn new(processing: ProcessingSettings, capture_mode: CaptureMode) -> Self {
        Self {
            revision: 0,
            state: SessionState::Disconnected,
            source: None,
            last_notice: None,
            last_config: None,
            processing,
            capture_mode,
            launching: false,
        }
    }
}

pub fn now_ms() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        // Whole milliseconds: a fractional f64 does not survive a JSON round trip exactly.
        .map(|d| d.as_millis() as f64)
        .unwrap_or(0.0)
}
