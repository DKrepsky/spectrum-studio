//! Integrations on the roadmap. They are listed so users can see what is coming, but they are
//! clearly marked as planned and cannot be opened.

use super::{OpenedSource, SourceDriver, SourceError};
use crate::model::{DriverInfo, DriverStatus, SourceConfig, SourceKind, Transport};

pub struct PlannedDriver {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    kind: SourceKind,
    transport: Transport,
}

impl SourceDriver for PlannedDriver {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: self.id.into(),
            name: self.name.into(),
            description: self.description.into(),
            kind: self.kind,
            transport: self.transport,
            status: DriverStatus::Planned,
            supports_discovery: false,
            connection_params: Vec::new(),
        }
    }

    fn open(&self, _config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        Err(SourceError::Unsupported(format!(
            "{} support is not implemented yet.",
            self.name
        )))
    }
}

pub fn planned_drivers() -> Vec<PlannedDriver> {
    vec![
        PlannedDriver {
            id: "soapysdr",
            name: "SoapySDR devices",
            description: "RTL-SDR, HackRF, Airspy, LimeSDR, SDRplay and other SDRs through the \
                          SoapySDR library.",
            kind: SourceKind::Sdr,
            transport: Transport::Usb,
        },
        PlannedDriver {
            id: "rtl_tcp",
            name: "rtl_tcp server",
            description: "Remote RTL-SDR streaming IQ over the rtl_tcp network protocol.",
            kind: SourceKind::Sdr,
            transport: Transport::Network,
        },
        PlannedDriver {
            id: "scpi_lan",
            name: "SCPI spectrum analyzer (LAN)",
            description: "Bench spectrum analyzers controlled with SCPI over TCP (port 5025), \
                          reading calibrated traces.",
            kind: SourceKind::SpectrumAnalyzer,
            transport: Transport::Network,
        },
        PlannedDriver {
            id: "tinysa",
            name: "tinySA",
            description: "tinySA / tinySA Ultra handheld analyzers over USB serial.",
            kind: SourceKind::SpectrumAnalyzer,
            transport: Transport::Serial,
        },
    ]
}
