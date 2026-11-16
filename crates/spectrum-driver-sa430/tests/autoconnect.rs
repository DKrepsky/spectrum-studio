//! Auto-connect with the SA430 driver: a scripted backend replays plug events, and the real
//! auto-connect threads and session connect the analyzer as they would on hardware.
#![allow(clippy::unwrap_used)] // test helpers outside #[test] functions

use std::collections::VecDeque;
use std::io;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use sa430::Sa430;
use sa430::port::Port;
use sa430::test_utils::{MockChannel, add_calibration_responses};
use spectrum_core::autoconnect::AutoConnect;
use spectrum_core::model::{NoticeKind, ProcessingSettings, SessionState, SessionStatus};
use spectrum_core::store::ConfigStore;
use spectrum_core::{DriverRegistry, NullSink, SessionManager};
use spectrum_driver_sa430::{ConnectPolicy, Sa430Backend, Sa430Driver};

const WAIT: Duration = Duration::from_secs(5);
const SN: &str = "08FF41E50F8B3A34";
const PORT: &str = "/dev/ttyACM0";

/// A backend whose ports, connect attempts and plug events the test controls. Each open takes the
/// next scripted link: `Some` answers like an SA430, `None` fails like a port that is not there.
struct Plugged {
    ports: Mutex<Vec<Port>>,
    links: Mutex<VecDeque<Option<MockChannel>>>,
    opens: AtomicUsize,
    scans: AtomicUsize,
    /// Plug events, taken once by the watcher.
    events: Mutex<Option<mpsc::Receiver<sa430::Event>>>,
}

impl Sa430Backend for Plugged {
    fn scan(&self) -> Result<Vec<Port>, sa430::Error> {
        self.scans.fetch_add(1, Ordering::SeqCst);
        Ok(self.ports.lock().unwrap().clone())
    }

    fn open(
        &self,
        _port_name: &str,
        _policy: &ConnectPolicy,
        _deadline: Instant,
        _sweeping: Arc<AtomicBool>,
    ) -> Result<Sa430, sa430::Error> {
        self.opens.fetch_add(1, Ordering::SeqCst);
        match self.links.lock().unwrap().pop_front().flatten() {
            Some(channel) => Ok(Sa430::new(Box::new(channel))),
            None => Err(sa430::Error::Io(io::Error::from(io::ErrorKind::NotFound))),
        }
    }

    fn watch(&self, handler: &mut dyn sa430::EventHandler) -> Result<(), sa430::Error> {
        let Some(events) = self.events.lock().unwrap().take() else {
            return Ok(());
        };
        for event in events {
            if handler.handle(&event).is_break() {
                break;
            }
        }
        Ok(())
    }
}

/// A link that answers the calibration read, so the analyzer identifies itself.
fn calibrated() -> Option<MockChannel> {
    let mut channel = MockChannel::new();
    add_calibration_responses(&mut channel);
    Some(channel)
}

fn analyzer() -> Port {
    Port::new(PORT, Some(SN), Some("0104"))
}

/// A store directory removed when the test ends.
struct StoreDir(PathBuf);

impl StoreDir {
    fn new() -> Self {
        static NEXT: AtomicU32 = AtomicU32::new(0);
        let n = NEXT.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "spectrum-sa430-autoconnect-{}-{n}",
            std::process::id()
        ));
        Self(dir)
    }
}

impl Drop for StoreDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

struct Rig {
    _dir: StoreDir,
    session: Arc<SessionManager>,
    backend: Arc<Plugged>,
    events: Sender<sa430::Event>,
    auto: AutoConnect,
}

fn start(ports: Vec<Port>, links: Vec<Option<MockChannel>>) -> Rig {
    let (events, rx) = mpsc::channel();
    let backend = Arc::new(Plugged {
        ports: Mutex::new(ports),
        links: Mutex::new(links.into()),
        opens: AtomicUsize::new(0),
        scans: AtomicUsize::new(0),
        events: Mutex::new(Some(rx)),
    });
    let mut registry = DriverRegistry::new();
    registry.register(Sa430Driver::with_backend(backend.clone()));
    let session = Arc::new(SessionManager::new(
        registry,
        Arc::new(NullSink),
        ProcessingSettings::default(),
    ));
    let dir = StoreDir::new();
    let store = Arc::new(ConfigStore::open(&dir.0));
    let auto = AutoConnect::start(session.clone(), store);
    Rig {
        _dir: dir,
        session,
        backend,
        events,
        auto,
    }
}

