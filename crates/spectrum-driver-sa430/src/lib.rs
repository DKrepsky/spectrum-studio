//! Texas Instruments SA430 sub-1 GHz spectrum analyzer (USB serial), through the `sa430` crate.
//!
//! The instrument sweeps one of three bands (300–348, 389–464, 779–928 MHz) and returns
//! factory-calibrated power in dBm, so this driver produces [`SourceData::Trace`]. Centre and
//! span map onto a sweep window that must lie inside one band; see `docs/sources.md`.

use std::io;
use std::sync::Arc;

use sa430::port::Port;
use sa430::spectrum::{FREQUENCY_RANGES_MHZ, REF_LEVELS_DBM};
use sa430::{Sa430, SweepRequest};

use spectrum_core::model::params::resolve_params;
use spectrum_core::model::{
    AmplitudeUnit, Capabilities, DataKind, DeviceDescriptor, DriverInfo, DriverStatus,
    FrequencyRange, ParamKind, ParamMap, ParamMapExt, ParamSpec, ParamValue, SettingsPatch,
    SourceConfig, SourceKind, SourceSettings, Transport,
};
use spectrum_core::sources::{
    OpenedSource, Source, SourceData, SourceDriver, SourceError, TraceBlock,
};

pub const DRIVER_ID: &str = "sa430";

const MHZ: f64 = 1e6;
const DEFAULT_CENTER_HZ: f64 = 433.92e6;
const DEFAULT_SPAN_HZ: f64 = 10e6;
/// The device needs ~1.3 ms per point and a sweep cannot be interrupted, so longer sweeps would
/// make Stop and Disconnect unresponsive.
const MAX_SWEEP_POINTS: f64 = 800.0;
const SPAN_OPTIONS_HZ: [f64; 8] = [1e6, 2e6, 5e6, 10e6, 20e6, 40e6, 75e6, 149e6];

/// What the driver needs from the outside world: finding and opening devices. Tests substitute
/// a scripted implementation.
pub trait Sa430Backend: Send + Sync {
    fn scan(&self) -> Result<Vec<Port>, sa430::Error>;
    fn open(&self, port_name: &str) -> Result<Sa430, sa430::Error>;
}

/// Real serial hardware.
struct SerialBackend;

impl Sa430Backend for SerialBackend {
    fn scan(&self) -> Result<Vec<Port>, sa430::Error> {
        sa430::create_scanner().scan()
    }

    fn open(&self, port_name: &str) -> Result<Sa430, sa430::Error> {
        Sa430::open(port_name)
    }
}

pub struct Sa430Driver {
    backend: Arc<dyn Sa430Backend>,
}

impl Sa430Driver {
    pub fn new() -> Self {
        Self::with_backend(Arc::new(SerialBackend))
    }

    pub fn with_backend(backend: Arc<dyn Sa430Backend>) -> Self {
        Self { backend }
    }
}

impl Default for Sa430Driver {
    fn default() -> Self {
        Self::new()
    }
}

fn connection_params() -> Vec<ParamSpec> {
    vec![ParamSpec {
        id: "port".into(),
        label: "Serial port".into(),
        group: None,
        help: Some("For example /dev/ttyACM0. Leave empty to use the first SA430 found.".into()),
        kind: ParamKind::Text { max_length: 256 },
        default: ParamValue::Text(String::new()),
        required: false,
    }]
}

fn runtime_params() -> Vec<ParamSpec> {
    let levels: Vec<(String, String)> = REF_LEVELS_DBM
        .iter()
        .map(|l| (l.to_string(), format!("{l} dBm")))
        .collect();
    let level_options: Vec<(&str, &str)> = levels
        .iter()
        .map(|(v, l)| (v.as_str(), l.as_str()))
        .collect();
    vec![
        ParamSpec::number("stepKhz", "Frequency step", 10.0, 500.0, 5.0, 100.0)
            .with_unit("kHz")
            .with_help(
                "Distance between measured points. The resolution bandwidth is chosen \
                 automatically to be at least twice the step.",
            ),
        ParamSpec::choice("refLevelDbm", "Reference level", &level_options, "-35").with_help(
            "Input level at the top of the measurement range. Lower levels are more sensitive \
             but overload on strong signals.",
        ),
    ]
}

