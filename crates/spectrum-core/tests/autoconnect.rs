//! Auto-connect against a scripted hot-plug driver: the policy rules (driven directly), the
//! session guards it relies on, and the watcher threads around it.
#![allow(clippy::unwrap_used)] // test helpers outside #[test] functions

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use spectrum_core::autoconnect::{AutoConnect, Policy};
use spectrum_core::model::{
    AmplitudeUnit, Capabilities, DataKind, DeviceDescriptor, DriverInfo, DriverStatus, NoticeKind,
    ParamKind, ParamMap, ParamSpec, ParamValue, ProcessingSettings, SessionState, SessionStatus,
    SettingsPatch, SourceConfig, SourceKind, SourceSettings, Transport,
};
use spectrum_core::remember::connect_new;
use spectrum_core::sources::simulator::{self, SimulatorDriver};
use spectrum_core::sources::{
    DeviceEvent, OpenedSource, Source, SourceData, SourceDriver, SourceError, TraceBlock,
};
use spectrum_core::store::ConfigStore;
use spectrum_core::{DriverRegistry, NullSink, SessionManager};
use std::ops::ControlFlow;

const WAIT: Duration = Duration::from_secs(5);
const DRIVER: &str = "fake";

/// What the scripted driver does, shared with the test so it can be scripted and inspected.
#[derive(Default)]
struct Bench {
    devices: Mutex<Vec<DeviceDescriptor>>,
    discover_fails: AtomicBool,
    /// `discover` panics, as a buggy driver would.
    discover_panics: AtomicBool,
    /// Opens attempted so far (successful or not).
    opens: AtomicUsize,
    /// Upcoming opens that fail as a busy port would.
    failing_opens: AtomicUsize,
    /// Holds the next `open` call (if set) until the test releases it, as a slow port would.
    open_gate: Mutex<Option<Gate>>,
    /// `watch` returns an error at once (no udev, say).
    watch_fails: AtomicBool,
    /// Set when `watch` has returned, for whatever reason.
    watch_returned: AtomicBool,
    /// Scans run so far, so a test can tell that the coordinator handled an event.
    discovers: AtomicUsize,
    /// Holds the next `discover` call (if set) until the test releases it.
    discover_gate: Mutex<Option<Gate>>,
    /// Makes `supports_stop_watch` false: the watcher stays detached at shutdown.
    unstoppable: AtomicBool,
    /// Makes `stop_watch` do nothing, as a watch that never wakes would.
    stop_ignored: AtomicBool,
    /// `stop_watch` calls so far.
    stop_requests: AtomicUsize,
    /// Set by `stop_watch`; a watch returns once it sees it.
    stop_requested: AtomicBool,
    /// Set once `watch` is in its event loop.
    watch_started: AtomicBool,
    /// Parks `watch` before its event loop until released, so a stop can come first.
    watch_gate: Mutex<Option<Gate>>,
}

/// Parks the driver call that takes it: it tells the test it arrived, then waits for release.
struct Gate {
    entered: Sender<()>,
    release: Receiver<()>,
}

/// How often a watch checks for a stop request while no event arrives.
const STOP_POLL: Duration = Duration::from_millis(20);

fn pass_gate(gate: &Mutex<Option<Gate>>) {
    let taken = gate.lock().unwrap().take();
    if let Some(gate) = taken {
        let _ = gate.entered.send(());
        let _ = gate.release.recv();
    }
}

struct Hardware {
    bench: Arc<Bench>,
    events: Mutex<Option<mpsc::Receiver<DeviceEvent>>>,
}

fn caps(params: Vec<ParamSpec>) -> Capabilities {
    Capabilities {
        data_kind: DataKind::Trace,
        tuning: Some(spectrum_core::model::FrequencyRange {
            min_hz: 1e6,
            max_hz: 6e9,
        }),
        span_options_hz: vec![1e6, 2e6],
        amplitude_unit: AmplitudeUnit::Dbm,
        params,
    }
}

struct TraceSource {
    caps: Capabilities,
    settings: SourceSettings,
}

impl Source for TraceSource {
    fn capabilities(&self) -> &Capabilities {
        &self.caps
    }

    fn settings(&self) -> &SourceSettings {
        &self.settings
    }

    fn apply(&mut self, patch: &SettingsPatch) -> Result<(), SourceError> {
        if let Some(center) = patch.center_hz {
            self.settings.center_hz = center;
        }
        if let Some(span) = patch.span_hz {
            self.settings.span_hz = span;
        }
        Ok(())
    }

    fn start(&mut self) -> Result<(), SourceError> {
        Ok(())
    }

    fn read(&mut self, _samples_wanted: usize) -> Result<SourceData, SourceError> {
        thread::sleep(Duration::from_millis(20));
        Ok(SourceData::Trace(TraceBlock {
            values: vec![-90.0; 8],
            start_hz: self.settings.center_hz - self.settings.span_hz / 2.0,
            bin_hz: self.settings.span_hz / 8.0,
            unit: AmplitudeUnit::Dbm,
            rbw_hz: None,
        }))
    }

    fn stop(&mut self) -> Result<(), SourceError> {
        Ok(())
    }
}

