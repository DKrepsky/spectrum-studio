//! Session-level scenarios: lifecycle, switching, settings, failures and recovery.
#![allow(clippy::unwrap_used)] // test helpers outside #[test] functions

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use rustfft::num_complex::Complex32;
use spectrum_core::model::{
    AmplitudeUnit, Capabilities, CaptureMode, DataKind, DriverInfo, DriverStatus, NoticeKind,
    ParamMap, ParamValue, ProcessingSettings, SessionState, SessionStatus, SettingsPatch,
    SourceConfig, SourceKind, SourceSettings, Transport,
};
use spectrum_core::sources::simulator::{self, SimulatorDriver};
use spectrum_core::sources::{
    IqBlock, OpenedSource, Source, SourceData, SourceDriver, SourceError, SourceErrorKind,
    TraceBlock,
};
use spectrum_core::{DriverRegistry, SessionError, SessionManager, SessionSink};

const WAIT: Duration = Duration::from_secs(5);

#[derive(Default)]
struct RecordingSink(Mutex<Vec<SessionStatus>>);

impl SessionSink for RecordingSink {
    fn status_changed(&self, status: &SessionStatus) {
        self.0.lock().unwrap().push(status.clone());
    }
}

/// A trace-producing test source that fails in scripted ways.
struct ScriptedDriver;

struct ScriptedSource {
    caps: Capabilities,
    settings: SourceSettings,
    reads: u32,
}

impl SourceDriver for ScriptedDriver {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: "scripted".into(),
            name: "Scripted analyzer".into(),
            description: String::new(),
            kind: SourceKind::SpectrumAnalyzer,
            transport: Transport::Network,
            status: DriverStatus::Available,
            supports_discovery: false,
            connection_params: vec![],
        }
    }

    fn open(&self, _config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        Ok(OpenedSource {
            source: Box::new(ScriptedSource {
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
                reads: 0,
            }),
            label: "Scripted #1".into(),
            simulated: false,
            device_id: None,
            connection: ParamMap::new(),
        })
    }
}

/// Reports the identity and connection it "actually" opened, like a real device driver.
struct IdentityDriver {
    device_id: Option<String>,
    connection: ParamMap,
}

impl SourceDriver for IdentityDriver {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: "identity".into(),
            name: "Identity analyzer".into(),
            connection_params: vec![spectrum_core::model::ParamSpec {
                id: "port".into(),
                label: "Port".into(),
                group: None,
                help: None,
                kind: spectrum_core::model::ParamKind::Text { max_length: 64 },
                default: ParamValue::Text(String::new()),
                required: false,
            }],
            ..ScriptedDriver.info()
        }
    }

    fn open(&self, config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        let mut opened = ScriptedDriver.open(config)?;
        opened.device_id = self.device_id.clone();
        opened.connection = self.connection.clone();
        Ok(opened)
    }
}

impl Source for ScriptedSource {
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
    /// Two traces, then a recoverable error, then traces again.
    fn read(&mut self, _wanted: usize) -> Result<SourceData, SourceError> {
        self.reads += 1;
        std::thread::sleep(Duration::from_millis(5));
        match self.reads {
            3 => Err(SourceError::io("Timeout reading trace.")),
            _ => Ok(SourceData::Trace(TraceBlock {
                values: vec![-90.0, -40.0, -90.0, -90.0, -90.0],
                start_hz: 998e6,
                bin_hz: 1e6,
                unit: AmplitudeUnit::Dbm,
                rbw_hz: Some(1e6),
            })),
        }
    }
    fn stop(&mut self) -> Result<(), SourceError> {
        Ok(())
    }
}

fn manager() -> (SessionManager, Arc<RecordingSink>) {
    let mut registry = DriverRegistry::new();
    registry.register(SimulatorDriver::unpaced());
    registry.register(ScriptedDriver);
    for d in spectrum_core::sources::planned::planned_drivers() {
        registry.register(d);
    }
    let sink = Arc::new(RecordingSink::default());
    let processing = ProcessingSettings {
        fft_size: 1024,
        ..Default::default()
    };
    (
        SessionManager::new(registry, sink.clone(), processing),
        sink,
    )
}