fn wait_until_scanned(r: &Rig, scans: usize) {
    let deadline = Instant::now() + WAIT;
    while r.backend.scans.load(Ordering::SeqCst) < scans {
        assert!(Instant::now() < deadline, "the launch scan never ran");
        std::thread::sleep(Duration::from_millis(5));
    }
    // The scan is done; give the coordinator a moment to act on its result.
    std::thread::sleep(Duration::from_millis(50));
}

fn wait_until(session: &SessionManager, what: &str, pred: impl Fn(&SessionStatus) -> bool) {
    let deadline = Instant::now() + WAIT;
    loop {
        let status = session.status();
        if pred(&status) {
            return;
        }
        assert!(
            Instant::now() < deadline,
            "timed out waiting for {what}: {status:?}"
        );
        std::thread::sleep(Duration::from_millis(5));
    }
}

#[test]
fn plugging_in_an_analyzer_connects_it_paused() {
    let r = start(vec![], vec![calibrated()]);
    // Wait for the launch scan to find nothing, so the plug-in is what connects.
    wait_until_scanned(&r, 1);
    assert_eq!(r.session.status().state, SessionState::Disconnected);
    *r.backend.ports.lock().unwrap() = vec![analyzer()];
    r.events
        .send(sa430::Event::DeviceAdded(analyzer()))
        .unwrap();

    wait_until(&r.session, "the plug-in connect", |s| {
        s.state == SessionState::Connected
    });
    let status = r.session.status();
    assert_eq!(
        status.state,
        SessionState::Connected,
        "paused, not acquiring"
    );
    assert!(status.last_notice.is_none());
    let source = status.source.expect("connected");
    assert_eq!(source.device_label, format!("SA430 {SN}"));
    assert_eq!(source.config.device_id.as_deref(), Some(SN));
    r.auto.shutdown();
}

#[test]
fn unplugging_the_connected_analyzer_disconnects_with_device_lost() {
    let r = start(vec![analyzer()], vec![calibrated(), calibrated()]);
    wait_until(&r.session, "the launch connect", |s| {
        s.state == SessionState::Connected
    });

    r.events
        .send(sa430::Event::DeviceRemoved(analyzer()))
        .unwrap();
    wait_until(&r.session, "the unplug", |s| {
        s.state == SessionState::Disconnected
    });
    let status = r.session.status();
    assert!(status.source.is_none());
    let notice = status.last_notice.expect("a notice");
    assert_eq!(notice.kind, NoticeKind::DeviceLost);
    assert_eq!(notice.message, format!("SA430 {SN} was unplugged."));

    // Plugged back in: connected again.
    r.events
        .send(sa430::Event::DeviceAdded(analyzer()))
        .unwrap();
    wait_until(&r.session, "the re-plug connect", |s| {
        s.state == SessionState::Connected
    });
    r.auto.shutdown();
}

#[test]
fn a_failed_connect_is_reported_once_and_a_later_plug_in_connects() {
    // The analyzer is there at launch but its first connect fails (busy port, say).
    let r = start(vec![analyzer()], vec![None, calibrated()]);
    wait_until(&r.session, "the failure notice", |s| {
        s.last_notice.as_ref().map(|n| n.kind) == Some(NoticeKind::ConnectFailed)
    });
    let status = r.session.status();
    assert_eq!(status.state, SessionState::Disconnected);
    assert!(
        status
            .last_notice
            .unwrap()
            .message
            .contains("Could not open")
    );
    assert_eq!(
        r.backend.opens.load(Ordering::SeqCst),
        1,
        "no retry of its own"
    );

    // Sentinel: an unrelated plug-in. The launch scan is the first, this scan the second; once it
    // has run, any retry triggered by the failure would already have opened the port.
    r.events
        .send(sa430::Event::DeviceAdded(Port::new(
            "/dev/ttyUNRELATED",
            None,
            None,
        )))
        .unwrap();
    let deadline = Instant::now() + WAIT;
    while r.backend.scans.load(Ordering::SeqCst) < 2 {
        assert!(
            Instant::now() < deadline,
            "the sentinel plug-in was never scanned"
        );
        std::thread::sleep(Duration::from_millis(5));
    }
    assert_eq!(
        r.backend.opens.load(Ordering::SeqCst),
        1,
        "no retry of its own"
    );

    r.events
        .send(sa430::Event::DeviceAdded(analyzer()))
        .unwrap();
    wait_until(&r.session, "the second connect", |s| {
        s.state == SessionState::Connected
    });
    assert_eq!(r.backend.opens.load(Ordering::SeqCst), 2);
    r.auto.shutdown();
}
