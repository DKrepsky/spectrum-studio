//! SA430 driver scenarios through `SessionManager`, with a scripted serial link, plus one
//! `#[ignore]`d test against real hardware (`cargo test -p spectrum-core --test sa430 -- --ignored`).
#![allow(clippy::unwrap_used)] // test helpers outside #[test] functions

use std::io;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use sa430::Sa430;
use sa430::frame::Command;
use sa430::port::Port;
use sa430::test_utils::{
    MockChannel, a_spectrum_response, add_calibration_responses, an_ack_response, an_error_response,
};
use spectrum_core::model::{
    AmplitudeUnit, DataKind, NoticeKind, ParamValue, ProcessingSettings, SessionState,
    SessionStatus, SettingsPatch, SourceConfig,
};
use spectrum_core::sources::sa430::{DRIVER_ID, Sa430Backend, Sa430Driver};
use spectrum_core::{DriverRegistry, SessionError, SessionManager, SessionSink};

const WAIT: Duration = Duration::from_secs(5);

struct NullSink;
impl SessionSink for NullSink {
    fn status_changed(&self, _: &SessionStatus) {}
}

/// Queues the replies of one complete sweep returning `samples`.
fn add_sweep(channel: &mut MockChannel, samples: &[i8]) {
    for command in [
        Command::InitParameter,
        Command::SetFStart,
        Command::SetFStop,
        Command::SetFStep,
        Command::SetRbw,
        Command::SetIf,
        Command::SetGain,
        Command::GetSpecNoInit,
    ] {
        channel.add_response(&an_ack_response(command));
    }
    channel.add_response(&a_spectrum_response(samples));
    channel.add_response(&an_error_response(0));
}

/// Wraps a channel so the "cable" can be pulled: every read then fails with a broken pipe.
struct PullableChannel {
    inner: MockChannel,
    unplugged: Arc<AtomicBool>,
}

impl io::Read for PullableChannel {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        if self.unplugged.load(Ordering::SeqCst) {
            return Err(io::Error::new(io::ErrorKind::BrokenPipe, "unplugged"));
        }
        self.inner.read(buf)
    }
}

impl io::Write for PullableChannel {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        if self.unplugged.load(Ordering::SeqCst) {
            return Err(io::Error::new(io::ErrorKind::BrokenPipe, "unplugged"));
        }
        self.inner.write(buf)
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

struct ScriptedBackend {
    ports: Vec<Port>,
    channel: Mutex<Option<MockChannel>>,
    unplugged: Arc<AtomicBool>,
}

impl Sa430Backend for ScriptedBackend {
    fn scan(&self) -> Result<Vec<Port>, sa430::Error> {
        Ok(self.ports.clone())
    }

    fn open(&self, _port: &str) -> Result<Sa430, sa430::Error> {
        let inner = self.channel.lock().unwrap().take().ok_or_else(|| {
            sa430::Error::Io(io::Error::new(io::ErrorKind::NotFound, "no such port"))
        })?;
        Ok(Sa430::new(Box::new(PullableChannel {
            inner,
            unplugged: self.unplugged.clone(),
        })))
    }
}

fn manager(ports: Vec<Port>, sweeps: usize, samples: &[i8]) -> (SessionManager, Arc<AtomicBool>) {
    let mut channel = MockChannel::new();
    add_calibration_responses(&mut channel);
    for _ in 0..sweeps {
        add_sweep(&mut channel, samples);
    }
    let unplugged = Arc::new(AtomicBool::new(false));
    let backend = ScriptedBackend {
        ports,
        channel: Mutex::new(Some(channel)),
        unplugged: unplugged.clone(),
    };
    let mut registry = DriverRegistry::new();
    registry.register(Sa430Driver::with_backend(Arc::new(backend)));
    (
        SessionManager::new(registry, Arc::new(NullSink), ProcessingSettings::default()),
        unplugged,
    )
}

fn one_port() -> Vec<Port> {
    vec![Port::new(
        "/dev/ttyACM0",
        Some("08FF41E50F8B3A34"),
        Some("0104"),
    )]
}

fn wait_until(m: &SessionManager, pred: impl Fn(&SessionStatus) -> bool) -> SessionStatus {
    let deadline = std::time::Instant::now() + WAIT;
    loop {
        let s = m.status();
        if pred(&s) {
            return s;
        }
        assert!(std::time::Instant::now() < deadline, "timed out: {s:?}");
        std::thread::sleep(Duration::from_millis(5));
    }
}

fn config() -> SourceConfig {
    let mut c = SourceConfig::new(DRIVER_ID);
    c.settings = SettingsPatch {
        center_hz: Some(433.92e6),
        span_hz: Some(5e6),
        params: [("stepKhz".to_string(), ParamValue::Number(500.0))].into(),
    };
    c
}

const SAMPLES: [i8; 11] = [-80, -78, -75, -60, -40, -20, -41, -62, -77, -79, -81];

#[test]
fn discovery_lists_devices_with_their_details() {
    let (m, _) = manager(one_port(), 0, &[]);
    let found = m.discover(DRIVER_ID).unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].device_id, "/dev/ttyACM0");
    assert!(found[0].label.contains("08FF41E50F8B3A34"));
    assert!(
        found[0]
            .details
            .iter()
            .any(|(k, v)| k == "USB firmware" && v == "0104")
    );
}