fn sim_config() -> SourceConfig {
    SourceConfig::new(simulator::DRIVER_ID)
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

#[test]
fn full_lifecycle_with_simulator() {
    let (m, sink) = manager();
    assert_eq!(m.status().state, SessionState::Disconnected);
    assert!(matches!(m.start(), Err(SessionError::NotConnected)));

    let status = m.connect(sim_config()).unwrap();
    assert_eq!(status.state, SessionState::Connected);
    let active = status.source.unwrap();
    assert!(active.simulated);
    assert_eq!(active.kind, SourceKind::Simulator);
    assert!(active.capabilities.tuning.is_some());
    assert!(
        m.wait_frame(0, Duration::from_millis(50)).is_none(),
        "no frames before start"
    );

    m.start().unwrap();
    assert_eq!(m.status().state, SessionState::Acquiring);
    let f1 = m.wait_frame(0, WAIT).expect("frame");
    let f2 = m
        .wait_frame(f1.frame.header.seq, WAIT)
        .expect("second frame");
    assert!(f2.frame.header.seq > f1.frame.header.seq);
    let h = &f2.frame.header;
    assert_eq!(h.bins, 1024);
    assert_eq!(h.unit, AmplitudeUnit::Dbfs);
    assert!(h.simulated);
    assert_eq!(h.center_hz, simulator::DEFAULT_CENTER_HZ);
    assert!(!h.peaks.is_empty(), "default scene has visible tones");

    m.stop().unwrap();
    assert_eq!(m.status().state, SessionState::Connected);
    m.disconnect();
    let s = m.status();
    assert_eq!(s.state, SessionState::Disconnected);
    assert!(s.source.is_none());

    let revisions: Vec<u32> = sink.0.lock().unwrap().iter().map(|s| s.revision).collect();
    assert!(revisions.windows(2).all(|w| w[1] > w[0]));
}

#[test]
fn settings_are_validated_and_reflected_in_frames() {
    let (m, _) = manager();
    m.connect(sim_config()).unwrap();
    m.start().unwrap();

    let err = m
        .apply_settings(SettingsPatch {
            center_hz: Some(7e9),
            ..Default::default()
        })
        .unwrap_err();
    assert!(
        err.to_string().contains("outside the tunable range"),
        "{err}"
    );
    assert_eq!(
        m.status().source.unwrap().settings.center_hz,
        simulator::DEFAULT_CENTER_HZ
    );

    let applied = m
        .apply_settings(SettingsPatch {
            center_hz: Some(433.92e6),
            span_hz: Some(1.024e6),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(applied.center_hz, 433.92e6);
    assert_eq!(m.status().source.unwrap().settings.span_hz, 1.024e6);

    m.set_processing(ProcessingSettings {
        fft_size: 2048,
        ..Default::default()
    })
    .unwrap();
    let mut seq = 0;
    let frame = loop {
        let f = m.wait_frame(seq, WAIT).expect("frame");
        seq = f.frame.header.seq;
        if f.frame.header.center_hz == 433.92e6 && f.frame.header.bins == 2048 {
            break f;
        }
    };
    assert_eq!(frame.frame.header.span_hz, 1.024e6);
    assert!(
        m.set_processing(ProcessingSettings {
            fft_size: 3000,
            ..Default::default()
        })
        .is_err()
    );
}

#[test]
fn switching_sources_releases_the_previous_one() {
    let (m, _) = manager();
    m.connect(sim_config()).unwrap();
    m.start().unwrap();
    let last = m.wait_frame(0, WAIT).unwrap().frame.header.seq;

    let status = m
        .connect(SourceConfig::new("scripted"))
        .expect("switch to second source");
    let active = status.source.unwrap();
    assert_eq!(active.driver_name, "Scripted analyzer");
    assert_eq!(status.state, SessionState::Connected);
    // The new source is connected but not started, so no frame from it (or the old one) follows.
    assert!(m.wait_frame(last, Duration::from_millis(300)).is_none());
}

#[test]
fn device_loss_disconnects_and_reconnect_recovers() {
    let (m, _) = manager();
    let mut config = sim_config();
    config
        .settings
        .params
        .insert("faultAfterS".into(), ParamValue::Number(0.2));
    m.connect(config.clone()).unwrap();
    m.start().unwrap();
    let s = wait_until(&m, |s| s.state == SessionState::Disconnected);
    let notice = s.last_notice.unwrap();
    assert_eq!(notice.kind, NoticeKind::DeviceLost);
    assert!(notice.message.contains("Simulated device loss"));
    assert!(s.source.is_none());
    assert!(matches!(m.start(), Err(SessionError::NotConnected)));

    // Reconnect with the remembered configuration (fault injection disabled this time).
    let mut again = s.last_config.unwrap();
    assert_eq!(again, config);
    again.settings.params.clear();
    m.connect(again).unwrap();
    m.start().unwrap();
    assert!(m.wait_frame(0, WAIT).is_some());
}

#[test]
fn connection_failures_are_reported() {
    let (m, _) = manager();
    let mut config = sim_config();
    config
        .connection
        .insert("failConnect".into(), ParamValue::Bool(true));
    let err = m.connect(config).unwrap_err();
    assert!(matches!(
        &err,
        SessionError::Source(e) if e.kind() == SourceErrorKind::Unavailable
    ));
    let s = m.status();
    assert_eq!(s.state, SessionState::Disconnected);
    assert_eq!(s.last_notice.unwrap().kind, NoticeKind::ConnectFailed);

    let err = m.connect(SourceConfig::new("soapysdr")).unwrap_err();
    assert!(err.to_string().contains("not implemented"), "{err}");
    let err = m.connect(SourceConfig::new("does-not-exist")).unwrap_err();
    assert!(err.to_string().contains("Unknown source type"));

    let mut bad = sim_config();
    bad.connection
        .insert("bogus".into(), ParamValue::Bool(true));
    assert!(matches!(m.connect(bad), Err(SessionError::Invalid(_))));
}

#[test]
fn trace_sources_report_read_errors() {
    let (m, _) = manager();
    let status = m.connect(SourceConfig::new("scripted")).unwrap();
    assert!(status.source.unwrap().capabilities.tuning.is_none());
    let err = m
        .apply_settings(SettingsPatch {
            center_hz: Some(2e9),
            ..Default::default()
        })
        .unwrap_err();
    assert_eq!(err.to_string(), "This source cannot be tuned.");

    m.start().unwrap();
    let f = m.wait_frame(0, WAIT).unwrap();
    assert_eq!(f.frame.header.unit, AmplitudeUnit::Dbm);
    assert_eq!(f.frame.header.data_kind, DataKind::Trace);
    assert_eq!(f.frame.live, vec![-90.0, -40.0, -90.0, -90.0, -90.0]);

    let s = wait_until(&m, |s| s.state == SessionState::Connected);
    assert_eq!(s.last_notice.unwrap().kind, NoticeKind::AcquisitionFailed);
    assert!(
        s.source.is_some(),
        "a recoverable error keeps the source open"
    );

    m.dismiss_notice();
    assert!(m.status().last_notice.is_none());
}

#[test]
fn reset_holds_and_processing_without_connection() {
    let (m, _) = manager();
    // Allowed while disconnected: stored and used for the next connection.
    m.set_processing(ProcessingSettings {
        fft_size: 512,
        max_hold: true,
        ..Default::default()
    })
    .unwrap();
    m.reset_holds();
    m.connect(sim_config()).unwrap();
    m.start().unwrap();
    let f = m.wait_frame(0, WAIT).unwrap();
    assert_eq!(f.frame.header.bins, 512);
    assert!(f.frame.max_hold.is_some());
}

/// A discovery-capable driver whose scan result is scripted.
struct ScanDriver {
    id: &'static str,
    transport: Transport,
    status: DriverStatus,
    fail: bool,
}

impl SourceDriver for ScanDriver {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: self.id.into(),
            name: self.id.into(),
            description: String::new(),
            kind: SourceKind::Sdr,
            transport: self.transport,
            status: self.status,
            supports_discovery: true,
            connection_params: vec![],
        }
    }

    fn discover(&self) -> Result<Vec<spectrum_core::model::DeviceDescriptor>, SourceError> {
        if self.fail {
            return Err(SourceError::unavailable("Scan failed."));
        }
        Ok(vec![spectrum_core::model::DeviceDescriptor {
            driver_id: self.id.into(),
            device_id: "dev0".into(),
            label: "Device 0".into(),
            location: None,
            details: vec![],
        }])
    }

    fn open(&self, _config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        Err(SourceError::unavailable("not openable"))
    }
}

fn scan_driver(
    id: &'static str,
    transport: Transport,
    status: DriverStatus,
    fail: bool,
) -> ScanDriver {
    ScanDriver {
        id,
        transport,
        status,
        fail,
    }
}

#[test]
fn discover_all_filters_drivers_and_isolates_failures() {
    let mut registry = DriverRegistry::with_core_drivers();
    registry.register(scan_driver(
        "usbgood",
        Transport::Usb,
        DriverStatus::Available,
        false,
    ));
    registry.register(scan_driver(
        "usbbad",
        Transport::Usb,
        DriverStatus::Available,
        true,
    ));
    registry.register(scan_driver(
        "planned",
        Transport::Usb,
        DriverStatus::Planned,
        false,
    ));
    registry.register(scan_driver(
        "internal",
        Transport::Internal,
        DriverStatus::Available,
        false,
    ));
    let m = SessionManager::new(
        registry,
        Arc::new(RecordingSink::default()),
        ProcessingSettings::default(),
    );

    let results = m.discover_all();
    let ids: Vec<_> = results.iter().map(|r| r.driver_id.as_str()).collect();
    assert_eq!(ids, ["usbgood", "usbbad"]);
    assert_eq!(results[0].devices.len(), 1);
    assert_eq!(results[0].error, None);
    assert!(results[1].devices.is_empty());
    assert_eq!(results[1].error.as_deref(), Some("Scan failed."));
}

#[test]
fn discover_all_does_not_disturb_an_acquiring_source() {
    let mut registry = DriverRegistry::new();
    registry.register(SimulatorDriver::unpaced());
    registry.register(scan_driver(
        "usbgood",
        Transport::Usb,
        DriverStatus::Available,
        false,
    ));
    let m = SessionManager::new(
        registry,
        Arc::new(RecordingSink::default()),
        ProcessingSettings::default(),
    );
    m.connect(sim_config()).unwrap();
    m.start().unwrap();
    let f = m.wait_frame(0, WAIT).expect("frame");
    assert_eq!(m.discover_all().len(), 1);
    assert_eq!(m.status().state, SessionState::Acquiring);
    assert!(m.wait_frame(f.frame.header.seq, WAIT).is_some());
}

#[test]
fn switching_stops_the_old_source_and_failed_connects_leave_the_new_one_unset() {
    let (m, _) = manager();
    m.connect(sim_config()).unwrap();
    m.start().unwrap();
    assert_eq!(m.status().state, SessionState::Acquiring);

    let status = m.connect(SourceConfig::new("scripted")).unwrap();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(status.source.unwrap().device_label, "Scripted #1");

    let mut bad = sim_config();
    bad.settings.center_hz = Some(7e9);
    assert!(m.connect(bad).is_err());
    let s = m.status();
    assert_eq!(s.state, SessionState::Disconnected);
    assert!(s.source.is_none());
}

#[test]
fn stale_settings_fall_back_to_defaults() {
    let (m, _) = manager();
    let mut stale = sim_config();
    stale.settings.center_hz = Some(7e9);

    match m.connect(stale.clone()) {
        Err(SessionError::Source(e)) => assert_eq!(e.kind(), SourceErrorKind::InvalidSettings),
        other => panic!("expected rejected settings, got {other:?}"),
    }
    let status = m.connect_with_default_fallback(stale).unwrap();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(
        status.source.unwrap().settings.center_hz,
        simulator::DEFAULT_CENTER_HZ
    );

    // Other failures are not retried: an unknown driver still fails with its own error.
    assert!(
        m.connect_with_default_fallback(SourceConfig::new("nope"))
            .is_err()
    );
}

fn identity_manager(device_id: Option<&str>, port: Option<&str>) -> SessionManager {
    let mut registry = DriverRegistry::new();
    registry.register(IdentityDriver {
        device_id: device_id.map(Into::into),
        connection: port
            .map(|p| ParamMap::from([("port".to_string(), ParamValue::Text(p.into()))]))
            .unwrap_or_default(),
    });
    SessionManager::new(
        registry,
        Arc::new(RecordingSink::default()),
        ProcessingSettings::default(),
    )
}

#[test]
fn connect_stores_the_identity_and_connection_the_driver_reports() {
    let m = identity_manager(Some("X1"), Some("/dev/x"));
    let status = m.connect(SourceConfig::new("identity")).unwrap();
    let config = status.source.unwrap().config;
    assert_eq!(config.device_id.as_deref(), Some("X1"));
    assert_eq!(
        config.connection.get("port"),
        Some(&ParamValue::Text("/dev/x".into()))
    );
    // The remembered config stays exactly what the caller asked for.
    let last = m.status().last_config.unwrap();
    assert_eq!(last.device_id, None);
    assert!(last.connection.is_empty());
}

#[test]
fn connect_keeps_the_given_config_when_the_driver_reports_nothing() {
    let m = identity_manager(None, None);
    let mut given = SourceConfig::new("identity");
    given.device_id = Some("given".into());
    given
        .connection
        .insert("port".into(), ParamValue::Text("/dev/given".into()));
    let status = m.connect(given.clone()).unwrap();
    assert_eq!(status.source.unwrap().config, given);
}

/// What a [`SweepDriver`] produces on each read.
#[derive(Clone, Copy)]
enum Feed {
    /// One complete trace per read (a trace instrument's sweep).
    Trace,
    /// IQ blocks of this many samples per read (an IQ device with short blocks).
    Iq { block: usize },
}

/// Scripted failure injected on every read.
#[derive(Clone, Copy)]
enum Fault {
    None,
    Recoverable,
    Fatal,
}

/// A source whose reads take `delay` and count themselves, for capture-mode scenarios.
struct SweepDriver {
    feed: Feed,
    delay: Duration,
    fault: Fault,
    reads: Arc<AtomicU32>,
}

struct SweepSource {
    caps: Capabilities,
    settings: SourceSettings,
    feed: Feed,
    delay: Duration,
    fault: Fault,
    reads: Arc<AtomicU32>,
}

impl SourceDriver for SweepDriver {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: "sweep".into(),
            name: "Sweep test source".into(),
            ..ScriptedDriver.info()
        }
    }

    fn open(&self, _config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        let data_kind = match self.feed {
            Feed::Trace => DataKind::Trace,
            Feed::Iq { .. } => DataKind::Iq,
        };
        Ok(OpenedSource {
            source: Box::new(SweepSource {
                caps: Capabilities {
                    data_kind,
                    tuning: None,
                    span_options_hz: vec![],
                    amplitude_unit: AmplitudeUnit::Dbm,
                    params: vec![],
                },
                settings: SourceSettings {
                    center_hz: 1e9,
                    span_hz: 1e6,
                    params: Default::default(),
                },
                feed: self.feed,
                delay: self.delay,
                fault: self.fault,
                reads: self.reads.clone(),
            }),
            label: "Sweep #1".into(),
            simulated: false,
            device_id: None,
            connection: ParamMap::new(),
        })
    }
}