impl SourceDriver for Sa430Driver {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: DRIVER_ID.into(),
            name: "TI SA430 spectrum analyzer".into(),
            description: "Texas Instruments MSP-SA430-SUB1GHZ sub-1 GHz analyzer over USB \
                          (300–348, 389–464 and 779–928 MHz), calibrated dBm."
                .into(),
            kind: SourceKind::SpectrumAnalyzer,
            transport: Transport::Serial,
            status: DriverStatus::Available,
            supports_discovery: true,
            connection_params: connection_params(),
        }
    }

    fn discover(&self) -> Result<Vec<DeviceDescriptor>, SourceError> {
        let ports = self.backend.scan().map_err(|e| {
            SourceError::Unavailable(format!("Could not search for SA430 devices: {e}."))
        })?;
        Ok(ports
            .iter()
            .map(|port| {
                let mut details = vec![("Port".to_string(), port.name().to_string())];
                if let Some(sn) = port.serial_number() {
                    details.push(("Serial number".into(), sn.into()));
                }
                if let Some(fw) = port.firmware_version() {
                    details.push(("USB firmware".into(), fw.into()));
                }
                DeviceDescriptor {
                    driver_id: DRIVER_ID.into(),
                    device_id: port.name().to_string(),
                    label: match port.serial_number() {
                        Some(sn) => format!("SA430 {sn}"),
                        None => format!("SA430 on {}", port.name()),
                    },
                    details,
                }
            })
            .collect())
    }

    fn open(&self, config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        let connection = resolve_params(&connection_params(), &config.connection)
            .map_err(SourceError::InvalidSettings)?;
        let typed = connection.text("port").unwrap_or_default().trim();
        let port = if let Some(id) = &config.device_id {
            id.clone()
        } else if !typed.is_empty() {
            typed.to_string()
        } else {
            self.discover()?
                .into_iter()
                .next()
                .map(|d| d.device_id)
                .ok_or_else(|| {
                    SourceError::Unavailable(
                        "No SA430 found. Connect the analyzer with its USB cable and try again."
                            .into(),
                    )
                })?
        };

        let mut device = self
            .backend
            .open(&port)
            .map_err(|e| open_error(&port, &e))?;
        // Reading the calibration proves the device answers and is needed for every sweep.
        let serial = device
            .calibration()
            .map(|c| {
                String::from_utf8_lossy(&c.serial_number)
                    .trim_end_matches('\0')
                    .to_string()
            })
            .map_err(|e| {
                SourceError::Unavailable(format!(
                    "{port} did not answer like an SA430 ({e}). Unplug and reconnect the \
                     analyzer, then try again."
                ))
            })?;

        let settings = SourceSettings {
            center_hz: DEFAULT_CENTER_HZ,
            span_hz: DEFAULT_SPAN_HZ,
            params: resolve_params(&runtime_params(), &ParamMap::new())
                .map_err(SourceError::InvalidSettings)?,
        };
        Ok(OpenedSource {
            source: Box::new(Sa430Source {
                device,
                caps: Capabilities {
                    data_kind: DataKind::Trace,
                    tuning: Some(FrequencyRange {
                        min_hz: FREQUENCY_RANGES_MHZ[0].0 * MHZ,
                        max_hz: FREQUENCY_RANGES_MHZ[2].1 * MHZ,
                    }),
                    span_options_hz: SPAN_OPTIONS_HZ.to_vec(),
                    amplitude_unit: AmplitudeUnit::Dbm,
                    finite: false,
                    params: runtime_params(),
                },
                settings,
            }),
            label: if serial.is_empty() {
                format!("SA430 on {port}")
            } else {
                format!("SA430 {serial}")
            },
            simulated: false,
        })
    }
}

fn open_error(port: &str, error: &sa430::Error) -> SourceError {
    let hint = match error {
        sa430::Error::Serial(e) => match e.kind() {
            sa430::SerialErrorKind::NoDevice => {
                " Check that the analyzer is connected and the port name is right.".to_string()
            }
            sa430::SerialErrorKind::PermissionDenied => {
                " Add your user to the \"dialout\" group and log in again.".to_string()
            }
            _ => String::new(),
        },
        _ => String::new(),
    };
    SourceError::Unavailable(format!("Could not open {port}: {error}.{hint}"))
}

/// Maps a library error that happened while talking to an open device.
fn io_error(error: sa430::Error) -> SourceError {
    match error {
        sa430::Error::InvalidParameter(m) => SourceError::InvalidSettings(m),
        sa430::Error::Serial(e) => SourceError::Disconnected(format!(
            "The SA430 connection failed ({e}). Reconnect the analyzer."
        )),
        sa430::Error::Io(e) => match e.kind() {
            io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted => {
                SourceError::Io("The SA430 did not answer in time. Try starting again.".into())
            }
            _ => SourceError::Disconnected(format!(
                "The SA430 connection was lost ({e}). Reconnect the analyzer."
            )),
        },
        other => SourceError::Io(format!("The SA430 sent an unexpected reply ({other}).")),
    }
}

struct Sa430Source {
    device: Sa430,
    caps: Capabilities,
    settings: SourceSettings,
}

