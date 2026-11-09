//! Acquisition session: owns at most one connected source and its worker thread.
//!
//! All lifecycle operations are serialised. Status changes are pushed to a [`SessionSink`];
//! frames are published to a latest-wins slot that consumers poll with
//! [`SessionManager::wait_frame`], which gives natural back-pressure.

pub mod pipeline;
mod worker;

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::time::Duration;

use thiserror::Error;

use self::worker::{Command, WorkerHandle, notice};
use crate::model::params::resolve_params;
use crate::model::{
    DeviceDescriptor, DiscoveryResult, DriverInfo, DriverStatus, NoticeKind, ParamMap, ParamValue,
    ProcessingSettings, SessionState, SessionStatus, SettingsPatch, SourceConfig, SourceSettings,
    SourceTestResult, SpectrumFrame, Transport,
};
use crate::sources::{DriverRegistry, SourceError, SourceErrorKind};

/// How long to wait for a source to open before giving up.
const OPEN_TIMEOUT: Duration = Duration::from_secs(30);
/// How long to wait for the worker to answer a command.
const COMMAND_TIMEOUT: Duration = Duration::from_secs(10);
/// How long a connection test waits for the device to answer.
const PROBE_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug, Error)]
pub enum SessionError {
    #[error("No source is connected.")]
    NotConnected,
    #[error("{0}")]
    Invalid(String),
    #[error(transparent)]
    Source(#[from] SourceError),
    #[error("The source did not respond in time.")]
    Timeout,
    #[error("Internal error: {0}")]
    Internal(String),
}

/// Receives status updates. Implementations must not block.
pub trait SessionSink: Send + Sync {
    fn status_changed(&self, status: &SessionStatus);
}

/// A sink that ignores updates.
pub struct NullSink;

impl SessionSink for NullSink {
    fn status_changed(&self, _status: &SessionStatus) {}
}

/// A frame together with its binary encoding, produced once on the worker thread.
#[derive(Debug)]
pub struct EncodedFrame {
    pub frame: SpectrumFrame,
    pub bytes: Vec<u8>,
}

pub(crate) struct Shared {
    status: Mutex<SessionStatus>,
    sink: Arc<dyn SessionSink>,
    frame: Mutex<Option<Arc<EncodedFrame>>>,
    frame_ready: Condvar,
    next_seq: AtomicU32,
}

/// Renders an error with its chain of causes for logs, e.g. `Could not open x: Permission denied`.
pub(crate) fn error_chain(error: &dyn std::error::Error) -> String {
    let mut text = error.to_string();
    let mut cause = error.source();
    while let Some(e) = cause {
        text.push_str(": ");
        text.push_str(&e.to_string());
        cause = e.source();
    }
    text
}

/// Clears the connection-test flag when the test thread ends, even by panic.
struct ProbeGuard(Arc<AtomicBool>);

impl Drop for ProbeGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

/// The first non-empty text value present in both maps, if any.
fn shared_text_value<'a>(a: &'a ParamMap, b: &ParamMap) -> Option<&'a str> {
    a.values().find_map(|v| match v {
        ParamValue::Text(t) if !t.is_empty() => b
            .values()
            .any(|w| matches!(w, ParamValue::Text(u) if u == t))
            .then_some(t.as_str()),
        _ => None,
    })
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    // A panic while holding these locks leaves plain data behind; keep going with it.
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl Shared {
    pub(crate) fn update(&self, change: impl FnOnce(&mut SessionStatus)) {
        let snapshot = {
            let mut status = lock(&self.status);
            change(&mut status);
            status.revision = status.revision.wrapping_add(1);
            status.clone()
        };
        self.sink.status_changed(&snapshot);
    }

    pub(crate) fn publish_frame(&self, mut frame: SpectrumFrame) {
        frame.header.seq = self.next_seq.fetch_add(1, Ordering::Relaxed) + 1;
        let bytes = frame.encode();
        *lock(&self.frame) = Some(Arc::new(EncodedFrame { frame, bytes }));
        self.frame_ready.notify_all();
    }

    fn clear_frame(&self) {
        *lock(&self.frame) = None;
    }
}