impl SourceDriver for Hardware {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: DRIVER.into(),
            name: "Fake analyzer".into(),
            description: String::new(),
            kind: SourceKind::SpectrumAnalyzer,
            transport: Transport::Usb,
            status: DriverStatus::Available,
            supports_discovery: true,
            connection_params: vec![ParamSpec {
                id: "port".into(),
                label: "Port".into(),
                group: None,
                help: None,
                kind: ParamKind::Text { max_length: 256 },
                default: ParamValue::Text(String::new()),
                required: false,
                placement: spectrum_core::model::ParamPlacement::Source,
            }],
        }
    }

    fn discover(&self) -> Result<Vec<DeviceDescriptor>, SourceError> {
        self.bench.discovers.fetch_add(1, Ordering::SeqCst);
        pass_gate(&self.bench.discover_gate);
        if self.bench.discover_panics.load(Ordering::SeqCst) {
            panic!("scripted driver bug");
        }
        if self.bench.discover_fails.load(Ordering::SeqCst) {
            return Err(SourceError::unavailable("Could not search for devices."));
        }
        Ok(self.bench.devices.lock().unwrap().clone())
    }

    fn open(&self, config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        self.bench.opens.fetch_add(1, Ordering::SeqCst);
        pass_gate(&self.bench.open_gate);
        if self.bench.failing_opens.load(Ordering::SeqCst) > 0 {
            self.bench.failing_opens.fetch_sub(1, Ordering::SeqCst);
            return Err(SourceError::unavailable("The port is busy."));
        }
        let devices = self.bench.devices.lock().unwrap();
        let device = devices
            .iter()
            .find(|d| {
                config
                    .device_id
                    .as_deref()
                    .is_none_or(|id| id == d.device_id)
            })
            .ok_or_else(|| SourceError::unavailable("No device is attached."))?;
        let location = device.location.clone().unwrap_or_default();
        Ok(OpenedSource {
            source: Box::new(TraceSource {
                caps: caps(vec![]),
                settings: SourceSettings {
                    center_hz: 100e6,
                    span_hz: 1e6,
                    params: ParamMap::new(),
                },
            }),
            label: format!("Fake {}", device.device_id),
            simulated: false,
            device_id: Some(device.device_id.clone()),
            connection: [("port".to_string(), ParamValue::Text(location))].into(),
        })
    }

    fn supports_watch(&self) -> bool {
        true
    }

    fn watch(
        &self,
        on_event: &mut dyn FnMut(DeviceEvent) -> ControlFlow<()>,
    ) -> Result<(), SourceError> {
        let result = (|| {
            pass_gate(&self.bench.watch_gate);
            if self.bench.watch_fails.load(Ordering::SeqCst) {
                return Err(SourceError::unavailable("No device events on this system."));
            }
            let rx = self.events.lock().unwrap().take().expect("watched once");
            self.bench.watch_started.store(true, Ordering::SeqCst);
            loop {
                if self.bench.stop_requested.load(Ordering::SeqCst) {
                    break;
                }
                match rx.recv_timeout(STOP_POLL) {
                    Ok(event) => {
                        if on_event(event).is_break() {
                            break;
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
            Ok(())
        })();
        self.bench.watch_returned.store(true, Ordering::SeqCst);
        result
    }

    fn supports_stop_watch(&self) -> bool {
        !self.bench.unstoppable.load(Ordering::SeqCst)
    }

    fn stop_watch(&self) {
        self.bench.stop_requests.fetch_add(1, Ordering::SeqCst);
        if !self.bench.stop_ignored.load(Ordering::SeqCst) {
            self.bench.stop_requested.store(true, Ordering::SeqCst);
        }
    }
}

fn device(id: &str, location: &str) -> DeviceDescriptor {
    DeviceDescriptor {
        driver_id: DRIVER.into(),
        device_id: id.into(),
        label: format!("Fake {id}"),
        location: Some(location.into()),
        details: vec![],
    }
}

fn added(location: &str) -> DeviceEvent {
    DeviceEvent::Added {
        location: Some(location.into()),
    }
}

fn removed(location: &str) -> DeviceEvent {
    DeviceEvent::Removed {
        location: Some(location.into()),
    }
}

struct Rig {
    _dir: tempfile::TempDir,
    session: Arc<SessionManager>,
    store: Arc<ConfigStore>,
    bench: Arc<Bench>,
    policy: Policy,
    /// Feeds the watcher thread of the hardware driver.
    events: Sender<DeviceEvent>,
}

/// A session with the scripted hardware (when `hardware`) and the simulator, a fresh store and a
/// policy over them.
fn rig(devices: Vec<DeviceDescriptor>, hardware: bool) -> Rig {
    build_rig(devices, hardware, true)
}

/// Like [`rig`], without the simulator driver (a build that ships none).
fn rig_without_simulator(devices: Vec<DeviceDescriptor>) -> Rig {
    build_rig(devices, true, false)
}

fn build_rig(devices: Vec<DeviceDescriptor>, hardware: bool, simulator: bool) -> Rig {
    let dir = tempfile::tempdir().unwrap();
    let bench = Arc::new(Bench::default());
    *bench.devices.lock().unwrap() = devices;
    let (events, rx) = mpsc::channel();
    let mut registry = DriverRegistry::new();
    if simulator {
        registry.register(SimulatorDriver::unpaced());
    }
    if hardware {
        registry.register(Hardware {
            bench: bench.clone(),
            events: Mutex::new(Some(rx)),
        });
    }
    let session = Arc::new(SessionManager::new(
        registry,
        Arc::new(NullSink),
        ProcessingSettings::default(),
    ));
    let store = Arc::new(ConfigStore::open(dir.path()));
    let policy = Policy::new(session.clone(), store.clone());
    Rig {
        _dir: dir,
        session,
        store,
        bench,
        policy,
        events,
    }
}

fn hardware_rig(devices: Vec<DeviceDescriptor>) -> Rig {
    rig(devices, true)
}

fn notice_kind(status: &SessionStatus) -> Option<NoticeKind> {
    status.last_notice.as_ref().map(|n| n.kind)
}

fn source_device(status: &SessionStatus) -> Option<String> {
    status.source.as_ref()?.config.device_id.clone()
}

/// Waits until the coordinator has scanned `count` times in total. Events are handled in order, so
/// once an event that scans has been counted, every event sent before it has been handled too.
fn wait_for_scans(r: &Rig, count: usize) {
    wait_for("the coordinator to scan", || {
        r.bench.discovers.load(Ordering::SeqCst) >= count
    });
}

fn wait_for(what: &str, cond: impl Fn() -> bool) {
    let start = Instant::now();
    while !cond() {
        assert!(start.elapsed() < WAIT, "timed out waiting for {what}");
        thread::sleep(Duration::from_millis(10));
    }
}

// ---- policy: launch ----

#[test]
fn launch_connects_the_first_device_paused_and_remembers_it() {
    let r = hardware_rig(vec![device("a", "/dev/a"), device("b", "/dev/b")]);
    r.policy.launch();

    let status = r.session.status();
    assert_eq!(
        status.state,
        SessionState::Connected,
        "paused, not acquiring"
    );
    assert_eq!(source_device(&status).as_deref(), Some("a"));
    assert!(status.last_notice.is_none());
    let saved = r.store.sources_all();
    assert_eq!(saved.len(), 1);
    assert_eq!(
        r.store.preferences().last_source_id,
        Some(saved[0].id.clone())
    );
}

#[test]
fn launch_with_no_device_connects_the_idle_simulator_and_remembers_it() {
    let r = hardware_rig(vec![]);
    r.policy.launch();

    let status = r.session.status();
    assert_eq!(
        status.state,
        SessionState::Connected,
        "the simulator is selected"
    );
    assert_ne!(
        status.state,
        SessionState::Acquiring,
        "nothing starts acquisition"
    );
    let source = status.source.as_ref().expect("connected");
    assert_eq!(source.config.driver_id, simulator::DRIVER_ID);
    assert!(source.simulated);
    assert!(status.last_notice.is_none());
    assert_eq!(
        r.bench.opens.load(Ordering::SeqCst),
        0,
        "the hardware is not opened"
    );

    let saved = r.store.sources_all();
    assert_eq!(saved.len(), 1);
    assert_eq!(saved[0].config.driver_id, simulator::DRIVER_ID);
    assert_eq!(
        r.store.preferences().last_source_id,
        Some(saved[0].id.clone())
    );
}

#[test]
fn launch_without_any_simulator_driver_connects_nothing() {
    let r = rig_without_simulator(vec![]);
    r.policy.launch();
    let status = r.session.status();
    assert_eq!(status.state, SessionState::Disconnected);
    assert!(status.last_notice.is_none());
    assert!(r.store.sources_all().is_empty());
}

#[test]
fn launch_scan_error_falls_back_to_the_simulator_and_never_opens_the_failed_scan() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.bench.discover_fails.store(true, Ordering::SeqCst);
    r.policy.launch();
    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(
        status.source.as_ref().unwrap().config.driver_id,
        simulator::DRIVER_ID,
        "no device was found, so the simulator is connected"
    );
    assert!(
        status.last_notice.is_none(),
        "a failed scan is silent in the session"
    );
    assert_eq!(
        r.bench.opens.load(Ordering::SeqCst),
        0,
        "a failed scan is never opened"
    );
}

#[test]
fn launch_fallback_applies_the_remembered_simulator_settings() {
    let r = rig(vec![], false);
    // An earlier manual pick of the simulator stored a centre frequency.
    let mut config = SourceConfig::new(simulator::DRIVER_ID);
    config.settings.center_hz = Some(433e6);
    connect_new(&r.session, &r.store, config).unwrap();
    r.session.disconnect();
    r.store.set_last_source_id(None).unwrap();

    r.policy.launch();

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(status.source.as_ref().unwrap().settings.center_hz, 433e6);
    let saved = r.store.sources_all();
    assert_eq!(saved.len(), 1, "the same identity updates its entry");
    assert_eq!(
        r.store.preferences().last_source_id,
        Some(saved[0].id.clone())
    );
}

#[test]
fn launch_with_a_device_does_not_connect_the_simulator() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.policy.launch();
    let status = r.session.status();
    assert_eq!(source_device(&status).as_deref(), Some("a"));
    assert!(!status.source.as_ref().unwrap().simulated);
    assert_eq!(
        r.store.sources_all().len(),
        1,
        "only the device is remembered"
    );
}

#[test]
fn launch_remembers_with_stored_settings_applied() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    // A earlier manual pick stored a centre frequency; the store keeps it.
    let mut config = SourceConfig::new(DRIVER);
    config.device_id = Some("a".into());
    config.settings.center_hz = Some(433e6);
    connect_new(&r.session, &r.store, config).unwrap();
    r.session.disconnect();
    r.store.set_last_source_id(None).unwrap();

    r.policy.launch();

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(status.source.as_ref().unwrap().settings.center_hz, 433e6);
    let saved = r.store.sources_all();
    assert_eq!(saved.len(), 1, "the same identity updates its entry");
    assert_eq!(saved[0].config.settings.center_hz, Some(433e6));
    assert_eq!(
        r.store.preferences().last_source_id,
        Some(saved[0].id.clone())
    );
}