impl Source for SweepSource {
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
        self.reads.fetch_add(1, Ordering::SeqCst);
        std::thread::sleep(self.delay);
        match self.fault {
            Fault::None => {}
            Fault::Recoverable => return Err(SourceError::io("Sweep timed out.")),
            Fault::Fatal => return Err(SourceError::disconnected("Sweep device unplugged.")),
        }
        Ok(match self.feed {
            Feed::Trace => SourceData::Trace(TraceBlock {
                values: vec![-80.0; 64],
                start_hz: 1e9,
                bin_hz: 1e6,
                unit: AmplitudeUnit::Dbm,
                rbw_hz: Some(1e6),
            }),
            Feed::Iq { block } => SourceData::Iq(IqBlock {
                samples: vec![Complex32::new(0.1, 0.0); block],
                sample_rate_hz: 1e6,
                center_hz: 1e9,
                discontinuity: false,
            }),
        })
    }
    fn stop(&mut self) -> Result<(), SourceError> {
        Ok(())
    }
}

const FFT: u32 = 1024;

fn sweep_manager(driver: SweepDriver) -> SessionManager {
    let mut registry = DriverRegistry::new();
    registry.register(driver);
    SessionManager::new(
        registry,
        Arc::new(RecordingSink::default()),
        ProcessingSettings {
            fft_size: FFT,
            ..Default::default()
        },
    )
}

