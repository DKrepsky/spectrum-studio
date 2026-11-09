//! Texas Instruments SA430 sub-1 GHz spectrum analyzer (USB serial), through the `sa430` crate.
//!
//! The instrument sweeps one of three bands (300–348, 389–464, 779–928 MHz) and returns
//! factory-calibrated power in dBm, so this driver produces [`SourceData::Trace`]. Centre and
//! span map onto a sweep window that must lie inside one band; see `docs/sources.md`.

use std::io::{self, Read, Write};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use sa430::port::Port;
use sa430::spectrum::{FREQUENCY_RANGES_MHZ, REF_LEVELS_DBM};
use sa430::{Sa430, SweepRequest};
use serialport::{ClearBuffer, DataBits, FlowControl, Parity, SerialPort, StopBits};

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

/// Serial settings of the SA430 (the same as the `sa430` crate's own channel).
const BAUD_RATE: u32 = 926_100;
/// Read timeout once the handshake succeeded: the library default, which a long sweep needs.
const SWEEP_TIMEOUT: Duration = Duration::from_secs(5);

/// What the driver needs from the outside world: finding and opening devices. Tests substitute
/// a scripted implementation.
pub trait Sa430Backend: Send + Sync {
    fn scan(&self) -> Result<Vec<Port>, sa430::Error>;
    /// Opens `port_name` and returns the device, not yet identified. `sweeping` is set by the
    /// driver once the handshake succeeded; `deadline` bounds the handshake reads.
    fn open(
        &self,
        port_name: &str,
        policy: &ConnectPolicy,
        deadline: Instant,
        sweeping: Arc<AtomicBool>,
    ) -> Result<Sa430, sa430::Error>;
}

/// How hard `Sa430Driver::open` tries to identify the analyzer after its port appears.
#[derive(Debug, Clone, PartialEq)]
pub struct ConnectPolicy {
    /// Handshakes to try, each on a freshly opened port.
    pub attempts: u32,
    /// Time the port is given to settle after opening, before the first frame is sent.
    pub settle: Duration,
    /// Pauses before the second, third, ... attempt; the last value repeats.
    pub backoff: Vec<Duration>,
    /// Read timeout during the handshake.
    pub handshake_timeout: Duration,
    /// Wall-clock budget for the whole connect, counted from the first open.
    pub deadline: Duration,
}

impl Default for ConnectPolicy {
    fn default() -> Self {
        Self {
            attempts: 4,
            settle: Duration::from_millis(200),
            backoff: [150, 300, 600].map(Duration::from_millis).to_vec(),
            handshake_timeout: Duration::from_millis(600),
            deadline: Duration::from_secs(6),
        }
    }
}

impl ConnectPolicy {
    /// The pause before the 1-based `attempt` (for attempts from 2 on).
    fn backoff_before(&self, attempt: u32) -> Duration {
        let index = (attempt as usize).saturating_sub(2);
        self.backoff
            .get(index)
            .or(self.backoff.last())
            .copied()
            .unwrap_or_default()
    }
}

/// Real serial hardware. Opens the port itself, so the port can settle before the first frame
/// and use a short handshake timeout (see ADR 0012).
pub struct SerialBackend;

impl Sa430Backend for SerialBackend {
    fn scan(&self) -> Result<Vec<Port>, sa430::Error> {
        sa430::create_scanner().scan()
    }

    fn open(
        &self,
        port_name: &str,
        policy: &ConnectPolicy,
        deadline: Instant,
        sweeping: Arc<AtomicBool>,
    ) -> Result<Sa430, sa430::Error> {
        let port = serialport::new(port_name, BAUD_RATE)
            .stop_bits(StopBits::One)
            .data_bits(DataBits::Eight)
            .parity(Parity::None)
            .flow_control(FlowControl::None)
            .timeout(policy.handshake_timeout)
            .open()?;
        // The device corrupts a frame that arrives within ~20 ms of the port opening.
        thread::sleep(policy.settle);
        port.clear(ClearBuffer::Input)?;
        let link = SerialLink {
            port,
            deadline,
            handshake_timeout: policy.handshake_timeout,
            sweeping,
        };
        Ok(Sa430::new(Box::new(link)))
    }
}

/// Read timeout for the next read: the handshake timeout capped by the time left before the
/// connect deadline, or the sweep timeout once sweeping. `None` when the deadline has passed.
fn read_timeout(
    sweeping: bool,
    handshake_timeout: Duration,
    remaining: Duration,
) -> Option<Duration> {
    if sweeping {
        Some(SWEEP_TIMEOUT)
    } else if remaining.is_zero() {
        None
    } else {
        Some(handshake_timeout.min(remaining))
    }
}