#[test]
fn launch_with_stale_stored_settings_falls_back_to_defaults() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    let mut config = SourceConfig::new(DRIVER);
    config.device_id = Some("a".into());
    let saved = connect_new(&r.session, &r.store, config).unwrap();
    assert_eq!(saved.state, SessionState::Connected);
    r.session.disconnect();
    let id = r.store.sources_all()[0].id.clone();
    // Out of the tuning range now: the device would reject it.
    r.store
        .update_source_settings(
            &id,
            &SourceSettings {
                center_hz: 7e9,
                span_hz: 1e6,
                params: ParamMap::new(),
            },
        )
        .unwrap();

    r.policy.launch();

    let status = r.session.status();
    assert_eq!(
        status.state,
        SessionState::Connected,
        "connected with defaults"
    );
    assert_eq!(status.source.as_ref().unwrap().settings.center_hz, 100e6);
}

#[test]
fn launch_failure_shows_connect_failed_and_remembers_nothing() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.bench.failing_opens.store(1, Ordering::SeqCst);
    r.policy.launch();

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Disconnected);
    assert_eq!(notice_kind(&status), Some(NoticeKind::ConnectFailed));
    assert!(
        status.source.is_none(),
        "no simulator fallback after a device that failed (ADR 0017)"
    );
    assert_eq!(
        status
            .last_config
            .as_ref()
            .and_then(|c| c.device_id.as_deref()),
        Some("a"),
        "the device stays the selection"
    );
    assert!(r.store.sources_all().is_empty());
    assert_eq!(r.store.preferences().last_source_id, None);
    assert_eq!(
        r.bench.opens.load(Ordering::SeqCst),
        1,
        "opened exactly once"
    );
}