#[test]
fn connects_acquires_calibrated_dbm_traces_and_disconnects() {
    let (m, _) = manager(one_port(), 3, &SAMPLES);
    let status = m.connect(config()).unwrap();
    let source = status.source.unwrap();
    assert!(source.device_label.contains("08FF41E50F8B3A34"));
    assert_eq!(source.capabilities.data_kind, DataKind::Trace);
    assert_eq!(source.capabilities.amplitude_unit, AmplitudeUnit::Dbm);
    assert!(!source.simulated);

    m.start().unwrap();
    let f = m.wait_frame(0, WAIT).unwrap();
    assert_eq!(f.frame.header.unit, AmplitudeUnit::Dbm);
    assert_eq!(f.frame.header.data_kind, DataKind::Trace);
    assert_eq!(f.frame.live.len(), SAMPLES.len());
    // Samples are in half-dB steps, offset by the factory calibration; the peak stays the peak.
    let peak = f
        .frame
        .live
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.total_cmp(b.1))
        .unwrap()
        .0;
    assert_eq!(peak, 5);
    assert!((f.frame.header.start_hz - 431.42e6).abs() < 20e3);

    m.stop().unwrap();
    m.disconnect();
    assert_eq!(m.status().state, SessionState::Disconnected);
}

#[test]
fn settings_are_shifted_into_the_band_or_rejected() {
    let (m, _) = manager(one_port(), 0, &[]);
    m.connect(config()).unwrap();

    // Near the top of the 389–464 MHz band the window is shifted back inside it.
    let applied = m
        .apply_settings(SettingsPatch {
            center_hz: Some(463e6),
            span_hz: Some(10e6),
            ..Default::default()
        })
        .unwrap();
    assert!((applied.center_hz - 459e6).abs() < 1.0);

    // Between bands there is nothing to measure; the previous settings stay in effect.
    let err = m
        .apply_settings(SettingsPatch {
            center_hz: Some(360e6),
            ..Default::default()
        })
        .unwrap_err();
    assert!(err.to_string().contains("300–348, 389–464 or 779–928"));
    assert!((m.status().source.unwrap().settings.center_hz - 459e6).abs() < 1.0);

    // Too many points for a sweep that can be interrupted in reasonable time.
    let err = m
        .apply_settings(SettingsPatch {
            center_hz: Some(850e6),
            span_hz: Some(149e6),
            params: [("stepKhz".to_string(), ParamValue::Number(10.0))].into(),
        })
        .unwrap_err();
    assert!(
        err.to_string().contains("Increase the frequency step"),
        "{err}"
    );

    // A span the band cannot hold.
    let err = m
        .apply_settings(SettingsPatch {
            center_hz: Some(320e6),
            span_hz: Some(75e6),
            ..Default::default()
        })
        .unwrap_err();
    assert!(err.to_string().contains("wider than the 300–348"));
}

#[test]
fn connecting_without_a_device_explains_what_to_do() {
    let (m, _) = manager(vec![], 0, &[]);
    let err = m.connect(SourceConfig::new(DRIVER_ID)).unwrap_err();
    assert!(matches!(err, SessionError::Source(_)));
    assert!(err.to_string().contains("No SA430 found"), "{err}");
    assert_eq!(m.status().state, SessionState::Disconnected);
}

#[test]
fn a_silent_device_stops_acquisition_but_stays_connected() {
    // One sweep is queued; the second one times out.
    let (m, _) = manager(one_port(), 1, &SAMPLES);
    m.connect(config()).unwrap();
    m.start().unwrap();
    assert!(m.wait_frame(0, WAIT).is_some());
    let s = wait_until(&m, |s| s.state == SessionState::Connected);
    assert_eq!(s.last_notice.unwrap().kind, NoticeKind::AcquisitionFailed);
    assert!(s.source.is_some());
}

#[test]
fn unplugging_the_analyzer_disconnects_the_session() {
    let (m, unplugged) = manager(one_port(), 50, &SAMPLES);
    m.connect(config()).unwrap();
    m.start().unwrap();
    assert!(m.wait_frame(0, WAIT).is_some());
    unplugged.store(true, Ordering::SeqCst);
    let s = wait_until(&m, |s| s.state == SessionState::Disconnected);
    assert!(
        s.last_notice
            .unwrap()
            .message
            .contains("Reconnect the analyzer")
    );
}

/// Needs an SA430 on USB: `cargo test -p spectrum-core --test sa430 -- --ignored --nocapture`.
#[test]
#[ignore = "requires a connected SA430"]
fn real_hardware_sweeps() {
    let mut registry = DriverRegistry::new();
    registry.register(Sa430Driver::new());
    let m = SessionManager::new(registry, Arc::new(NullSink), ProcessingSettings::default());
    let found = m.discover(DRIVER_ID).unwrap();
    assert!(!found.is_empty(), "no SA430 detected");
    let mut c = SourceConfig::new(DRIVER_ID);
    c.device_id = Some(found[0].device_id.clone());
    let status = m.connect(c).unwrap();
    println!(
        "connected: {:?}",
        status.source.as_ref().unwrap().device_label
    );

    m.start().unwrap();
    let mut seq = 0;
    for _ in 0..5 {
        let f = m.wait_frame(seq, Duration::from_secs(10)).expect("frame");
        seq = f.frame.header.seq;
        let max = f.frame.live.iter().copied().fold(f32::MIN, f32::max);
        println!(
            "seq {seq}: {} points from {:.3} MHz, bin {:.1} kHz, max {max:.1} dBm",
            f.frame.live.len(),
            f.frame.header.start_hz / 1e6,
            f.frame.header.bin_hz / 1e3
        );
        assert_eq!(f.frame.header.unit, AmplitudeUnit::Dbm);
        assert!(f.frame.live.len() > 50);
    }
    m.stop().unwrap();
    m.disconnect();
}