/// The serial link of a device. Reads during the handshake never wait past the connect deadline.
struct SerialLink {
    port: Box<dyn SerialPort>,
    deadline: Instant,
    handshake_timeout: Duration,
    sweeping: Arc<AtomicBool>,
}

impl Read for SerialLink {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let remaining = self.deadline.saturating_duration_since(Instant::now());
        let timeout = read_timeout(
            self.sweeping.load(Ordering::SeqCst),
            self.handshake_timeout,
            remaining,
        )
        .ok_or_else(|| io::Error::new(io::ErrorKind::TimedOut, "connect deadline reached"))?;
        self.port.set_timeout(timeout).map_err(io::Error::other)?;
        self.port.read(buf)
    }
}

impl Write for SerialLink {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.port.write(buf)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.port.flush()
    }
}

pub struct Sa430Driver {
    backend: Arc<dyn Sa430Backend>,
    policy: ConnectPolicy,
}

/// A device that answered the calibration read, with the serial number it reported.
struct Identified {
    device: Sa430,
    serial: String,
}

/// Why one connect attempt failed.
enum Failure {
    /// The port could not be opened.
    Open(sa430::Error),
    /// The port opened but the device did not answer the calibration read.
    Handshake(sa430::Error),
}

impl Failure {
    fn into_error(self, port: &str) -> SourceError {
        match self {
            Failure::Open(e) => open_error(port, e),
            Failure::Handshake(e) => handshake_error(port, e),
        }
    }

    /// Whether another attempt on a fresh port may succeed.
    fn is_retryable(&self) -> bool {
        match self {
            Failure::Open(sa430::Error::Serial(e)) => matches!(
                e.kind(),
                sa430::SerialErrorKind::PermissionDenied | sa430::SerialErrorKind::NoDevice
            ),
            Failure::Open(_) => false,
            Failure::Handshake(e) => match e {
                sa430::Error::Io(e) => matches!(
                    e.kind(),
                    io::ErrorKind::TimedOut
                        | io::ErrorKind::WouldBlock
                        | io::ErrorKind::Interrupted
                ),
                sa430::Error::Device { .. }
                | sa430::Error::UnexpectedResponse { .. }
                | sa430::Error::InvalidData(_)
                | sa430::Error::Frame(_) => true,
                _ => false,
            },
        }
    }
}

/// Message for an expected-vs-found serial mismatch; `serial` is empty when the device reports none.
fn mismatch_message(expected: &str, port: &str, serial: &str) -> String {
    let found = if serial.is_empty() {
        "an SA430 that reports no serial number".to_string()
    } else {
        format!("SA430 {serial}")
    };
    format!(
        "Expected SA430 {expected} but {port} is {found}. Open Edit source and test the \
         connection to use this one, or choose the right port."
    )
}

impl Sa430Driver {
    pub fn new() -> Self {
        Self::with_backend(Arc::new(SerialBackend))
    }

    pub fn with_backend(backend: Arc<dyn Sa430Backend>) -> Self {
        Self::with_backend_and_policy(backend, ConnectPolicy::default())
    }

    pub fn with_backend_and_policy(backend: Arc<dyn Sa430Backend>, policy: ConnectPolicy) -> Self {
        Self { backend, policy }
    }

    /// Opens `port` and reads its calibration, which proves that an SA430 answers. A failed
    /// attempt drops its device (releasing the port), waits and tries again on a fresh port, as
    /// long as attempts and the deadline allow. Nothing is retried once the device has answered.
    fn identify(&self, port: &str) -> Result<Identified, SourceError> {
        let policy = &self.policy;
        let deadline = Instant::now() + policy.deadline;
        let mut attempt = 1;
        loop {
            let sweeping = Arc::new(AtomicBool::new(false));
            let failure = match self.backend.open(port, policy, deadline, sweeping.clone()) {
                Ok(mut device) => match device.calibration().map(serial_of) {
                    Ok(serial) => {
                        sweeping.store(true, Ordering::SeqCst);
                        return Ok(Identified { device, serial });
                    }
                    // The device is dropped at the end of this arm.
                    Err(e) => Failure::Handshake(e),
                },
                Err(e) => Failure::Open(e),
            };
            let out_of_attempts = attempt >= policy.attempts.max(1);
            let backoff = policy.backoff_before(attempt + 1);
            if !failure.is_retryable()
                || out_of_attempts
                || Instant::now() + backoff + policy.settle >= deadline
            {
                return Err(failure.into_error(port));
            }
            thread::sleep(backoff);
            attempt += 1;
        }
    }
}