fn sweep(feed: Feed, delay: Duration, fault: Fault) -> (SweepDriver, Arc<AtomicU32>) {
    let reads = Arc::new(AtomicU32::new(0));
    let driver = SweepDriver {
        feed,
        delay,
        fault,
        reads: reads.clone(),
    };
    (driver, reads)
}

fn sweep_config() -> SourceConfig {
    SourceConfig::new("sweep")
}

#[test]
fn capture_mode_defaults_to_continuous_and_is_kept_across_connections() {
    let (m, _) = manager();
    assert_eq!(m.status().capture_mode, CaptureMode::Continuous);

    // Selected while disconnected, then kept through connect and disconnect.
    m.set_capture_mode(CaptureMode::Single).unwrap();
    assert_eq!(m.status().capture_mode, CaptureMode::Single);
    m.connect(sim_config()).unwrap();
    assert_eq!(m.status().capture_mode, CaptureMode::Single);
    m.disconnect();
    assert_eq!(m.status().capture_mode, CaptureMode::Single);

    let m = SessionManager::new(
        DriverRegistry::new(),
        Arc::new(RecordingSink::default()),
        ProcessingSettings::default(),
    )
    .with_capture_mode(CaptureMode::Single);
    assert_eq!(m.status().capture_mode, CaptureMode::Single);
}