pub struct SessionManager {
    registry: DriverRegistry,
    shared: Arc<Shared>,
    worker: Mutex<Option<WorkerHandle>>,
    /// Serialises device scans; separate from `worker` so scanning never blocks acquisition.
    scan: Mutex<()>,
    /// Set while a connection test is running (one at a time); cleared by the test's own thread,
    /// so an abandoned (timed-out) open keeps the flag until it has released the device.
    probing: Arc<AtomicBool>,
    probe_timeout: Duration,
}

impl SessionManager {
    pub fn new(
        registry: DriverRegistry,
        sink: Arc<dyn SessionSink>,
        processing: ProcessingSettings,
    ) -> Self {
        let processing = if processing.validate().is_ok() {
            processing
        } else {
            ProcessingSettings::default()
        };
        Self {
            registry,
            shared: Arc::new(Shared {
                status: Mutex::new(SessionStatus::new(processing)),
                sink,
                frame: Mutex::new(None),
                frame_ready: Condvar::new(),
                next_seq: AtomicU32::new(0),
            }),
            worker: Mutex::new(None),
            scan: Mutex::new(()),
            probing: Arc::new(AtomicBool::new(false)),
            probe_timeout: PROBE_TIMEOUT,
        }
    }

    /// Overrides how long [`test_source`](Self::test_source) waits for the device (default 8 s).
    #[must_use]
    pub fn with_probe_timeout(mut self, timeout: Duration) -> Self {
        self.probe_timeout = timeout;
        self
    }

    pub fn status(&self) -> SessionStatus {
        lock(&self.shared.status).clone()
    }

    pub fn drivers(&self) -> Vec<DriverInfo> {
        self.registry.infos()
    }

    pub fn discover(&self, driver_id: &str) -> Result<Vec<DeviceDescriptor>, SessionError> {
        Ok(self.registry.discover(driver_id)?)
    }

    /// Scans every available driver that can enumerate devices (not the built-in simulator). A
    /// failing driver is reported in its result. One scan runs at a time, and the session worker is
    /// never locked, so this cannot stall a running acquisition.
    pub fn discover_all(&self) -> Vec<DiscoveryResult> {
        let _scan = lock(&self.scan);
        self.registry
            .infos()
            .into_iter()
            .filter(|i| {
                i.status == DriverStatus::Available
                    && i.supports_discovery
                    && i.transport != Transport::Internal
            })
            .map(|info| match self.registry.discover(&info.id) {
                Ok(devices) => DiscoveryResult {
                    driver_id: info.id,
                    devices,
                    error: None,
                },
                Err(e) => {
                    tracing::warn!(driver = %info.id, error = %error_chain(&e), "device scan failed");
                    DiscoveryResult {
                        driver_id: info.id,
                        devices: vec![],
                        error: Some(e.to_string()),
                    }
                }
            })
            .collect()
    }