// ---- policy: Added ----

#[test]
fn added_connects_the_device_at_the_reported_location_only() {
    let r = hardware_rig(vec![device("a", "/dev/a"), device("b", "/dev/b")]);
    r.policy.on_event(DRIVER, &added("/dev/b"));
    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(source_device(&status).as_deref(), Some("b"));
}

#[test]
fn added_while_a_source_is_connected_changes_nothing() {
    let r = hardware_rig(vec![device("a", "/dev/a"), device("b", "/dev/b")]);
    r.policy.launch();
    r.policy.on_event(DRIVER, &added("/dev/b"));
    assert_eq!(source_device(&r.session.status()).as_deref(), Some("a"));
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 1);
}

#[test]
fn added_replaces_the_idle_simulator_connected_at_launch() {
    let r = hardware_rig(vec![]);
    r.policy.launch();
    *r.bench.devices.lock().unwrap() = vec![device("a", "/dev/a")];

    r.policy.on_event(DRIVER, &added("/dev/a"));

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(source_device(&status).as_deref(), Some("a"));
    assert!(!status.source.as_ref().unwrap().simulated);
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 1);
    assert_eq!(
        r.store.preferences().last_source_id,
        Some(
            r.store
                .sources_all()
                .into_iter()
                .find(|s| s.config.driver_id == DRIVER)
                .expect("the device is remembered")
                .id
        ),
        "the device is now the selection"
    );
}

#[test]
fn added_replaces_an_idle_simulator_picked_manually() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.session
        .connect(SourceConfig::new(simulator::DRIVER_ID))
        .unwrap();

    r.policy.on_event(DRIVER, &added("/dev/a"));

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(source_device(&status).as_deref(), Some("a"));
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 1);
}

#[test]
fn added_while_the_simulator_is_acquiring_changes_nothing() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.session
        .connect(SourceConfig::new(simulator::DRIVER_ID))
        .unwrap();
    r.session.start().unwrap();

    r.policy.on_event(DRIVER, &added("/dev/a"));

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Acquiring, "never interrupted");
    assert_eq!(
        status.source.as_ref().unwrap().config.driver_id,
        simulator::DRIVER_ID
    );
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 0);
    r.session.stop().unwrap();
}

#[test]
fn added_while_a_real_device_is_acquiring_changes_nothing() {
    let r = hardware_rig(vec![device("a", "/dev/a"), device("b", "/dev/b")]);
    r.policy.launch();
    r.session.start().unwrap();

    r.policy.on_event(DRIVER, &added("/dev/b"));

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Acquiring);
    assert_eq!(source_device(&status).as_deref(), Some("a"));
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 1);
    r.session.stop().unwrap();
}

#[test]
fn added_with_an_unknown_or_missing_location_does_nothing() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.policy.on_event(DRIVER, &added("/dev/zzz"));
    r.policy
        .on_event(DRIVER, &DeviceEvent::Added { location: None });
    assert_eq!(r.session.status().state, SessionState::Disconnected);
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 0);
}