#[test]
fn capture_mode_cannot_change_while_acquiring() {
    let (m, _) = manager();
    m.connect(sim_config()).unwrap();
    m.start().unwrap();
    m.wait_frame(0, WAIT).expect("continuous frame");

    let err = m.set_capture_mode(CaptureMode::Single).unwrap_err();
    assert_eq!(
        err.to_string(),
        "Pause or cancel acquisition to change the capture mode."
    );
    let s = m.status();
    assert_eq!(s.capture_mode, CaptureMode::Continuous);
    assert_eq!(s.state, SessionState::Acquiring);

    m.stop().unwrap();
    m.set_capture_mode(CaptureMode::Single).unwrap();
    assert_eq!(m.status().capture_mode, CaptureMode::Single);
}

#[test]
fn single_capture_on_simulator_delivers_one_raw_sweep_and_stops() {
    let mut registry = DriverRegistry::new();
    registry.register(SimulatorDriver::unpaced());
    let m = SessionManager::new(
        registry,
        Arc::new(RecordingSink::default()),
        ProcessingSettings {
            fft_size: FFT,
            averaging: 8,
            ..Default::default()
        },
    )
    .with_capture_mode(CaptureMode::Single);
    m.connect(sim_config()).unwrap();
    m.start().unwrap();

    let f1 = m.wait_frame(0, WAIT).expect("one sweep");
    assert_eq!(
        f1.frame.header.averaged_count, 1,
        "averaging does not delay it"
    );
    let s = wait_until(&m, |s| s.state == SessionState::Connected);
    assert_eq!(s.capture_mode, CaptureMode::Single);
    assert!(s.last_notice.is_none());
    assert!(
        m.wait_frame(f1.frame.header.seq, Duration::from_millis(300))
            .is_none(),
        "no second sweep after the single capture"
    );

    // Pressing it again takes a new single capture.
    m.start().unwrap();
    let f2 = m
        .wait_frame(f1.frame.header.seq, WAIT)
        .expect("second single capture");
    assert_eq!(f2.frame.header.seq, f1.frame.header.seq + 1);
    wait_until(&m, |s| s.state == SessionState::Connected);
}