/// The sweep window (MHz) for a centre and span: inside the band holding the centre, shifted
/// back into the band when it would stick out.
fn sweep_window(center_hz: f64, span_hz: f64) -> Result<(f64, f64), SourceError> {
    let center = center_hz / MHZ;
    let span = span_hz / MHZ;
    let &(low, high) = FREQUENCY_RANGES_MHZ
        .iter()
        .find(|(low, high)| (*low..=*high).contains(&center))
        .ok_or_else(|| {
            SourceError::InvalidSettings(format!(
                "The SA430 cannot measure around {center} MHz. Choose a centre frequency in \
                 300–348, 389–464 or 779–928 MHz."
            ))
        })?;
    if span > high - low {
        return Err(SourceError::InvalidSettings(format!(
            "A {span} MHz span is wider than the {low}–{high} MHz band. Choose a smaller span."
        )));
    }
    let start = (center - span / 2.0).clamp(low, high - span);
    Ok((start, start + span))
}

impl Sa430Source {
    fn request(&self, settings: &SourceSettings) -> Result<(SweepRequest, f64, f64), SourceError> {
        let (start, stop) = sweep_window(settings.center_hz, settings.span_hz)?;
        let step_khz = settings.params.number("stepKhz").unwrap_or(100.0);
        let points = (stop - start) * 1e3 / step_khz + 1.0;
        if points > MAX_SWEEP_POINTS {
            return Err(SourceError::InvalidSettings(format!(
                "A {} MHz span with {step_khz} kHz steps needs {points:.0} points, more than the \
                 {MAX_SWEEP_POINTS} the SA430 can sweep responsively. Increase the frequency step \
                 or choose a smaller span.",
                stop - start
            )));
        }
        let step_mhz = step_khz / 1e3;
        let level = settings
            .params
            .text("refLevelDbm")
            .and_then(|t| t.parse::<i8>().ok());
        let request = SweepRequest::new(start, stop, step_mhz, level).map_err(io_error)?;
        Ok((request, start, stop))
    }
}

impl Source for Sa430Source {
    fn capabilities(&self) -> &Capabilities {
        &self.caps
    }

    fn settings(&self) -> &SourceSettings {
        &self.settings
    }

    fn apply(&mut self, patch: &SettingsPatch) -> Result<(), SourceError> {
        let mut next = self.settings.clone();
        if let Some(c) = patch.center_hz {
            next.center_hz = c;
        }
        if let Some(s) = patch.span_hz {
            next.span_hz = s;
        }
        next.params.extend(patch.params.clone());
        let (_, start, stop) = self.request(&next)?;
        // Report the window actually swept, which may have been shifted into the band.
        next.center_hz = (start + stop) / 2.0 * MHZ;
        self.settings = next;
        Ok(())
    }

    fn start(&mut self) -> Result<(), SourceError> {
        Ok(())
    }

    fn read(&mut self, _samples_wanted: usize) -> Result<SourceData, SourceError> {
        let (request, _, _) = self.request(&self.settings)?;
        let points = self.device.measure(&request).map_err(io_error)?;
        let (Some(first), Some(last)) = (points.first(), points.last()) else {
            return Err(SourceError::Io("The SA430 returned an empty sweep.".into()));
        };
        if points.len() < 2 {
            return Err(SourceError::Io(
                "The SA430 returned a sweep with a single point.".into(),
            ));
        }
        Ok(SourceData::Trace(TraceBlock {
            values: points.iter().map(|m| m.power_dbm as f32).collect(),
            start_hz: first.frequency_mhz * MHZ,
            bin_hz: (last.frequency_mhz - first.frequency_mhz) * MHZ / (points.len() - 1) as f64,
            unit: AmplitudeUnit::Dbm,
            rbw_hz: None,
        }))
    }

    fn stop(&mut self) -> Result<(), SourceError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn window_is_centred_inside_the_band() {
        let (a, b) = sweep_window(433.92e6, 10e6).unwrap();
        assert!((a - 428.92).abs() < 1e-9 && (b - 438.92).abs() < 1e-9);
    }

    #[test]
    fn window_is_shifted_back_into_the_band() {
        let (a, b) = sweep_window(463e6, 10e6).unwrap();
        assert!((a - 454.0).abs() < 1e-9 && (b - 464.0).abs() < 1e-9);
        let (a, b) = sweep_window(300e6, 10e6).unwrap();
        assert!((a - 300.0).abs() < 1e-9 && (b - 310.0).abs() < 1e-9);
    }

    #[test]
    fn centre_between_bands_or_span_wider_than_band_is_rejected() {
        let e = sweep_window(360e6, 5e6).unwrap_err();
        assert!(e.to_string().contains("300–348, 389–464 or 779–928"));
        let e = sweep_window(320e6, 75e6).unwrap_err();
        assert!(e.to_string().contains("wider than the 300–348"));
    }

    #[test]
    fn library_errors_map_to_actionable_source_errors() {
        let timeout = sa430::Error::Io(io::Error::new(io::ErrorKind::TimedOut, "t"));
        assert!(matches!(io_error(timeout), SourceError::Io(_)));
        let gone = sa430::Error::Io(io::Error::new(io::ErrorKind::BrokenPipe, "p"));
        assert!(io_error(gone).is_fatal());
        let bad = sa430::Error::InvalidData("x".into());
        assert!(matches!(io_error(bad), SourceError::Io(_)));
    }
}