#[test]
fn added_failure_shows_connect_failed_and_is_not_retried_by_itself() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.bench.failing_opens.store(1, Ordering::SeqCst);
    r.policy.on_event(DRIVER, &added("/dev/a"));
    assert_eq!(
        notice_kind(&r.session.status()),
        Some(NoticeKind::ConnectFailed)
    );
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 1);

    // Nothing else happens until the next event; that event is the next attempt.
    r.policy.on_event(DRIVER, &removed("/dev/a"));
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 1);

    r.policy.on_event(DRIVER, &added("/dev/a"));
    assert_eq!(r.session.status().state, SessionState::Connected);
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 2);
}

#[test]
fn a_plug_in_after_a_failed_reconnect_connects_and_leaves_no_notice() {
    // R1: connected, unplugged, a manual reconnect fails while the device is absent, then the
    // device comes back. The plug-in connects it and nothing from the failed attempt remains.
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.policy.launch();
    r.policy.on_event(DRIVER, &removed("/dev/a"));
    assert_eq!(
        notice_kind(&r.session.status()),
        Some(NoticeKind::DeviceLost)
    );

    r.bench.failing_opens.store(1, Ordering::SeqCst);
    let failed = r.session.connect(SourceConfig::new(DRIVER));
    assert!(
        failed.is_err(),
        "the reconnect fails while the device is absent"
    );
    assert_eq!(
        notice_kind(&r.session.status()),
        Some(NoticeKind::ConnectFailed)
    );

    r.policy.on_event(DRIVER, &added("/dev/a"));
    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert!(
        status.last_notice.is_none(),
        "the failure is not shown after the connect"
    );
    assert_eq!(source_device(&status).as_deref(), Some("a"));
    assert_eq!(
        r.bench.opens.load(Ordering::SeqCst),
        3,
        "launch, the failed reconnect, then one successful open"
    );
}

#[test]
fn a_plug_in_during_a_failing_manual_connect_connects_once_it_fails() {
    // R2: a manual connect is still opening (state Connecting) when the device is plugged in. The
    // plug-in must not be dropped: once the manual attempt fails, the device connects.
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    let (entered, parked) = mpsc::channel();
    let (release_open, opening) = mpsc::channel();
    *r.bench.open_gate.lock().unwrap() = Some(Gate {
        entered,
        release: opening,
    });
    let (entered_scan, scanning) = mpsc::channel();
    let (release_scan, scan_released) = mpsc::channel();

    let session = r.session.clone();
    let manual = thread::spawn(move || session.connect(SourceConfig::new(DRIVER)));
    parked
        .recv_timeout(WAIT)
        .expect("the manual connect reached open");
    assert_eq!(r.session.status().state, SessionState::Connecting);

    // Only the auto attempt's scan is gated, so reaching it proves it passed the state check.
    r.bench.failing_opens.store(1, Ordering::SeqCst);
    *r.bench.discover_gate.lock().unwrap() = Some(Gate {
        entered: entered_scan,
        release: scan_released,
    });
    let policy = r.policy.clone();
    let auto = thread::spawn(move || policy.on_event(DRIVER, &added("/dev/a")));
    scanning
        .recv_timeout(WAIT)
        .expect("the plug-in was not dropped: its attempt reached the scan");

    release_open.send(()).unwrap();
    assert!(manual.join().unwrap().is_err(), "the manual connect fails");
    release_scan.send(()).unwrap();
    auto.join().unwrap();

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(source_device(&status).as_deref(), Some("a"));
    assert!(status.last_notice.is_none());
    assert_eq!(
        r.bench.opens.load(Ordering::SeqCst),
        2,
        "the failed manual open, then the plug-in's open, which succeeds"
    );
}

#[test]
fn a_successful_manual_connect_during_a_plug_in_is_never_replaced() {
    // R3: as R2, but the manual connect succeeds. The plug-in waits for it and then leaves it.
    let r = hardware_rig(vec![device("a", "/dev/a"), device("b", "/dev/b")]);
    let (entered, parked) = mpsc::channel();
    let (release_open, opening) = mpsc::channel();
    *r.bench.open_gate.lock().unwrap() = Some(Gate {
        entered,
        release: opening,
    });
    let (entered_scan, scanning) = mpsc::channel();
    let (release_scan, scan_released) = mpsc::channel();

    let session = r.session.clone();
    let manual = thread::spawn(move || {
        session.connect(SourceConfig {
            device_id: Some("b".into()),
            ..SourceConfig::new(DRIVER)
        })
    });
    parked
        .recv_timeout(WAIT)
        .expect("the manual connect reached open");
    assert_eq!(r.session.status().state, SessionState::Connecting);

    *r.bench.discover_gate.lock().unwrap() = Some(Gate {
        entered: entered_scan,
        release: scan_released,
    });
    let policy = r.policy.clone();
    let auto = thread::spawn(move || policy.on_event(DRIVER, &added("/dev/a")));
    scanning
        .recv_timeout(WAIT)
        .expect("the plug-in reached its scan while the manual connect was in flight");

    release_open.send(()).unwrap();
    manual.join().unwrap().unwrap();
    release_scan.send(()).unwrap();
    auto.join().unwrap();

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(
        source_device(&status).as_deref(),
        Some("b"),
        "the manual source stays"
    );
    assert_eq!(
        r.bench.opens.load(Ordering::SeqCst),
        1,
        "only the manual connect opened a device"
    );
}

// ---- policy: Removed ----

#[test]
fn removed_while_paused_disconnects_with_device_lost() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.policy.launch();
    r.policy.on_event(DRIVER, &removed("/dev/a"));

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Disconnected);
    assert!(status.source.is_none());
    let notice = status.last_notice.expect("a notice");
    assert_eq!(notice.kind, NoticeKind::DeviceLost);
    assert_eq!(notice.message, "Fake a was unplugged.");
}

