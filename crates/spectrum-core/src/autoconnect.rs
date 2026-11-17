//! Auto-connect: connects the first device found at launch, and a device plugged in while no source
//! is connected. Nothing here names a device type. Drivers that can watch report hot-plug events
//! through [`SourceDriver::watch`](crate::sources::SourceDriver::watch).
//!
//! [`Policy`] holds the rules and is synchronous, so tests drive it directly. [`AutoConnect`] runs
//! it: one coordinator thread makes every decision in order, and one watcher thread per watching
//! driver only forwards events. See ADR 0014.

use std::ops::ControlFlow;
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use crate::model::{DeviceDescriptor, SessionState};
use crate::remember;
use crate::session::{SessionManager, error_chain};
use crate::sources::{DeviceEvent, SourceDriver};
use crate::store::ConfigStore;

/// The auto-connect rules. Cheap to clone; clones share the shutdown flag.
#[derive(Clone)]
pub struct Policy {
    session: Arc<SessionManager>,
    store: Arc<ConfigStore>,
    stopped: Arc<AtomicBool>,
}

impl Policy {
    pub fn new(session: Arc<SessionManager>, store: Arc<ConfigStore>) -> Self {
        Self {
            session,
            store,
            stopped: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Launch rule: when nothing is connected, connects the first device discovered (registry
    /// order, then the driver's own order). The simulator is never discovered, so never chosen. A
    /// driver whose scan failed is skipped; the scan has already logged why.
    pub fn launch(&self) {
        if self.is_stopped() || !self.is_idle() {
            return;
        }
        let first = self
            .session
            .discover_all()
            .into_iter()
            .filter(|result| result.error.is_none())
            .flat_map(|result| result.devices)
            .next();
        match first {
            Some(device) => self.connect(&device),
            None => tracing::debug!("no device found at launch; nothing to auto-connect"),
        }
    }

    /// Reacts to a hot-plug event from driver `driver_id`.
    ///
    /// `Added` connects the device at the reported location, unless a source is connected or
    /// acquiring. A connect in flight (`Connecting`, or a manual one that may yet fail) does not
    /// stop it: the attempt goes through `connect_if_idle`, which waits for that connect and then
    /// connects only if it failed. The location is resolved with an enumerate-only scan; an event
    /// with no location, or no matching device, does nothing. `Removed` closes the active source
    /// when it is that device. Neither retries: a failed attempt waits for the next event.
    pub fn on_event(&self, driver_id: &str, event: &DeviceEvent) {
        if self.is_stopped() {
            return;
        }
        match event {
            DeviceEvent::Added { location } => {
                let Some(location) = location.as_deref() else {
                    tracing::debug!(
                        driver = driver_id,
                        "device added without a location; ignored"
                    );
                    return;
                };
                if self.has_active_source() {
                    return;
                }
                let devices = match self.session.discover(driver_id) {
                    Ok(devices) => devices,
                    Err(e) => {
                        tracing::warn!(driver = driver_id, error = %error_chain(&e), "scan after a plug-in failed");
                        return;
                    }
                };
                match devices
                    .into_iter()
                    .find(|d| d.location.as_deref() == Some(location))
                {
                    Some(device) => self.connect(&device),
                    None => tracing::info!(
                        driver = driver_id,
                        location,
                        "no device at the reported location; not auto-connecting"
                    ),
                }
            }
            DeviceEvent::Removed { location } => {
                if let Some(location) = location {
                    self.session.device_removed(driver_id, location);
                }
            }
        }
    }

    /// Stops reacting to events. Events that arrive later are ignored.
    pub fn shutdown(&self) {
        self.stopped.store(true, Ordering::Release);
    }

    pub fn is_stopped(&self) -> bool {
        self.stopped.load(Ordering::Acquire)
    }

    fn is_idle(&self) -> bool {
        self.session.status().state == SessionState::Disconnected
    }

    /// A source is open. Only then does a plug-in leave the device alone; a connect in flight is
    /// not a source yet (see `on_event`).
    fn has_active_source(&self) -> bool {
        matches!(
            self.session.status().state,
            SessionState::Connected | SessionState::Acquiring
        )
    }

    fn connect(&self, device: &DeviceDescriptor) {
        match remember::auto_connect(&self.session, &self.store, device) {
            Ok(Some(_)) => tracing::info!(device = %device.label, "auto-connected"),
            Ok(None) => {
                tracing::debug!(device = %device.label, "a source is connected; not auto-connecting")
            }
            // The session has already set the same ConnectFailed notice as a manual connect.
            Err(e) => {
                tracing::warn!(device = %device.label, error = %error_chain(&e), "auto-connect failed")
            }
        }
    }
}

/// How long [`AutoConnect::shutdown`] waits for stoppable watchers to end, in total. A watcher that
/// is still running after this is left detached, as one without a stop; the process end reclaims it.
const WATCHER_STOP_TIMEOUT: Duration = Duration::from_secs(1);

/// Running auto-connect: the watchers and the coordinator thread.
pub struct AutoConnect {
    policy: Policy,
    watchers: Mutex<Vec<Watcher>>,
}

/// One watcher thread, and what shutdown needs to end it.
struct Watcher {
    driver: Arc<dyn SourceDriver>,
    stoppable: bool,
    thread: JoinHandle<()>,
    /// Disconnected once the thread has ended: the thread holds the sender until then.
    done: Receiver<()>,
}

impl AutoConnect {
    /// Starts one watcher per watching driver, then the coordinator, which performs the launch
    /// connect and then handles events. Events raised while the launch connect runs wait in the
    /// channel, so no plug-in is lost.
    pub fn start(session: Arc<SessionManager>, store: Arc<ConfigStore>) -> Self {
        let policy = Policy::new(session.clone(), store);
        let (tx, rx) = mpsc::channel();
        let watchers = session
            .watchable_drivers()
            .into_iter()
            .filter_map(|driver| spawn_watcher(policy.clone(), driver, tx.clone()))
            .collect();
        drop(tx);
        let coordinator = policy.clone();
        let spawned = std::thread::Builder::new()
            .name("auto-connect".into())
            .spawn(move || coordinate(coordinator, rx));
        if let Err(e) = spawned {
            tracing::warn!(error = %e, "could not start auto-connect; connect a device manually");
        }
        Self {
            policy,
            watchers: Mutex::new(watchers),
        }
    }

    /// Stops reacting to device events, then asks every stoppable watcher to end and waits up to
    /// [`WATCHER_STOP_TIMEOUT`] in total for them. Watchers that cannot be stopped, or that do not
    /// end in time, are left detached (see ADR 0014). Calling it again does nothing more.
    pub fn shutdown(&self) {
        self.policy.shutdown();
        let watchers = std::mem::take(&mut *lock(&self.watchers));
        for watcher in watchers.iter().filter(|w| w.stoppable) {
            watcher.driver.stop_watch();
        }
        let deadline = Instant::now() + WATCHER_STOP_TIMEOUT;
        for watcher in watchers.into_iter().filter(|w| w.stoppable) {
            let driver = watcher.driver.info().id;
            match watcher
                .done
                .recv_timeout(deadline.saturating_duration_since(Instant::now()))
            {
                Err(RecvTimeoutError::Disconnected) => {
                    if watcher.thread.join().is_err() {
                        tracing::warn!(driver = %driver, "device watcher panicked while stopping");
                    } else {
                        tracing::debug!(driver = %driver, "device watcher joined at shutdown");
                    }
                }
                _ => tracing::warn!(
                    driver = %driver,
                    "device watcher did not stop in time; leaving it running until the app exits"
                ),
            }
        }
    }
}

fn coordinate(policy: Policy, events: Receiver<(String, DeviceEvent)>) {
    contain("launch", || policy.launch());
    while let Ok((driver_id, event)) = events.recv() {
        if policy.is_stopped() {
            break;
        }
        contain("event", || policy.on_event(&driver_id, &event));
    }
}

fn spawn_watcher(
    policy: Policy,
    driver: Arc<dyn SourceDriver>,
    tx: Sender<(String, DeviceEvent)>,
) -> Option<Watcher> {
    let driver_id = driver.info().id;
    let stoppable = driver.supports_stop_watch();
    let (done_tx, done) = mpsc::channel();
    let watched = driver.clone();
    let name = format!("device-watch-{driver_id}");
    let spawned = std::thread::Builder::new().name(name).spawn(move || {
        // Dropped when this thread ends, on every path including a panic.
        let _done = done_tx;
        let result = watched.watch(&mut |event| {
            if policy.is_stopped() || tx.send((driver_id.clone(), event)).is_err() {
                ControlFlow::Break(())
            } else {
                ControlFlow::Continue(())
            }
        });
        match result {
            Ok(()) => tracing::debug!(driver = %driver_id, "device watcher stopped"),
            Err(e) => tracing::warn!(
                driver = %driver_id,
                error = %error_chain(&e),
                "device watching is unavailable; plug-ins are not detected automatically"
            ),
        }
    });
    match spawned {
        Ok(thread) => Some(Watcher {
            driver,
            stoppable,
            thread,
            done,
        }),
        Err(e) => {
            tracing::warn!(error = %e, "could not start a device watcher");
            None
        }
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Runs one step of the policy, containing a panic so it cannot end the application.
fn contain(step: &str, f: impl FnOnce()) {
    if catch_unwind(AssertUnwindSafe(f)).is_err() {
        tracing::error!("auto-connect {step} failed unexpectedly; the event was ignored");
    }
}