#[test]
fn single_capture_reports_acquiring_then_connected_without_a_stop() {
    let (m, sink) = manager();
    m.connect(sim_config()).unwrap();
    m.set_capture_mode(CaptureMode::Single).unwrap();
    m.start().unwrap();
    wait_until(&m, |s| s.state == SessionState::Connected);

    let history = sink.0.lock().unwrap();
    let states: Vec<_> = history.iter().map(|s| (s.state, s.capture_mode)).collect();
    let acquiring = states
        .iter()
        .position(|(state, _)| *state == SessionState::Acquiring)
        .expect("acquiring was reported");
    assert_eq!(states[acquiring].1, CaptureMode::Single);
    assert!(
        states[acquiring..]
            .iter()
            .any(|(state, _)| *state == SessionState::Connected),
        "returns to connected by itself"
    );
}

#[test]
fn single_capture_of_an_iq_device_reads_until_one_fft_is_filled() {
    let (driver, reads) = sweep(Feed::Iq { block: 128 }, Duration::ZERO, Fault::None);
    let m = sweep_manager(driver).with_capture_mode(CaptureMode::Single);
    m.connect(sweep_config()).unwrap();
    m.start().unwrap();

    let frame = m.wait_frame(0, WAIT).expect("one sweep");
    assert_eq!(frame.frame.header.bins, FFT);
    wait_until(&m, |s| s.state == SessionState::Connected);
    assert_eq!(
        reads.load(Ordering::SeqCst),
        FFT / 128,
        "one read per block"
    );
    assert!(
        m.wait_frame(frame.frame.header.seq, Duration::from_millis(200))
            .is_none()
    );
}

