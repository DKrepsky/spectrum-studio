//! The acquisition worker: one thread per connected source. It owns the [`Source`] and the
//! [`Pipeline`], executes commands between reads and publishes status and frames.

use std::sync::Arc;
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use super::pipeline::{FrameContext, Pipeline};
use super::{SessionError, Shared, error_chain};
use crate::model::session::now_ms;
use crate::model::{
    ActiveSource, CaptureMode, NoticeKind, ProcessingSettings, SessionNotice, SessionState,
    SettingsPatch, SourceConfig, SourceSettings, SpectrumFrame,
};
use crate::sources::{Source, SourceData, SourceDriver, SourceError, validate_patch};

pub(crate) type Reply<T> = Sender<Result<T, SessionError>>;

pub(crate) enum Command {
    Start(CaptureMode, Reply<()>),
    SetMode(CaptureMode, Reply<()>),
    Stop(Reply<()>),
    Apply(SettingsPatch, Reply<SourceSettings>),
    Processing(ProcessingSettings),
    ResetHolds,
    Shutdown,
}

pub(crate) struct WorkerHandle {
    pub tx: Sender<Command>,
    pub thread: JoinHandle<()>,
}

/// Spawns the worker, which opens the source and applies the configured settings. Returns once
/// the source is open (or failed to open); the reply carries the active source description.
pub(crate) fn spawn(
    driver: Arc<dyn SourceDriver>,
    config: SourceConfig,
    processing: ProcessingSettings,
    mode: CaptureMode,
    capture_timeout: Duration,
    shared: Arc<Shared>,
) -> Result<(WorkerHandle, Receiver<Result<ActiveSource, SessionError>>), SessionError> {
    let (tx, rx) = mpsc::channel();
    let (open_tx, open_rx) = mpsc::channel();
    let thread = std::thread::Builder::new()
        .name("acquisition".into())
        .spawn(move || {
            let Some((source, active)) = open(&*driver, &config, &open_tx) else {
                return;
            };
            Worker {
                source,
                label: active.device_label.clone(),
                simulated: active.simulated,
                pipeline: Pipeline::new(processing),
                shared,
                rx,
                acquiring: false,
                mode,
                capture_timeout,
                deadline: None,
                deferred: None,
            }
            .run();
        })
        .map_err(|e| SessionError::Internal(format!("Could not start worker thread: {e}")))?;
    Ok((WorkerHandle { tx, thread }, open_rx))
}

fn open(
    driver: &dyn SourceDriver,
    config: &SourceConfig,
    reply: &Reply<ActiveSource>,
) -> Option<(Box<dyn Source>, ActiveSource)> {
    let info = driver.info();
    let result = (|| {
        let opened = driver.open(config)?;
        let mut source = opened.source;
        if !config.settings.is_empty() {
            validate_patch(source.capabilities(), source.settings(), &config.settings)?;
            source.apply(&config.settings)?;
        }
        let mut resolved = config.clone();
        resolved.device_id = opened.device_id.or(resolved.device_id);
        resolved.connection.extend(opened.connection);
        let active = ActiveSource {
            config: resolved,
            driver_name: info.name.clone(),
            device_label: opened.label,
            kind: info.kind,
            transport: info.transport,
            simulated: opened.simulated,
            capabilities: source.capabilities().clone(),
            settings: source.settings().clone(),
        };
        Ok::<_, SourceError>((source, active))
    })();
    match result {
        Ok((source, active)) => {
            let _ = reply.send(Ok(active.clone()));
            Some((source, active))
        }
        Err(e) => {
            tracing::debug!(driver = %info.id, error = %error_chain(&e), "opening source failed");
            let _ = reply.send(Err(SessionError::Source(e)));
            None
        }
    }
}

struct Worker {
    source: Box<dyn Source>,
    label: String,
    simulated: bool,
    pipeline: Pipeline,
    shared: Arc<Shared>,
    rx: Receiver<Command>,
    acquiring: bool,
    /// Mode of the current or next acquisition; changed only while not acquiring.
    mode: CaptureMode,
    capture_timeout: Duration,
    /// Single capture: when to give up if no sweep has been produced yet.
    deadline: Option<Instant>,
    /// A command received right after a sweep was read; handled before anything else.
    deferred: Option<Command>,
}

impl Worker {
    fn run(mut self) {
        loop {
            let command = if let Some(command) = self.deferred.take() {
                Some(command)
            } else if self.acquiring {
                match self.rx.try_recv() {
                    Ok(c) => Some(c),
                    Err(TryRecvError::Empty) => None,
                    Err(TryRecvError::Disconnected) => break,
                }
            } else {
                match self.rx.recv() {
                    Ok(c) => Some(c),
                    Err(_) => break,
                }
            };
            match command {
                Some(Command::Shutdown) => break,
                Some(command) => self.handle(command),
                None => {
                    if !self.acquire_once() {
                        break;
                    }
                }
            }
        }
        if self.acquiring {
            let _ = self.source.stop();
        }
    }

