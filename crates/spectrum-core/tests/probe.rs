//! `SessionManager::test_source`: non-destructive connection tests with scripted drivers.
#![allow(clippy::unwrap_used)] // test helpers outside #[test] functions

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use spectrum_core::model::{
    AmplitudeUnit, Capabilities, DataKind, DriverInfo, DriverStatus, ParamKind, ParamMap,
    ParamSpec, ParamValue, ProcessingSettings, SessionState, SettingsPatch, SourceConfig,
    SourceKind, SourceSettings, SourceTestResult, Transport,
};
use spectrum_core::sources::planned::planned_drivers;
use spectrum_core::sources::simulator::{self, SimulatorDriver};
use spectrum_core::sources::{
    OpenedSource, Source, SourceData, SourceDriver, SourceError, SourceErrorKind, TraceBlock,
};
use spectrum_core::{DriverRegistry, NullSink, SessionError, SessionManager};

const WAIT: Duration = Duration::from_secs(5);

enum Mode {
    Ok,
    Fail(&'static str),
    /// Waits for a message before succeeding.
    Block(Receiver<()>),
    Sleep(Duration),
}

/// A serial-style driver: `port` is its only connection parameter.
struct PortDriver {
    mode: Mutex<Mode>,
    opens: AtomicUsize,
    started: Mutex<Sender<()>>,
}

struct IdleSource {
    caps: Capabilities,
    settings: SourceSettings,
}

impl Source for IdleSource {
    fn capabilities(&self) -> &Capabilities {
        &self.caps
    }
    fn settings(&self) -> &SourceSettings {
        &self.settings
    }
    fn apply(&mut self, _patch: &SettingsPatch) -> Result<(), SourceError> {
        Ok(())
    }
    fn start(&mut self) -> Result<(), SourceError> {
        Ok(())
    }
    fn read(&mut self, _wanted: usize) -> Result<SourceData, SourceError> {
        std::thread::sleep(Duration::from_millis(5));
        Ok(SourceData::Trace(TraceBlock {
            values: vec![-90.0],
            start_hz: 1e9,
            bin_hz: 1e6,
            unit: AmplitudeUnit::Dbm,
            rbw_hz: None,
        }))
    }
    fn stop(&mut self) -> Result<(), SourceError> {
        Ok(())
    }
}

struct Handle(Arc<PortDriver>);

impl SourceDriver for Handle {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: "port".into(),
            name: "Port analyzer".into(),
            description: String::new(),
            kind: SourceKind::SpectrumAnalyzer,
            transport: Transport::Serial,
            status: DriverStatus::Available,
            supports_discovery: false,
            connection_params: vec![ParamSpec {
                id: "port".into(),
                label: "Port".into(),
                group: None,
                help: None,
                kind: ParamKind::Text { max_length: 64 },
                default: ParamValue::Text(String::new()),
                required: false,
            }],
        }
    }

    fn open(&self, _config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        let this = &self.0;
        this.opens.fetch_add(1, Ordering::SeqCst);
        let _ = this.started.lock().unwrap().send(());
        match &*this.mode.lock().unwrap() {
            Mode::Ok => {}
            Mode::Fail(m) => return Err(SourceError::unavailable(*m)),
            Mode::Block(rx) => {
                let _ = rx.recv_timeout(WAIT);
            }
            Mode::Sleep(d) => std::thread::sleep(*d),
        }
        Ok(OpenedSource {
            source: Box::new(IdleSource {
                caps: Capabilities {
                    data_kind: DataKind::Trace,
                    tuning: None,
                    span_options_hz: vec![],
                    amplitude_unit: AmplitudeUnit::Dbm,
                    params: vec![],
                },
                settings: SourceSettings {
                    center_hz: 1e9,
                    span_hz: 4e6,
                    params: Default::default(),
                },
            }),
            label: "Port 42".into(),
            simulated: false,
            device_id: Some("42".into()),
            connection: ParamMap::new(),
        })
    }
}

struct Fixture {
    driver: Arc<PortDriver>,
    session: Arc<SessionManager>,
    started: Receiver<()>,
}

fn fixture(mode: Mode, timeout: Duration) -> Fixture {
    let (tx, started) = mpsc::channel();
    let driver = Arc::new(PortDriver {
        mode: Mutex::new(mode),
        opens: AtomicUsize::new(0),
        started: Mutex::new(tx),
    });
    let mut registry = DriverRegistry::new();
    registry.register(Handle(driver.clone()));
    registry.register(SimulatorDriver::new());
    for planned in planned_drivers() {
        registry.register(planned);
    }
    let session = SessionManager::new(registry, Arc::new(NullSink), ProcessingSettings::default())
        .with_probe_timeout(timeout);
    Fixture {
        driver,
        session: Arc::new(session),
        started,
    }
}

fn port(value: &str) -> ParamMap {
    ParamMap::from([("port".to_string(), ParamValue::Text(value.into()))])
}

fn opens(f: &Fixture) -> usize {
    f.driver.opens.load(Ordering::SeqCst)
}

fn spawn_test(f: &Fixture, value: &str) -> std::thread::JoinHandle<SourceTestResult> {
    let (s, v) = (f.session.clone(), value.to_string());
    std::thread::spawn(move || s.test_source("port", port(&v)).unwrap())
}

fn eventually(what: &str, pred: impl Fn() -> bool) {
    let end = Instant::now() + WAIT;
    while !pred() {
        assert!(Instant::now() < end, "timed out waiting for {what}");
        std::thread::sleep(Duration::from_millis(5));
    }
}