    /// Checks that `connection` reaches a device of `driver_id` without touching the session:
    /// opens it with exactly these parameters (no stored identity), reads its identity and closes
    /// it again. Never changes the session status, takes the worker lock or touches the store.
    ///
    /// Expected failures are `ok: false` results (device error, timeout, busy, port in use by the
    /// active source); only invalid arguments (unknown or unavailable driver, bad parameters)
    /// are errors. One test runs at a time. After a timeout the abandoned open finishes and
    /// drops its source on its own thread.
    pub fn test_source(
        &self,
        driver_id: &str,
        connection: ParamMap,
    ) -> Result<SourceTestResult, SessionError> {
        let driver = self.registry.get(driver_id)?;
        let info = driver.info();
        if info.status != DriverStatus::Available {
            return Err(SourceError::unsupported(format!(
                "{} support is not implemented yet.",
                info.name
            ))
            .into());
        }
        resolve_params(&info.connection_params, &connection).map_err(SessionError::Invalid)?;

        let failure = |message: String, in_use: bool| SourceTestResult {
            ok: false,
            message,
            device_id: None,
            label: None,
            in_use,
        };
        let busy = || {
            failure(
                "Busy: a connection is in progress. Try again in a moment.".into(),
                false,
            )
        };

        let status = self.status();
        match status.state {
            SessionState::Connecting | SessionState::Disconnecting => return Ok(busy()),
            SessionState::Connected | SessionState::Acquiring => {
                if let Some(active) = &status.source
                    && let Some(value) = shared_text_value(&connection, &active.config.connection)
                {
                    return Ok(failure(
                        format!(
                            "{value} is in use by the active source. Stop and disconnect it first."
                        ),
                        true,
                    ));
                }
            }
            SessionState::Disconnected => {}
        }

        if self.probing.swap(true, Ordering::AcqRel) {
            return Ok(busy());
        }
        let release = ProbeGuard(self.probing.clone());
        let config = SourceConfig {
            connection,
            ..SourceConfig::new(driver_id)
        };
        let (tx, rx) = mpsc::channel();
        let spawned = std::thread::Builder::new()
            .name("source-test".into())
            .spawn(move || {
                let _release = release;
                let outcome = driver.open(&config).map(|opened| {
                    let identity = (opened.device_id.clone(), opened.label.clone());
                    // Release the device before reporting, so a follow-up connect finds it free.
                    drop(opened);
                    identity
                });
                let _ = tx.send(outcome);
            });
        if let Err(e) = spawned {
            // The closure (and its guard) was dropped by the failed spawn.
            return Err(SessionError::Internal(format!(
                "could not start the connection test: {e}"
            )));
        }

        let result = match rx.recv_timeout(self.probe_timeout) {
            Ok(Ok((device_id, label))) => SourceTestResult {
                ok: true,
                message: format!("Connection OK. {} found.", info.name),
                device_id,
                label: Some(label),
                in_use: false,
            },
            Ok(Err(e)) => {
                tracing::debug!(driver = %info.id, error = %error_chain(&e), "connection test failed");
                failure(e.message().to_string(), false)
            }
            Err(RecvTimeoutError::Timeout) => {
                tracing::debug!(driver = %info.id, "connection test timed out");
                failure("The device did not answer in time.".into(), false)
            }
            Err(RecvTimeoutError::Disconnected) => {
                tracing::error!(driver = %info.id, "source driver panicked during a connection test");
                failure("The connection test failed unexpectedly.".into(), false)
            }
        };
        Ok(result)
    }

    /// Like [`connect`](Self::connect), but when the source rejects the stored settings
    /// (`InvalidSettings`) and the config had some, retries once with the settings cleared so a
    /// stale remembered setting never makes a source unconnectable.
    pub fn connect_with_default_fallback(
        &self,
        config: SourceConfig,
    ) -> Result<SessionStatus, SessionError> {
        match self.connect(config.clone()) {
            Err(SessionError::Source(e))
                if e.kind() == SourceErrorKind::InvalidSettings && !config.settings.is_empty() =>
            {
                tracing::warn!("stored settings rejected; retrying with defaults");
                self.connect(SourceConfig {
                    settings: SettingsPatch::default(),
                    ..config
                })
            }
            other => other,
        }
    }

    /// Disconnects any current source, then opens `config`. Blocks until the source is open.
    pub fn connect(&self, config: SourceConfig) -> Result<SessionStatus, SessionError> {
        let mut worker = lock(&self.worker);
        self.shutdown_worker(&mut worker);

        let driver = self.registry.get(&config.driver_id)?;
        let info = driver.info();
        if info.status != DriverStatus::Available {
            return Err(SourceError::unsupported(format!(
                "{} support is not implemented yet.",
                info.name
            ))
            .into());
        }
        // Validate early for a clear error; the config is kept as given (without filled-in
        // defaults) so it compares equal to what the user selected or saved.
        resolve_params(&info.connection_params, &config.connection)
            .map_err(SessionError::Invalid)?;

        let processing = self.status().processing;
        self.shared.clear_frame();
        self.shared.update(|s| {
            s.state = SessionState::Connecting;
            s.source = None;
            s.last_notice = None;
            s.last_config = Some(config.clone());
        });

        tracing::info!(driver = %info.id, "connecting source");
        let failed = |error: SessionError| {
            tracing::warn!(driver = %info.id, error = %error_chain(&error), "could not connect source");
            self.shared.update(|s| {
                s.state = SessionState::Disconnected;
                s.last_notice = Some(notice(
                    NoticeKind::ConnectFailed,
                    format!("Could not connect to {}: {error}", info.name),
                ));
            });
            error
        };

        let (handle, opened) =
            worker::spawn(driver, config, processing, self.shared.clone()).map_err(&failed)?;
        match opened.recv_timeout(OPEN_TIMEOUT) {
            Ok(Ok(active)) => {
                tracing::info!(driver = %info.id, device = %active.device_label, "source connected");
                *worker = Some(handle);
                self.shared.update(|s| {
                    s.state = SessionState::Connected;
                    s.source = Some(active);
                });
                Ok(self.status())
            }
            Ok(Err(e)) => {
                let _ = handle.thread.join();
                Err(failed(e))
            }
            Err(RecvTimeoutError::Timeout) => {
                // The worker exits on its own once `open` returns, because its command channel
                // is dropped here.
                drop(handle);
                Err(failed(SessionError::Timeout))
            }
            Err(RecvTimeoutError::Disconnected) => {
                let panicked = handle.thread.join().is_err();
                if panicked {
                    tracing::error!(driver = %info.id, "source driver panicked while connecting");
                }
                Err(failed(SessionError::Internal(if panicked {
                    "the source driver crashed while connecting".into()
                } else {
                    "the connection attempt ended unexpectedly".into()
                })))
            }
        }
    }