#[test]
fn removed_of_another_device_changes_nothing() {
    let r = hardware_rig(vec![device("a", "/dev/a"), device("b", "/dev/b")]);
    r.policy.launch();
    r.policy.on_event(DRIVER, &removed("/dev/b"));
    r.policy
        .on_event(DRIVER, &DeviceEvent::Removed { location: None });
    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(source_device(&status).as_deref(), Some("a"));
    assert!(status.last_notice.is_none());
}

#[test]
fn unplugging_the_device_gives_no_simulator_fallback() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.policy.launch();
    r.policy.on_event(DRIVER, &removed("/dev/a"));

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Disconnected);
    assert!(
        status.source.is_none(),
        "no simulator is connected (ADR 0017)"
    );
    assert_eq!(notice_kind(&status), Some(NoticeKind::DeviceLost));
    assert_eq!(
        status
            .last_config
            .as_ref()
            .and_then(|c| c.device_id.as_deref()),
        Some("a"),
        "the lost device stays the selection"
    );
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 1);
}

#[test]
fn removed_then_added_reconnects_paused() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.policy.launch();
    r.policy.on_event(DRIVER, &removed("/dev/a"));
    r.policy.on_event(DRIVER, &added("/dev/a"));

    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(source_device(&status).as_deref(), Some("a"));
    assert!(
        status.last_notice.is_none(),
        "the new connection clears the old notice"
    );
}

#[test]
fn manual_disconnect_stays_disconnected_until_the_next_added() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.policy.launch();
    r.session.disconnect();
    r.policy.on_event(DRIVER, &removed("/dev/a"));
    let status = r.session.status();
    assert_eq!(status.state, SessionState::Disconnected);
    assert!(
        status.last_notice.is_none(),
        "nothing was lost; the user disconnected"
    );
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 1);

    r.policy.on_event(DRIVER, &added("/dev/a"));
    assert_eq!(r.session.status().state, SessionState::Connected);
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 2);
}

#[test]
fn shutdown_makes_later_events_and_launch_do_nothing() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.policy.shutdown();
    r.policy.launch();
    r.policy.on_event(DRIVER, &added("/dev/a"));
    assert!(r.policy.is_stopped());
    assert_eq!(r.session.status().state, SessionState::Disconnected);
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 0);
}

// ---- session guards ----

#[test]
fn connect_if_idle_leaves_a_connected_device_alone() {
    let r = hardware_rig(vec![device("a", "/dev/a"), device("b", "/dev/b")]);
    r.session
        .connect(SourceConfig {
            device_id: Some("b".into()),
            ..SourceConfig::new(DRIVER)
        })
        .unwrap();

    let outcome = r.session.connect_if_idle(SourceConfig {
        device_id: Some("a".into()),
        ..SourceConfig::new(DRIVER)
    });
    assert!(outcome.unwrap().is_none());
    assert_eq!(source_device(&r.session.status()).as_deref(), Some("b"));
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 1);
}

#[test]
fn connect_if_idle_replaces_an_idle_simulator_with_a_device() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.session
        .connect(SourceConfig::new(simulator::DRIVER_ID))
        .unwrap();

    let status = r
        .session
        .connect_if_idle(SourceConfig {
            device_id: Some("a".into()),
            ..SourceConfig::new(DRIVER)
        })
        .unwrap()
        .expect("replaced");
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(source_device(&status).as_deref(), Some("a"));
}

#[test]
fn connect_if_idle_connects_when_disconnected() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    let status = r
        .session
        .connect_if_idle(SourceConfig {
            device_id: Some("a".into()),
            ..SourceConfig::new(DRIVER)
        })
        .unwrap()
        .expect("connected");
    assert_eq!(status.state, SessionState::Connected);
}

#[test]
fn device_removed_ignores_other_drivers_and_no_source() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    assert!(
        !r.session.device_removed(DRIVER, "/dev/a"),
        "nothing connected"
    );
    r.session
        .connect(SourceConfig::new(simulator::DRIVER_ID))
        .unwrap();
    assert!(
        !r.session.device_removed(DRIVER, "/dev/a"),
        "a different driver"
    );
    assert_eq!(r.session.status().state, SessionState::Connected);
}

#[test]
fn device_removed_while_acquiring_disconnects() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.policy.launch();
    r.session.start().unwrap();
    assert_eq!(r.session.status().state, SessionState::Acquiring);

    assert!(r.session.device_removed(DRIVER, "/dev/a"));
    let status = r.session.status();
    assert_eq!(status.state, SessionState::Disconnected);
    assert_eq!(notice_kind(&status), Some(NoticeKind::DeviceLost));
}

// ---- threads ----

#[test]
fn start_connects_at_launch_and_connects_on_watched_plug_in() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    wait_for("the launch connect", || {
        r.session.status().state == SessionState::Connected
    });
    assert_eq!(source_device(&r.session.status()).as_deref(), Some("a"));

    // Unplugged while paused: the watcher reports it and the session drops the device.
    r.events.send(removed("/dev/a")).unwrap();
    wait_for("the unplug", || {
        r.session.status().state == SessionState::Disconnected
    });
    assert_eq!(
        notice_kind(&r.session.status()),
        Some(NoticeKind::DeviceLost)
    );

    // Plugged back in: connects again without a manual pick.
    r.events.send(added("/dev/a")).unwrap();
    wait_for("the plug-in", || {
        r.session.status().state == SessionState::Connected
    });
    auto.shutdown();
}