#[test]
fn ok_result_carries_identity_and_label() {
    let f = fixture(Mode::Ok, WAIT);
    let r = f.session.test_source("port", port("/dev/ttyACM0")).unwrap();
    assert!(r.ok && !r.in_use);
    assert_eq!(r.message, "Connection OK. Port analyzer found.");
    assert_eq!(r.device_id.as_deref(), Some("42"));
    assert_eq!(r.label.as_deref(), Some("Port 42"));
    assert_eq!(f.session.status().state, SessionState::Disconnected);
}

#[test]
fn driver_error_is_reported_verbatim() {
    let f = fixture(Mode::Fail("Nothing answers on that port."), WAIT);
    let r = f.session.test_source("port", port("/dev/x")).unwrap();
    assert!(!r.ok && !r.in_use);
    assert_eq!(r.message, "Nothing answers on that port.");
    assert_eq!((r.device_id, r.label), (None, None));
}

#[test]
fn unknown_planned_and_invalid_arguments_are_errors() {
    let f = fixture(Mode::Ok, WAIT);
    assert!(matches!(
        f.session.test_source("nope", ParamMap::new()),
        Err(SessionError::Source(e)) if e.kind() == SourceErrorKind::Unsupported
    ));
    let planned = planned_drivers().remove(0).info().id;
    assert!(f.session.test_source(&planned, ParamMap::new()).is_err());
    let too_long = port(&"x".repeat(200));
    assert!(matches!(
        f.session.test_source("port", too_long),
        Err(SessionError::Invalid(_))
    ));
    assert_eq!(opens(&f), 0);
}

#[test]
fn the_active_sources_port_is_in_use_and_not_opened_again() {
    let f = fixture(Mode::Ok, WAIT);
    let mut config = SourceConfig::new("port");
    config.connection = port("/dev/ttyACM0");
    f.session.connect(config).unwrap();
    assert_eq!(opens(&f), 1);

    let r = f.session.test_source("port", port("/dev/ttyACM0")).unwrap();
    assert!(!r.ok && r.in_use);
    assert_eq!(
        r.message,
        "/dev/ttyACM0 is in use by the active source. Stop and disconnect it first."
    );
    assert_eq!(opens(&f), 1);

    // A different port is tested normally while connected.
    let other = f.session.test_source("port", port("/dev/ttyACM1")).unwrap();
    assert!(other.ok);
    assert_eq!(opens(&f), 2);
    assert_eq!(f.session.status().state, SessionState::Connected);
    f.session.disconnect();
}

#[test]
fn busy_while_a_connection_is_in_progress() {
    let (release, rx) = mpsc::channel();
    let f = fixture(Mode::Block(rx), WAIT);
    let s = f.session.clone();
    let mut config = SourceConfig::new("port");
    config.connection = port("/dev/a");
    let connecting = std::thread::spawn(move || s.connect(config));
    eventually("the session to be connecting", || {
        f.session.status().state == SessionState::Connecting
    });

    let r = f.session.test_source("port", port("/dev/b")).unwrap();
    assert!(!r.ok && !r.in_use);
    assert_eq!(
        r.message,
        "Busy: a connection is in progress. Try again in a moment."
    );
    assert_eq!(opens(&f), 1);
    release.send(()).unwrap();
    connecting.join().unwrap().unwrap();
    f.session.disconnect();
}

#[test]
fn a_second_concurrent_test_is_busy() {
    let (release, rx) = mpsc::channel();
    let f = fixture(Mode::Block(rx), WAIT);
    let first = spawn_test(&f, "/dev/a");
    f.started.recv_timeout(WAIT).unwrap();

    let second = f.session.test_source("port", port("/dev/b")).unwrap();
    assert!(!second.ok);
    assert!(second.message.starts_with("Busy:"));
    assert_eq!(opens(&f), 1);

    release.send(()).unwrap();
    assert!(first.join().unwrap().ok);
}

#[test]
fn a_silent_device_times_out_and_the_abandoned_open_cleans_up() {
    let f = fixture(
        Mode::Sleep(Duration::from_millis(400)),
        Duration::from_millis(50),
    );
    let r = f.session.test_source("port", port("/dev/a")).unwrap();
    assert!(!r.ok && !r.in_use);
    assert_eq!(r.message, "The device did not answer in time.");

    // Still busy while the abandoned open runs, then free again.
    let busy = f.session.test_source("port", port("/dev/a")).unwrap();
    assert!(busy.message.starts_with("Busy:"));
    *f.driver.mode.lock().unwrap() = Mode::Ok;
    eventually("the abandoned open to finish", || {
        f.session
            .test_source("port", port("/dev/a"))
            .unwrap()
            .message
            .starts_with("Connection OK")
    });
}

#[test]
fn a_test_leaves_the_session_alone_and_other_acquisition_running() {
    let f = fixture(Mode::Ok, WAIT);
    let before = f.session.status();
    f.session.test_source("port", port("/dev/a")).unwrap();
    assert_eq!(f.session.status().revision, before.revision);

    f.session
        .connect(SourceConfig::new(simulator::DRIVER_ID))
        .unwrap();
    f.session.start().unwrap();
    let seq = f
        .session
        .wait_frame(0, WAIT)
        .expect("a frame before the test")
        .frame
        .header
        .seq;
    let r = f.session.test_source("port", port("/dev/a")).unwrap();
    assert!(r.ok);
    let later = f
        .session
        .wait_frame(seq, WAIT)
        .expect("frames keep coming during and after the test");
    assert!(later.frame.header.seq > seq);
    assert_eq!(f.session.status().state, SessionState::Acquiring);
    f.session.disconnect();
}