#[test]
fn single_capture_of_a_trace_source_is_one_read() {
    let (driver, reads) = sweep(Feed::Trace, Duration::ZERO, Fault::None);
    let m = sweep_manager(driver).with_capture_mode(CaptureMode::Single);
    m.connect(sweep_config()).unwrap();
    m.start().unwrap();

    let frame = m.wait_frame(0, WAIT).expect("one sweep");
    assert_eq!(frame.frame.header.data_kind, DataKind::Trace);
    wait_until(&m, |s| s.state == SessionState::Connected);
    assert_eq!(reads.load(Ordering::SeqCst), 1);
}

/// A single-sweep source whose one read reports "reading" and then blocks until the test releases
/// it, so a test can act while the sweep is in flight without timing the device.
struct GatedDriver {
    reading: mpsc::Sender<()>,
    release: Mutex<Option<mpsc::Receiver<()>>>,
    reads: Arc<AtomicU32>,
}

struct GatedSource {
    caps: Capabilities,
    settings: SourceSettings,
    reading: mpsc::Sender<()>,
    release: mpsc::Receiver<()>,
    reads: Arc<AtomicU32>,
}

/// The test's side of a [`GatedDriver`].
struct Gate {
    reading: mpsc::Receiver<()>,
    release: mpsc::Sender<()>,
    reads: Arc<AtomicU32>,
}

impl SourceDriver for GatedDriver {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: "gated".into(),
            name: "Gated test source".into(),
            ..ScriptedDriver.info()
        }
    }

    fn open(&self, _config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        let release = self
            .release
            .lock()
            .unwrap()
            .take()
            .ok_or_else(|| SourceError::unavailable("The gated test source opens once."))?;
        Ok(OpenedSource {
            source: Box::new(GatedSource {
                caps: Capabilities {
                    data_kind: DataKind::Trace,
                    tuning: None,
                    span_options_hz: vec![],
                    amplitude_unit: AmplitudeUnit::Dbm,
                    params: vec![],
                },
                settings: SourceSettings {
                    center_hz: 1e9,
                    span_hz: 1e6,
                    params: Default::default(),
                },
                reading: self.reading.clone(),
                release,
                reads: self.reads.clone(),
            }),
            label: "Gated #1".into(),
            simulated: false,
            device_id: None,
            connection: ParamMap::new(),
        })
    }
}

impl Source for GatedSource {
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
        self.reads.fetch_add(1, Ordering::SeqCst);
        let _ = self.reading.send(());
        // Blocks until the test releases the sweep (or drops the gate).
        let _ = self.release.recv();
        Ok(SourceData::Trace(TraceBlock {
            values: vec![-80.0; 64],
            start_hz: 1e9,
            bin_hz: 1e6,
            unit: AmplitudeUnit::Dbm,
            rbw_hz: Some(1e6),
        }))
    }
    fn stop(&mut self) -> Result<(), SourceError> {
        Ok(())
    }
}