/// The serial number the calibration data carries (empty when the device reports none).
fn serial_of(calibration: &sa430::device::Calibration) -> String {
    String::from_utf8_lossy(&calibration.serial_number)
        .trim_matches('\0')
        .trim()
        .to_string()
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
        help: Some("Path of the device's serial port, for example /dev/ttyACM0.".into()),
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
            transport: Transport::Usb,
            status: DriverStatus::Available,
            supports_discovery: true,
            connection_params: connection_params(),
        }
    }

    fn discover(&self) -> Result<Vec<DeviceDescriptor>, SourceError> {
        let ports = self.backend.scan().map_err(|e| {
            SourceError::unavailable(format!("Could not search for SA430 devices: {e}."))
                .with_cause(e)
        })?;
        Ok(device_ids(&ports)
            .into_iter()
            .zip(&ports)
            .map(|(device_id, port)| {
                let mut details = vec![("Port".to_string(), port.name().to_string())];
                if let Some(sn) = port.serial_number() {
                    details.push(("Serial number".into(), sn.into()));
                }
                if let Some(fw) = port.firmware_version() {
                    details.push(("USB firmware".into(), fw.into()));
                }
                DeviceDescriptor {
                    driver_id: DRIVER_ID.into(),
                    device_id,
                    label: match usb_serial(port) {
                        Some(sn) => format!("SA430 {sn}"),
                        None => format!("SA430 on {}", port.name()),
                    },
                    location: Some(port.name().to_string()),
                    details,
                }
            })
            .collect())
    }

    fn open(&self, config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        let connection = resolve_params(&connection_params(), &config.connection)
            .map_err(SourceError::invalid_settings)?;
        let typed = connection.text("port").unwrap_or_default().trim();
        let (port, expected) = self.resolve_port(config.device_id.as_deref(), typed)?;

        // Reading the calibration proves the device answers and is needed for every sweep.
        let Identified { device, serial } = self.identify(&port)?;
        if let Some(expected) = expected
            && expected != serial
        {
            return Err(SourceError::unavailable(mismatch_message(
                &expected, &port, &serial,
            )));
        }

        let settings = SourceSettings {
            center_hz: DEFAULT_CENTER_HZ,
            span_hz: DEFAULT_SPAN_HZ,
            params: resolve_params(&runtime_params(), &ParamMap::new())
                .map_err(SourceError::invalid_settings)?,
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
            device_id: Some(if serial.is_empty() {
                format!("{PORT_PREFIX}{port}")
            } else {
                serial
            }),
            connection: [("port".to_string(), ParamValue::Text(port))].into(),
        })
    }

    fn normalize_device_id(&self, device_id: Option<&str>, label: &str) -> Option<String> {
        if let Some(serial) = label
            .strip_prefix("SA430 ")
            .filter(|s| !s.is_empty() && !s.contains(char::is_whitespace))
        {
            return (device_id != Some(serial)).then(|| serial.to_string());
        }
        let path = device_id.filter(|id| looks_like_port_path(id))?;
        let found = self
            .backend
            .scan()
            .ok()
            .and_then(|ports| ports.into_iter().find(|p| p.name() == path))
            .and_then(|p| usb_serial(&p));
        Some(found.unwrap_or_else(|| format!("{PORT_PREFIX}{path}")))
    }
}

impl Sa430Driver {
    /// The port to open and the serial the device there must report (when the caller named one).
    fn resolve_port(
        &self,
        device_id: Option<&str>,
        typed: &str,
    ) -> Result<(String, Option<String>), SourceError> {
        match device_id {
            Some(id) if id.starts_with(PORT_PREFIX) => {
                Ok((id[PORT_PREFIX.len()..].to_string(), None))
            }
            Some(serial) => {
                // A failed scan is treated like a device that is not there.
                let ports = self.backend.scan().unwrap_or_default();
                let matching: Vec<&Port> = ports
                    .iter()
                    .filter(|p| usb_serial(p).as_deref() == Some(serial))
                    .collect();
                // A serial shared by several ports prefers the one the hint names.
                let found = matching
                    .iter()
                    .find(|p| p.name() == typed)
                    .or(matching.first());
                let port = match (found, typed) {
                    (Some(p), _) => p.name().to_string(),
                    (None, t) if !t.is_empty() => t.to_string(),
                    _ => {
                        return Err(SourceError::unavailable(format!(
                            "SA430 {serial} not found. Plug it in and check the cable."
                        )));
                    }
                };
                Ok((port, Some(serial.to_string())))
            }
            None if !typed.is_empty() => Ok((typed.to_string(), None)),
            None => self
                .discover()?
                .into_iter()
                .next()
                .and_then(|d| d.location)
                .map(|port| (port, None))
                .ok_or_else(|| {
                    SourceError::unavailable(
                        "No SA430 found. Connect the analyzer with its USB cable and try again.",
                    )
                }),
        }
    }
}