    /// Stops acquisition, closes the source and joins the worker. Safe to call at any time.
    pub fn disconnect(&self) {
        let mut worker = lock(&self.worker);
        self.shutdown_worker(&mut worker);
    }

    fn shutdown_worker(&self, worker: &mut Option<WorkerHandle>) {
        let Some(handle) = worker.take() else {
            return;
        };
        self.shared.update(|s| {
            if s.state != SessionState::Disconnected {
                s.state = SessionState::Disconnecting;
            }
        });
        let _ = handle.tx.send(Command::Shutdown);
        let panicked = handle.thread.join().is_err();
        if panicked {
            tracing::error!("acquisition worker panicked");
        }
        tracing::debug!("source disconnected");
        self.shared.update(|s| {
            s.state = SessionState::Disconnected;
            s.source = None;
            if panicked {
                s.last_notice = Some(notice(
                    NoticeKind::Internal,
                    "The acquisition worker crashed and was reset.".into(),
                ));
            }
        });
    }

    pub fn start(&self) -> Result<(), SessionError> {
        self.request(Command::Start)
    }

    pub fn stop(&self) -> Result<(), SessionError> {
        self.request(Command::Stop)
    }

    pub fn apply_settings(&self, patch: SettingsPatch) -> Result<SourceSettings, SessionError> {
        self.request(|reply| Command::Apply(patch, reply))
    }

    pub fn set_processing(&self, settings: ProcessingSettings) -> Result<(), SessionError> {
        settings.validate().map_err(SessionError::Invalid)?;
        let worker = lock(&self.worker);
        self.shared.update(|s| s.processing = settings.clone());
        if let Some(handle) = worker.as_ref() {
            let _ = handle.tx.send(Command::Processing(settings));
        }
        Ok(())
    }

    pub fn reset_holds(&self) {
        if let Some(handle) = lock(&self.worker).as_ref() {
            let _ = handle.tx.send(Command::ResetHolds);
        }
    }

    pub fn dismiss_notice(&self) {
        self.shared.update(|s| s.last_notice = None);
    }

    /// Waits up to `timeout` for a frame with `seq > after_seq`.
    pub fn wait_frame(&self, after_seq: u32, timeout: Duration) -> Option<Arc<EncodedFrame>> {
        let guard = lock(&self.shared.frame);
        let (guard, _) = self
            .shared
            .frame_ready
            .wait_timeout_while(guard, timeout, |f| {
                f.as_ref().is_none_or(|f| f.frame.header.seq <= after_seq)
            })
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        guard
            .as_ref()
            .filter(|f| f.frame.header.seq > after_seq)
            .cloned()
    }

    fn request<T>(
        &self,
        make: impl FnOnce(worker::Reply<T>) -> Command,
    ) -> Result<T, SessionError> {
        let mut worker = lock(&self.worker);
        let Some(handle) = worker.as_ref() else {
            return Err(SessionError::NotConnected);
        };
        let (tx, rx) = mpsc::channel();
        if handle.tx.send(make(tx)).is_err() {
            // The worker ended by itself (device lost); reap it.
            self.shutdown_worker(&mut worker);
            return Err(SessionError::NotConnected);
        }
        match rx.recv_timeout(COMMAND_TIMEOUT) {
            Ok(result) => result,
            Err(RecvTimeoutError::Timeout) => Err(SessionError::Timeout),
            Err(RecvTimeoutError::Disconnected) => {
                self.shutdown_worker(&mut worker);
                Err(SessionError::NotConnected)
            }
        }
    }
}

impl Drop for SessionManager {
    fn drop(&mut self) {
        self.disconnect();
    }
}