/// A single-capture manager over one gated sweep, connected and started.
fn gated_capture() -> (SessionManager, Gate) {
    let (reading_tx, reading_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let reads = Arc::new(AtomicU32::new(0));
    let driver = GatedDriver {
        reading: reading_tx,
        release: Mutex::new(Some(release_rx)),
        reads: reads.clone(),
    };
    let mut registry = DriverRegistry::new();
    registry.register(driver);
    let m = SessionManager::new(
        registry,
        Arc::new(RecordingSink::default()),
        ProcessingSettings {
            fft_size: FFT,
            ..Default::default()
        },
    )
    .with_capture_mode(CaptureMode::Single);
    m.connect(SourceConfig::new("gated")).unwrap();
    m.start().unwrap();
    let gate = Gate {
        reading: reading_rx,
        release: release_tx,
        reads,
    };
    (m, gate)
}

#[test]
fn stop_during_a_single_sweep_discards_it() {
    let (m, gate) = gated_capture();
    gate.reading
        .recv_timeout(WAIT)
        .expect("the sweep is in flight");

    let stop_called = AtomicBool::new(false);
    std::thread::scope(|scope| {
        let stop = scope.spawn(|| {
            stop_called.store(true, Ordering::SeqCst);
            m.stop()
        });
        // The Stop is queued once its thread is inside `stop()`. The worker reads the queue only
        // after the read returns, so the release must come after it; a bounded wait gives the
        // stop thread that head start. (A late release would publish the sweep and fail below.)
        let deadline = std::time::Instant::now() + WAIT;
        while !stop_called.load(Ordering::SeqCst) {
            assert!(
                std::time::Instant::now() < deadline,
                "the stop thread never ran"
            );
            std::thread::yield_now();
        }
        std::thread::sleep(Duration::from_millis(50));
        gate.release.send(()).unwrap();
        stop.join().unwrap().unwrap();
    });

    let s = m.status();
    assert_eq!(s.state, SessionState::Connected);
    assert!(s.last_notice.is_none(), "a cancel is not a failure");
    assert!(
        m.wait_frame(0, Duration::from_millis(100)).is_none(),
        "the cancelled sweep is never published"
    );
    assert_eq!(gate.reads.load(Ordering::SeqCst), 1);
}

#[test]
fn stop_after_the_sweep_was_published_is_a_late_cancel() {
    let (m, gate) = gated_capture();
    gate.reading
        .recv_timeout(WAIT)
        .expect("the sweep is in flight");
    gate.release.send(()).unwrap();
    m.wait_frame(0, WAIT).expect("the sweep is published");
    wait_until(&m, |s| s.state == SessionState::Connected);

    m.stop().unwrap();
    let s = m.status();
    assert_eq!(s.state, SessionState::Connected);
    assert!(s.last_notice.is_none());
    assert!(
        m.wait_frame(0, WAIT).is_some(),
        "a sweep published before the Stop stays a completed capture"
    );
    assert_eq!(gate.reads.load(Ordering::SeqCst), 1);
}

#[test]
fn single_capture_read_error_fails_and_keeps_the_source() {
    let (driver, _) = sweep(Feed::Trace, Duration::ZERO, Fault::Recoverable);
    let m = sweep_manager(driver).with_capture_mode(CaptureMode::Single);
    m.connect(sweep_config()).unwrap();
    m.start().unwrap();

    let s = wait_until(&m, |s| s.state == SessionState::Connected);
    let notice = s.last_notice.expect("failure reported");
    assert_eq!(notice.kind, NoticeKind::AcquisitionFailed);
    assert_eq!(notice.message, "Single capture failed: Sweep timed out.");
    assert!(
        s.source.is_some(),
        "a recoverable error keeps the source open"
    );
    assert!(m.wait_frame(0, Duration::from_millis(100)).is_none());
}

#[test]
fn single_capture_fatal_read_error_is_device_loss() {
    let (driver, _) = sweep(Feed::Trace, Duration::ZERO, Fault::Fatal);
    let m = sweep_manager(driver).with_capture_mode(CaptureMode::Single);
    m.connect(sweep_config()).unwrap();
    m.start().unwrap();

    let s = wait_until(&m, |s| s.state == SessionState::Disconnected);
    let notice = s.last_notice.expect("device loss reported");
    assert_eq!(notice.kind, NoticeKind::DeviceLost);
    assert!(s.source.is_none());
}

#[test]
fn single_capture_without_a_sweep_times_out() {
    // One sample per read never fills an FFT, so no sweep is ever produced.
    let (driver, _) = sweep(
        Feed::Iq { block: 1 },
        Duration::from_millis(20),
        Fault::None,
    );
    let m = sweep_manager(driver)
        .with_capture_mode(CaptureMode::Single)
        .with_capture_timeout(Duration::from_millis(100));
    m.connect(sweep_config()).unwrap();
    m.start().unwrap();

    let s = wait_until(&m, |s| s.state == SessionState::Connected);
    let notice = s.last_notice.expect("timeout reported");
    assert_eq!(notice.kind, NoticeKind::AcquisitionFailed);
    assert_eq!(
        notice.message,
        "Single capture failed: the source produced no sweep in time."
    );
    assert!(m.wait_frame(0, Duration::from_millis(100)).is_none());
}

#[test]
fn stop_during_a_continuous_capture_is_unchanged() {
    let (driver, _) = sweep(Feed::Trace, Duration::ZERO, Fault::None);
    let m = sweep_manager(driver);
    m.connect(sweep_config()).unwrap();
    m.start().unwrap();
    let f = m.wait_frame(0, WAIT).expect("continuous frames");
    let next = m
        .wait_frame(f.frame.header.seq, WAIT)
        .expect("keeps streaming");
    assert!(next.frame.header.seq > f.frame.header.seq);
    m.stop().unwrap();
    assert_eq!(m.status().state, SessionState::Connected);
}
