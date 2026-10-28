//! Acquisition session: owns at most one connected source and its worker thread.
//!
//! All lifecycle operations are serialised. Status changes are pushed to a [`SessionSink`];
//! frames are published to a latest-wins slot that consumers poll with
//! [`SessionManager::wait_frame`], which gives natural back-pressure.

pub mod pipeline;
mod worker;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::time::Duration;

use thiserror::Error;

use self::worker::{Command, WorkerHandle, notice};
use crate::model::params::resolve_params;
use crate::model::{
    DeviceDescriptor, DriverInfo, DriverStatus, NoticeKind, ProcessingSettings, SessionState,
    SessionStatus, SettingsPatch, SourceConfig, SourceSettings, SpectrumFrame,
};
use crate::sources::{DriverRegistry, SourceError};

/// How long to wait for a source to open before giving up.
const OPEN_TIMEOUT: Duration = Duration::from_secs(30);
/// How long to wait for the worker to answer a command.
const COMMAND_TIMEOUT: Duration = Duration::from_secs(10);

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
        }
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

    /// The most recent frame, if any (kept after stopping so it can be exported).
    pub fn latest_frame(&self) -> Option<Arc<EncodedFrame>> {
        lock(&self.shared.frame).clone()
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