    fn handle(&mut self, command: Command) {
        match command {
            Command::Start(mode, reply) => {
                let _ = reply.send(self.start(mode));
            }
            Command::SetMode(mode, reply) => {
                let _ = reply.send(self.set_mode(mode));
            }
            Command::Stop(reply) => {
                let result = self.stop_acquisition();
                self.set_state(SessionState::Connected, None);
                let _ = reply.send(result.map_err(SessionError::Source));
            }
            Command::Apply(patch, reply) => {
                let _ = reply.send(self.apply(&patch));
            }
            Command::Processing(settings) => self.pipeline.configure(settings),
            Command::ResetHolds => self.pipeline.reset_holds(),
            Command::Shutdown => {}
        }
    }

    fn start(&mut self, mode: CaptureMode) -> Result<(), SessionError> {
        if self.acquiring {
            return Ok(());
        }
        self.source.start()?;
        self.acquiring = true;
        self.mode = mode;
        self.pipeline.reset();
        self.deadline =
            (mode == CaptureMode::Single).then(|| Instant::now() + self.capture_timeout);
        self.set_state(SessionState::Acquiring, None);
        Ok(())
    }

    fn set_mode(&mut self, mode: CaptureMode) -> Result<(), SessionError> {
        if self.acquiring {
            return Err(SessionError::Invalid(
                "Pause or cancel acquisition to change the capture mode.".into(),
            ));
        }
        self.mode = mode;
        self.shared.update(|s| s.capture_mode = mode);
        Ok(())
    }

    fn stop_acquisition(&mut self) -> Result<(), SourceError> {
        self.deadline = None;
        if !std::mem::take(&mut self.acquiring) {
            return Ok(());
        }
        self.source.stop()
    }

    fn apply(&mut self, patch: &SettingsPatch) -> Result<SourceSettings, SessionError> {
        validate_patch(self.source.capabilities(), self.source.settings(), patch)?;
        self.source.apply(patch)?;
        let settings = self.source.settings().clone();
        let caps = self.source.capabilities().clone();
        self.shared.update(|s| {
            if let Some(active) = &mut s.source {
                active.settings = settings.clone();
                active.capabilities = caps;
            }
        });
        Ok(settings)
    }

    /// Reads and processes one block. Returns `false` when the worker must exit.
    fn acquire_once(&mut self) -> bool {
        let ctx = FrameContext {
            source_label: &self.label,
            simulated: self.simulated,
        };
        let frame = match self.source.read(self.pipeline.samples_wanted()) {
            Ok(SourceData::Iq(block)) => self.pipeline.push_iq(block, &ctx),
            Ok(SourceData::Trace(block)) => self.pipeline.push_trace(block, &ctx),
            Err(e) if e.is_fatal() => {
                tracing::error!(device = %self.label, error = %error_chain(&e), "source lost");
                self.acquiring = false;
                self.shared.update(|s| {
                    s.state = SessionState::Disconnected;
                    s.source = None;
                    s.last_notice = Some(notice(NoticeKind::DeviceLost, e.to_string()));
                });
                return false;
            }
            Err(e) => {
                tracing::warn!(device = %self.label, error = %error_chain(&e), "acquisition stopped by read error");
                let message = match self.mode {
                    CaptureMode::Single => format!("Single capture failed: {e}"),
                    CaptureMode::Continuous => format!("Acquisition stopped: {e}"),
                };
                self.fail_acquisition(message);
                return true;
            }
        };
        match (frame, self.mode) {
            (Some(frame), CaptureMode::Single) => self.complete_single(frame),
            (Some(frame), CaptureMode::Continuous) => self.shared.publish_frame(frame),
            (None, CaptureMode::Single)
                if self
                    .deadline
                    .is_some_and(|deadline| Instant::now() >= deadline) =>
            {
                tracing::warn!(device = %self.label, "single capture produced no sweep in time");
                self.fail_acquisition(
                    "Single capture failed: the source produced no sweep in time.".into(),
                );
            }
            (None, _) => {}
        }
        true
    }

    /// A single capture produced its sweep: publish it and stop. A Stop (or Shutdown) that arrived
    /// while the sweep was being read cancels it, so the sweep is dropped. The command itself is
    /// handled on the next loop turn.
    fn complete_single(&mut self, frame: SpectrumFrame) {
        self.deferred = self.rx.try_recv().ok();
        if matches!(self.deferred, Some(Command::Stop(_) | Command::Shutdown)) {
            return;
        }
        self.shared.publish_frame(frame);
        let result = self.stop_acquisition();
        self.set_state(
            SessionState::Connected,
            result.err().map(|e| {
                (
                    NoticeKind::AcquisitionFailed,
                    format!("Single capture failed: {e}"),
                )
            }),
        );
    }

    fn fail_acquisition(&mut self, message: String) {
        let _ = self.stop_acquisition();
        self.set_state(
            SessionState::Connected,
            Some((NoticeKind::AcquisitionFailed, message)),
        );
    }

    fn set_state(&self, state: SessionState, new_notice: Option<(NoticeKind, String)>) {
        self.shared.update(|s| {
            s.state = state;
            if let Some((kind, message)) = new_notice {
                s.last_notice = Some(notice(kind, message));
            }
        });
    }
}

pub(crate) fn notice(kind: NoticeKind, message: String) -> SessionNotice {
    SessionNotice {
        kind,
        message,
        timestamp_ms: now_ms(),
    }
}