const PORT_PREFIX: &str = "port:";

/// The USB serial of a scanned port, when it reports a non-empty one.
fn usb_serial(port: &Port) -> Option<String> {
    port.serial_number()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Stable ids for scanned ports: the USB serial, or `port:<name>` when absent or shared by
/// several ports.
fn device_ids(ports: &[Port]) -> Vec<String> {
    ports
        .iter()
        .map(|port| match usb_serial(port) {
            Some(sn)
                if ports
                    .iter()
                    .filter(|p| usb_serial(p).as_deref() == Some(&sn))
                    .count()
                    == 1 =>
            {
                sn
            }
            _ => format!("{PORT_PREFIX}{}", port.name()),
        })
        .collect()
}

fn looks_like_port_path(id: &str) -> bool {
    id.starts_with("/dev/")
        || id
            .strip_prefix("COM")
            .is_some_and(|n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit()))
}

fn open_error(port: &str, error: sa430::Error) -> SourceError {
    let hint = match &error {
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
    let message = format!("Could not open {port}: {error}.{hint}");
    SourceError::unavailable(message).with_cause(error)
}

fn handshake_error(port: &str, error: sa430::Error) -> SourceError {
    SourceError::unavailable(format!(
        "{port} did not answer like an SA430 ({error}). Unplug and reconnect the analyzer, then \
         try again."
    ))
    .with_cause(error)
}

/// Maps a library error that happened while talking to an open device.
fn io_error(error: sa430::Error) -> SourceError {
    match error {
        sa430::Error::InvalidParameter(m) => SourceError::invalid_settings(m),
        sa430::Error::Serial(e) => SourceError::disconnected(format!(
            "The SA430 connection failed ({e}). Reconnect the analyzer."
        ))
        .with_cause(e),
        sa430::Error::Io(e) => match e.kind() {
            io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted => {
                SourceError::io("The SA430 did not answer in time. Try starting again.")
                    .with_cause(e)
            }
            _ => SourceError::disconnected(format!(
                "The SA430 connection was lost ({e}). Reconnect the analyzer."
            ))
            .with_cause(e),
        },
        other => SourceError::io(format!("The SA430 sent an unexpected reply ({other})."))
            .with_cause(other),
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
            SourceError::invalid_settings(format!(
                "The SA430 cannot measure around {center} MHz. Choose a centre frequency in \
                 300–348, 389–464 or 779–928 MHz."
            ))
        })?;
    if span > high - low {
        return Err(SourceError::invalid_settings(format!(
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
            return Err(SourceError::invalid_settings(format!(
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
            return Err(SourceError::io("The SA430 returned an empty sweep."));
        };
        if points.len() < 2 {
            return Err(SourceError::io(
                "The SA430 returned a sweep with a single point.",
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
    use spectrum_core::sources::SourceErrorKind;

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
        assert!(io_error(timeout).kind() == SourceErrorKind::Io);
        let gone = sa430::Error::Io(io::Error::new(io::ErrorKind::BrokenPipe, "p"));
        assert!(io_error(gone).is_fatal());
        let bad = sa430::Error::InvalidData("x".into());
        assert!(io_error(bad).kind() == SourceErrorKind::Io);
    }

    // ---- device identity ----

    use sa430::test_utils::{MockChannel, add_calibration_responses, an_error_response};
    use std::sync::Mutex;

    /// Scans a fixed port list; every opened port answers like the device with serial
    /// `08FF41E50F8B3A34` (the library's mock calibration) and is recorded.
    struct Scripted {
        ports: Vec<Port>,
        opened: Mutex<Vec<String>>,
        scan_fails: bool,
    }

    impl Scripted {
        fn driver(ports: Vec<Port>) -> (Sa430Driver, Arc<Scripted>) {
            Self::with(ports, false)
        }

        fn with(ports: Vec<Port>, scan_fails: bool) -> (Sa430Driver, Arc<Scripted>) {
            let b = Arc::new(Scripted {
                ports,
                opened: Mutex::new(Vec::new()),
                scan_fails,
            });
            (Sa430Driver::with_backend(b.clone()), b)
        }
    }

    impl Sa430Backend for Scripted {
        fn scan(&self) -> Result<Vec<Port>, sa430::Error> {
            if self.scan_fails {
                return Err(sa430::Error::Io(io::Error::other("scan failed")));
            }
            Ok(self.ports.clone())
        }

        fn open(
            &self,
            port_name: &str,
            _policy: &ConnectPolicy,
            _deadline: Instant,
            _sweeping: Arc<AtomicBool>,
        ) -> Result<Sa430, sa430::Error> {
            self.opened.lock().unwrap().push(port_name.to_string());
            let mut channel = MockChannel::new();
            add_calibration_responses(&mut channel);
            Ok(Sa430::new(Box::new(channel)))
        }
    }

    const SN: &str = "08FF41E50F8B3A34";

    fn port(name: &str, serial: Option<&str>) -> Port {
        Port::new(name, serial, None)
    }

    fn config(device_id: Option<&str>, hint: &str) -> SourceConfig {
        let mut c = SourceConfig::new(DRIVER_ID);
        c.device_id = device_id.map(String::from);
        if !hint.is_empty() {
            c.connection
                .insert("port".into(), ParamValue::Text(hint.into()));
        }
        c
    }

    fn open(d: &Sa430Driver, c: &SourceConfig) -> Result<OpenedSource, SourceError> {
        d.open(c)
    }

    #[test]
    fn discovery_ids_are_serials_with_port_fallback() {
        let (d, _) = Scripted::driver(vec![
            port("/dev/ttyACM0", Some(SN)),
            port("/dev/ttyACM1", None),
        ]);
        let found = d.discover().unwrap();
        assert_eq!(found[0].device_id, SN);
        assert_eq!(found[0].label, format!("SA430 {SN}"));
        assert_eq!(found[0].location.as_deref(), Some("/dev/ttyACM0"));
        assert_eq!(found[1].device_id, "port:/dev/ttyACM1");
        assert_eq!(found[1].label, "SA430 on /dev/ttyACM1");
        assert_eq!(d.info().transport, Transport::Usb);
    }

    #[test]
    fn duplicated_serials_fall_back_to_port_ids() {
        let (d, _) = Scripted::driver(vec![
            port("/dev/ttyACM0", Some(SN)),
            port("/dev/ttyACM1", Some(SN)),
            port("/dev/ttyACM2", Some("OTHER")),
        ]);
        let ids: Vec<_> = d
            .discover()
            .unwrap()
            .into_iter()
            .map(|x| x.device_id)
            .collect();
        assert_eq!(ids, ["port:/dev/ttyACM0", "port:/dev/ttyACM1", "OTHER"]);
    }

    #[test]
    fn open_by_serial_finds_the_device_on_another_port() {
        let (d, b) = Scripted::driver(vec![port("/dev/ttyACM3", Some(SN))]);
        let o = open(&d, &config(Some(SN), "/dev/ttyACM0")).unwrap();
        assert_eq!(*b.opened.lock().unwrap(), ["/dev/ttyACM3"]);
        assert_eq!(o.device_id.as_deref(), Some(SN));
        assert_eq!(
            o.connection.get("port"),
            Some(&ParamValue::Text("/dev/ttyACM3".into()))
        );
        assert_eq!(o.label, format!("SA430 {SN}"));
    }

    #[test]
    fn hint_is_used_when_the_serial_is_not_scanned() {
        let (d, b) = Scripted::driver(vec![]);
        let o = open(&d, &config(Some(SN), "/dev/ttyACM0")).unwrap();
        assert_eq!(*b.opened.lock().unwrap(), ["/dev/ttyACM0"]);
        assert_eq!(o.device_id.as_deref(), Some(SN));
        // A failed scan behaves the same.
        let (d, _) = Scripted::with(vec![], true);
        assert!(open(&d, &config(Some(SN), "/dev/ttyACM0")).is_ok());
    }

    #[test]
    fn missing_device_without_hint_is_not_found() {
        let (d, b) = Scripted::driver(vec![]);
        let e = open(&d, &config(Some(SN), "")).err().unwrap();
        assert_eq!(
            e.to_string(),
            format!("SA430 {SN} not found. Plug it in and check the cable.")
        );
        assert!(b.opened.lock().unwrap().is_empty());
    }

    #[test]
    fn hint_reaching_another_serial_is_refused() {
        let (d, _) = Scripted::driver(vec![]);
        let e = open(&d, &config(Some("SOMEONEELSE"), "/dev/ttyACM0"))
            .err()
            .unwrap();
        assert_eq!(
            e.to_string(),
            format!(
                "Expected SA430 SOMEONEELSE but /dev/ttyACM0 is SA430 {SN}. Open Edit source \
                 and test the connection to use this one, or choose the right port."
            )
        );
    }

    #[test]
    fn mismatch_message_reads_clearly_without_a_serial() {
        assert_eq!(
            mismatch_message("ABC", "/dev/ttyACM0", ""),
            "Expected SA430 ABC but /dev/ttyACM0 is an SA430 that reports no serial number. \
             Open Edit source and test the connection to use this one, or choose the right port."
        );
    }

    #[test]
    fn port_ids_are_upgraded_to_the_serial() {
        let (d, b) = Scripted::driver(vec![]);
        let o = open(&d, &config(Some("port:/dev/ttyACM7"), "/dev/ignored")).unwrap();
        assert_eq!(*b.opened.lock().unwrap(), ["/dev/ttyACM7"]);
        assert_eq!(o.device_id.as_deref(), Some(SN));
        assert_eq!(
            o.connection.get("port"),
            Some(&ParamValue::Text("/dev/ttyACM7".into()))
        );
    }

    #[test]
    fn open_without_an_id_picks_the_first_device_and_reports_its_identity() {
        let (d, b) = Scripted::driver(vec![
            port("/dev/ttyACM1", Some(SN)),
            port("/dev/ttyACM2", None),
        ]);
        let o = open(&d, &config(None, "")).unwrap();
        assert_eq!(*b.opened.lock().unwrap(), ["/dev/ttyACM1"]);
        assert_eq!(o.device_id.as_deref(), Some(SN));
        // A typed port wins over discovery.
        let o = open(&d, &config(None, "/dev/ttyACM2")).unwrap();
        assert_eq!(b.opened.lock().unwrap()[1], "/dev/ttyACM2");
        assert_eq!(o.device_id.as_deref(), Some(SN));
    }

    #[test]
    fn normalize_device_id_table() {
        let (d, _) = Scripted::driver(vec![
            port("/dev/ttyACM0", Some(SN)),
            port("/dev/ttyACM1", None),
        ]);
        let n = |id: Option<&str>, label: &str| d.normalize_device_id(id, label);
        // The label carries the serial.
        assert_eq!(
            n(Some("/dev/ttyACM9"), "SA430 ABC123").as_deref(),
            Some("ABC123")
        );
        assert_eq!(n(None, "SA430 ABC123").as_deref(), Some("ABC123"));
        // A path resolves through a scan, else becomes a port id.
        assert_eq!(
            n(Some("/dev/ttyACM0"), "SA430 on /dev/ttyACM0").as_deref(),
            Some(SN)
        );
        assert_eq!(
            n(Some("/dev/ttyACM1"), "SA430 on /dev/ttyACM1").as_deref(),
            Some("port:/dev/ttyACM1")
        );
        assert_eq!(
            n(Some("/dev/ttyACM5"), "My analyzer").as_deref(),
            Some("port:/dev/ttyACM5")
        );
        assert_eq!(n(Some("COM3"), "x").as_deref(), Some("port:COM3"));
        // Already stable, or nothing to go on.
        assert_eq!(n(Some("ABC123"), "SA430 ABC123"), None);
        assert_eq!(n(Some("ABC123"), "Bench"), None);
        assert_eq!(n(Some("port:/dev/ttyACM1"), "Bench"), None);
        assert_eq!(n(None, "Bench"), None);
        // A failing scan never panics.
        let (d, _) = Scripted::with(vec![], true);
        assert_eq!(
            d.normalize_device_id(Some("/dev/ttyACM0"), "x").as_deref(),
            Some("port:/dev/ttyACM0")
        );
    }

    // ---- connect attempts ----

    use std::collections::VecDeque;
    use std::sync::atomic::AtomicUsize;

    /// Wraps a channel and counts drops, to see that every failed attempt releases its port.
    struct Counted {
        inner: MockChannel,
        drops: Arc<AtomicUsize>,
    }

    impl io::Read for Counted {
        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            self.inner.read(buf)
        }
    }

    impl io::Write for Counted {
        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
            self.inner.write(buf)
        }

        fn flush(&mut self) -> io::Result<()> {
            self.inner.flush()
        }
    }

    impl Drop for Counted {
        fn drop(&mut self) {
            self.drops.fetch_add(1, Ordering::SeqCst);
        }
    }

    fn device(inner: MockChannel, drops: &Arc<AtomicUsize>) -> Result<Sa430, sa430::Error> {
        Ok(Sa430::new(Box::new(Counted {
            inner,
            drops: drops.clone(),
        })))
    }

    /// Answers like a calibrated SA430 with serial `SN`.
    fn answering() -> MockChannel {
        let mut channel = MockChannel::new();
        add_calibration_responses(&mut channel);
        channel
    }

    /// The reply the analyzer gives to a frame that arrives right after plug-in.
    fn glitch() -> MockChannel {
        let mut channel = MockChannel::new();
        channel.add_response(&an_error_response(0x032D));
        channel
    }

    /// Never answers: reads time out.
    fn silent() -> MockChannel {
        MockChannel::new()
    }

    /// Hands out one scripted open result per attempt and counts the opens.
    struct Queued {
        devices: Mutex<VecDeque<Result<Sa430, sa430::Error>>>,
        opens: AtomicUsize,
    }

    impl Queued {
        fn driver(
            policy: ConnectPolicy,
            devices: Vec<Result<Sa430, sa430::Error>>,
        ) -> (Sa430Driver, Arc<Queued>) {
            let backend = Arc::new(Queued {
                devices: Mutex::new(devices.into()),
                opens: AtomicUsize::new(0),
            });
            (
                Sa430Driver::with_backend_and_policy(backend.clone(), policy),
                backend,
            )
        }

        fn opens(&self) -> usize {
            self.opens.load(Ordering::SeqCst)
        }
    }

    impl Sa430Backend for Queued {
        fn scan(&self) -> Result<Vec<Port>, sa430::Error> {
            Ok(Vec::new())
        }

        fn open(
            &self,
            _port_name: &str,
            _policy: &ConnectPolicy,
            _deadline: Instant,
            _sweeping: Arc<AtomicBool>,
        ) -> Result<Sa430, sa430::Error> {
            self.opens.fetch_add(1, Ordering::SeqCst);
            self.devices.lock().unwrap().pop_front().unwrap_or_else(|| {
                Err(sa430::Error::Io(io::Error::new(
                    io::ErrorKind::NotFound,
                    "no more scripted devices",
                )))
            })
        }
    }

    /// The default attempts and backoff without any waiting.
    fn instant(attempts: u32) -> ConnectPolicy {
        ConnectPolicy {
            attempts,
            settle: Duration::ZERO,
            backoff: vec![Duration::ZERO],
            handshake_timeout: Duration::from_millis(600),
            deadline: Duration::from_secs(60),
        }
    }

    fn denied() -> sa430::Error {
        sa430::Error::from(serialport::Error::new(
            serialport::ErrorKind::Io(io::ErrorKind::PermissionDenied),
            "denied",
        ))
    }

    fn open_on_port(d: &Sa430Driver) -> Result<OpenedSource, SourceError> {
        open(d, &config(None, "/dev/ttyACM0"))
    }

    #[test]
    fn a_glitched_first_handshake_is_retried_on_a_fresh_port() {
        let drops = Arc::new(AtomicUsize::new(0));
        let (d, q) = Queued::driver(
            instant(4),
            vec![device(glitch(), &drops), device(answering(), &drops)],
        );
        let o = open_on_port(&d).unwrap();
        assert_eq!(q.opens(), 2);
        assert_eq!(o.device_id.as_deref(), Some(SN));
        assert_eq!(o.label, format!("SA430 {SN}"));
        // The glitched device was dropped (port released) before the second open.
        assert_eq!(drops.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn a_silent_first_handshake_is_retried() {
        let drops = Arc::new(AtomicUsize::new(0));
        let (d, q) = Queued::driver(
            instant(4),
            vec![device(silent(), &drops), device(answering(), &drops)],
        );
        assert!(open_on_port(&d).is_ok());
        assert_eq!(q.opens(), 2);
    }

    #[test]
    fn a_glitch_then_a_silent_device_then_success_takes_three_attempts() {
        let drops = Arc::new(AtomicUsize::new(0));
        let (d, q) = Queued::driver(
            instant(4),
            vec![
                device(glitch(), &drops),
                device(silent(), &drops),
                device(answering(), &drops),
            ],
        );
        let o = open_on_port(&d).unwrap();
        assert_eq!(q.opens(), 3);
        assert_eq!(o.device_id.as_deref(), Some(SN));
        assert_eq!(drops.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn a_device_that_never_answers_gives_up_after_all_attempts_with_the_clear_message() {
        let drops = Arc::new(AtomicUsize::new(0));
        let (d, q) = Queued::driver(
            instant(4),
            (0..4).map(|_| device(glitch(), &drops)).collect(),
        );
        let e = open_on_port(&d).err().unwrap();
        assert_eq!(e.kind(), SourceErrorKind::Unavailable);
        assert_eq!(q.opens(), 4);
        // Every attempt released its port.
        assert_eq!(drops.load(Ordering::SeqCst), 4);
        let message = e.to_string();
        assert!(
            message.starts_with("/dev/ttyACM0 did not answer like an SA430 (device error"),
            "{message}"
        );
        assert!(
            message.ends_with("Unplug and reconnect the analyzer, then try again."),
            "{message}"
        );
    }

    #[test]
    fn a_serial_mismatch_is_never_retried() {
        let drops = Arc::new(AtomicUsize::new(0));
        let (d, q) = Queued::driver(
            instant(4),
            vec![device(answering(), &drops), device(answering(), &drops)],
        );
        let e = open(&d, &config(Some("0000000000000001"), "/dev/ttyACM0"))
            .err()
            .unwrap();
        assert!(e.to_string().starts_with("Expected SA430 0000000000000001"));
        assert_eq!(q.opens(), 1);
    }

    #[test]
    fn a_busy_port_is_retried_and_the_final_failure_keeps_the_dialout_hint() {
        let drops = Arc::new(AtomicUsize::new(0));
        let (d, q) = Queued::driver(instant(4), vec![Err(denied()), device(answering(), &drops)]);
        assert!(open_on_port(&d).is_ok());
        assert_eq!(q.opens(), 2);

        let (d, q) = Queued::driver(instant(4), (0..4).map(|_| Err(denied())).collect());
        let e = open_on_port(&d).err().unwrap();
        assert_eq!(q.opens(), 4);
        assert!(e.to_string().contains("dialout"), "{e}");
    }

    #[test]
    fn an_unrecoverable_open_error_is_not_retried() {
        // An empty queue fails the open with a plain I/O error.
        let (d, q) = Queued::driver(instant(4), vec![]);
        let e = open_on_port(&d).err().unwrap();
        assert_eq!(e.kind(), SourceErrorKind::Unavailable);
        assert_eq!(q.opens(), 1);
    }

    #[test]
    fn a_zero_deadline_makes_exactly_one_attempt() {
        let drops = Arc::new(AtomicUsize::new(0));
        let policy = ConnectPolicy {
            deadline: Duration::ZERO,
            ..instant(4)
        };
        let (d, q) = Queued::driver(policy, (0..4).map(|_| device(glitch(), &drops)).collect());
        assert!(open_on_port(&d).is_err());
        assert_eq!(q.opens(), 1);
    }

    #[test]
    fn the_default_policy_fits_its_connect_budget() {
        let p = ConnectPolicy::default();
        assert_eq!(p.deadline, Duration::from_secs(6));
        assert_eq!(p.attempts, 4);
        // Pauses before attempts 2 to 4, plus the settle delay of every attempt, leave time for
        // the handshake reads within the 6 s deadline.
        let pauses: Duration = (2..=p.attempts).map(|a| p.backoff_before(a)).sum();
        let settles = p.settle * p.attempts;
        assert_eq!(pauses, Duration::from_millis(1050));
        assert!(pauses + settles < p.deadline);
        assert_eq!(p.handshake_timeout, Duration::from_millis(600));
    }

    #[test]
    fn backoff_follows_the_ladder_and_repeats_its_last_step() {
        let p = ConnectPolicy::default();
        let ms = |a| p.backoff_before(a).as_millis();
        assert_eq!([ms(2), ms(3), ms(4), ms(5)], [150, 300, 600, 600]);
    }

    #[test]
    fn reads_wait_the_handshake_timeout_then_the_sweep_timeout() {
        let hs = Duration::from_millis(600);
        assert_eq!(read_timeout(false, hs, Duration::from_secs(10)), Some(hs));
        // The connect deadline caps the handshake reads.
        assert_eq!(
            read_timeout(false, hs, Duration::from_millis(100)),
            Some(Duration::from_millis(100))
        );
        assert_eq!(read_timeout(false, hs, Duration::ZERO), None);
        // Once sweeping, the deadline no longer applies and sweeps keep the library's timeout.
        assert_eq!(read_timeout(true, hs, Duration::ZERO), Some(SWEEP_TIMEOUT));
        assert_eq!(SWEEP_TIMEOUT, Duration::from_secs(5));
    }
}
