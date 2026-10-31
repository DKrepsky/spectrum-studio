//! Plain data types shared by all layers and exported to TypeScript.

pub mod frame;
pub mod params;
pub mod processing;
pub mod session;
pub mod source;
pub mod units;

pub use frame::{FrameHeader, Peak, SpectrumFrame, TraceKind};
pub use params::{ParamKind, ParamMap, ParamMapExt, ParamSpec, ParamValue};
pub use processing::{PeakSettings, ProcessingSettings, WindowKind};
pub use session::{ActiveSource, NoticeKind, SessionNotice, SessionState, SessionStatus};
pub use source::{
    Capabilities, DataKind, DeviceDescriptor, DiscoveryResult, DriverInfo, DriverStatus,
    FrequencyRange, SettingsPatch, SourceConfig, SourceKind, SourceSettings, SourceTestResult,
    SourceUpdate, Transport,
};
pub use units::AmplitudeUnit;