/// Waits until the launch rule has finished (`launching` is cleared).
fn wait_for_launch(r: &Rig) {
    wait_for("the launch to finish", || !r.session.status().launching);
}

#[test]
fn a_plug_in_replaces_the_simulator_connected_at_launch() {
    let r = hardware_rig(vec![]);
    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    wait_for("the launch simulator", || {
        let status = r.session.status();
        status.state == SessionState::Connected
            && status.source.as_ref().is_some_and(|s| s.simulated)
    });
    // Only now does the device appear, so the simulator really is the source being replaced.
    *r.bench.devices.lock().unwrap() = vec![device("b", "/dev/b")];
    r.events.send(added("/dev/b")).unwrap();
    wait_for("the plug-in to replace the simulator", || {
        source_device(&r.session.status()).as_deref() == Some("b")
    });
    assert_eq!(r.session.status().state, SessionState::Connected);
    auto.shutdown();
}

#[test]
fn launching_is_true_until_the_launch_rule_has_finished() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    let (entered, parked) = mpsc::channel();
    let (release, released) = mpsc::channel();
    // The launch scan is the first scan: hold it there.
    *r.bench.discover_gate.lock().unwrap() = Some(Gate {
        entered,
        release: released,
    });
    assert!(!r.session.status().launching, "not started yet");

    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    parked
        .recv_timeout(WAIT)
        .expect("the launch rule reached its scan");
    let status = r.session.status();
    assert!(status.launching, "true while the launch rule runs");
    assert_eq!(status.state, SessionState::Disconnected);

    release.send(()).unwrap();
    wait_for_launch(&r);
    let status = r.session.status();
    assert!(!status.launching);
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(source_device(&status).as_deref(), Some("a"));
    auto.shutdown();
}

#[test]
fn launching_is_cleared_even_when_the_launch_rule_panics() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.bench.discover_panics.store(true, Ordering::SeqCst);
    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    wait_for_launch(&r);
    let status = r.session.status();
    assert_eq!(
        status.state,
        SessionState::Disconnected,
        "nothing was connected"
    );
    assert!(!status.launching);
    auto.shutdown();
}

#[test]
fn a_manual_pick_during_a_replacement_is_never_replaced() {
    // The simulator is idle; a plug-in is being scanned when the user picks another device. The
    // replacement that follows must find that device connected and leave it alone.
    let r = hardware_rig(vec![device("a", "/dev/a"), device("b", "/dev/b")]);
    r.session
        .connect(SourceConfig::new(simulator::DRIVER_ID))
        .unwrap();
    let (entered, parked) = mpsc::channel();
    let (release, released) = mpsc::channel();
    *r.bench.discover_gate.lock().unwrap() = Some(Gate {
        entered,
        release: released,
    });

    let policy = r.policy.clone();
    let auto = thread::spawn(move || policy.on_event(DRIVER, &added("/dev/a")));
    parked
        .recv_timeout(WAIT)
        .expect("the replacement reached its scan");

    r.session
        .connect(SourceConfig {
            device_id: Some("b".into()),
            ..SourceConfig::new(DRIVER)
        })
        .unwrap();
    release.send(()).unwrap();
    auto.join().unwrap();

    assert_eq!(source_device(&r.session.status()).as_deref(), Some("b"));
    assert_eq!(
        r.bench.opens.load(Ordering::SeqCst),
        1,
        "only the manual pick opened a device"
    );
}

#[test]
fn a_failed_watched_connect_is_not_retried_by_itself() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.bench.failing_opens.store(1, Ordering::SeqCst);
    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    wait_for("the failure notice", || {
        notice_kind(&r.session.status()) == Some(NoticeKind::ConnectFailed)
    });
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 1);

    // Sentinel: launch scanned once; this unmatched plug-in is the second scan. Once it has been
    // scanned, anything a retry would have done has already happened.
    r.events.send(added("/dev/zzz")).unwrap();
    wait_for_scans(&r, 2);
    assert_eq!(r.session.status().state, SessionState::Disconnected);
    assert_eq!(
        r.bench.opens.load(Ordering::SeqCst),
        1,
        "no retry of its own"
    );
    auto.shutdown();
}

#[test]
fn a_watcher_error_ends_its_thread_and_the_app_carries_on() {
    let r = hardware_rig(vec![device("a", "/dev/a")]);
    r.bench.watch_fails.store(true, Ordering::SeqCst);
    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    wait_for("the watcher to return", || {
        r.bench.watch_returned.load(Ordering::SeqCst)
    });
    // The launch connect still ran.
    wait_for("the launch connect", || {
        r.session.status().state == SessionState::Connected
    });
    // The ended watcher is already gone, so shutdown does not wait for it.
    let started = Instant::now();
    auto.shutdown();
    assert!(started.elapsed() < Duration::from_millis(500));
}

#[test]
fn shutdown_ends_a_blocked_watch_and_joins_its_thread_promptly() {
    let r = hardware_rig(vec![]);
    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    wait_for("the watch to start", || {
        r.bench.watch_started.load(Ordering::SeqCst)
    });
    wait_for_launch(&r);

    let started = Instant::now();
    auto.shutdown();
    let took = started.elapsed();
    // Joined, not detached: the watch has already returned when shutdown does.
    assert!(r.bench.watch_returned.load(Ordering::SeqCst));
    assert!(took < Duration::from_millis(500), "shutdown took {took:?}");
    assert_eq!(r.bench.stop_requests.load(Ordering::SeqCst), 1);
    // Shutdown stops the policy; it does not disconnect the selected simulator.
    assert_eq!(r.session.status().state, SessionState::Connected);
}

#[test]
fn a_stop_requested_before_the_watch_starts_still_ends_it() {
    let r = hardware_rig(vec![]);
    let (entered, parked) = mpsc::channel();
    let (release, released) = mpsc::channel();
    *r.bench.watch_gate.lock().unwrap() = Some(Gate {
        entered,
        release: released,
    });
    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    parked
        .recv_timeout(WAIT)
        .expect("the watch reached its gate, before its loop");

    // Shutdown runs while the watch has not started its loop yet.
    let shutdown = thread::spawn(move || auto.shutdown());
    wait_for("the stop request", || {
        r.bench.stop_requests.load(Ordering::SeqCst) == 1
    });
    release.send(()).unwrap();
    shutdown.join().unwrap();

    assert!(
        r.bench.watch_returned.load(Ordering::SeqCst),
        "the watch returned instead of blocking"
    );
}

#[test]
fn an_unstoppable_watcher_stays_detached_and_ignores_events_after_shutdown() {
    let r = hardware_rig(vec![]);
    r.bench.unstoppable.store(true, Ordering::SeqCst);
    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    wait_for("the watch to start", || {
        r.bench.watch_started.load(Ordering::SeqCst)
    });
    wait_for_launch(&r);
    let before = r.session.status();

    let started = Instant::now();
    auto.shutdown();
    assert!(started.elapsed() < Duration::from_millis(500));
    assert_eq!(r.bench.stop_requests.load(Ordering::SeqCst), 0);
    assert!(!r.bench.watch_returned.load(Ordering::SeqCst));

    // It still ends at its next event, and that event is ignored.
    *r.bench.devices.lock().unwrap() = vec![device("a", "/dev/a")];
    r.events.send(added("/dev/a")).unwrap();
    wait_for("the watcher to return", || {
        r.bench.watch_returned.load(Ordering::SeqCst)
    });
    assert_eq!(
        r.session.status().source,
        before.source,
        "the event changed nothing"
    );
    assert_eq!(r.bench.opens.load(Ordering::SeqCst), 0);
}

#[test]
fn a_watcher_that_ignores_the_stop_is_left_behind_after_a_bounded_wait() {
    let r = hardware_rig(vec![]);
    r.bench.stop_ignored.store(true, Ordering::SeqCst);
    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    wait_for("the watch to start", || {
        r.bench.watch_started.load(Ordering::SeqCst)
    });

    let started = Instant::now();
    auto.shutdown();
    let took = started.elapsed();
    assert!(
        took >= Duration::from_millis(900) && took < Duration::from_secs(3),
        "shutdown waited the bounded time, not {took:?}"
    );
    assert!(!r.bench.watch_returned.load(Ordering::SeqCst));

    // Left running until its next event, which it ignores.
    r.events.send(added("/dev/a")).unwrap();
    wait_for("the watcher to return", || {
        r.bench.watch_returned.load(Ordering::SeqCst)
    });
}

#[test]
fn a_manual_connect_during_an_auto_attempt_is_never_replaced() {
    let r = hardware_rig(vec![device("a", "/dev/a"), device("b", "/dev/b")]);
    let (entered, parked) = mpsc::channel();
    let (release, released) = mpsc::channel();
    *r.bench.discover_gate.lock().unwrap() = Some(Gate {
        entered,
        release: released,
    });

    // The auto attempt reads "disconnected", then is held inside its scan, before it connects.
    let policy = r.policy.clone();
    let auto = thread::spawn(move || policy.on_event(DRIVER, &added("/dev/a")));
    parked
        .recv_timeout(WAIT)
        .expect("the auto attempt reached its scan");

    // The manual connect lands in that window, so the auto connect that follows must find a source.
    r.session
        .connect(SourceConfig {
            device_id: Some("b".into()),
            ..SourceConfig::new(DRIVER)
        })
        .unwrap();
    release.send(()).unwrap();
    auto.join().unwrap();

    assert_eq!(source_device(&r.session.status()).as_deref(), Some("b"));
    assert_eq!(
        r.bench.opens.load(Ordering::SeqCst),
        1,
        "only the manual connect opened a device"
    );
}

#[test]
fn without_a_watchable_driver_nothing_is_watched_and_only_the_simulator_is_connected() {
    let r = rig(vec![device("a", "/dev/a")], false);
    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    wait_for_launch(&r);
    // Nothing is watched. The device is not in the registry, so the simulator is the fallback.
    let status = r.session.status();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(
        status.source.as_ref().unwrap().config.driver_id,
        simulator::DRIVER_ID
    );
    auto.shutdown();
}

#[test]
fn start_without_a_simulator_or_device_leaves_the_session_idle() {
    let r = rig_without_simulator(vec![]);
    let auto = AutoConnect::start(r.session.clone(), r.store.clone());
    wait_for_launch(&r);
    assert_eq!(r.session.status().state, SessionState::Disconnected);
    auto.shutdown();
}
