//! Session-level scenarios: lifecycle, switching, settings, failures and recovery.
#![allow(clippy::unwrap_used)] // test helpers outside #[test] functions

use std::sync::{Arc, Mutex};
use std::time::Duration;

use spectrum_core::model::{
    AmplitudeUnit, Capabilities, DataKind, DriverInfo, DriverStatus, NoticeKind, ParamValue,
    ProcessingSettings, SessionState, SessionStatus, SettingsPatch, SourceConfig, SourceKind,
    SourceSettings, Transport,
};
use spectrum_core::sources::simulator::{self, SimulatorDriver};
use spectrum_core::sources::{
    OpenedSource, Source, SourceData, SourceDriver, SourceError, TraceBlock,
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
                    finite: true,
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
        })
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
    /// Two traces, then a recoverable error, then two traces and end of stream.
    fn read(&mut self, _wanted: usize) -> Result<SourceData, SourceError> {
        self.reads += 1;
        std::thread::sleep(Duration::from_millis(5));
        match self.reads {
            3 => Err(SourceError::Io("Timeout reading trace.".into())),
            6 => Ok(SourceData::EndOfStream),
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
    assert_eq!(m.start(), Err(SessionError::NotConnected));

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
    assert!(
        m.latest_frame().is_some(),
        "last frame stays available for export"
    );

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
    m.wait_frame(0, WAIT).unwrap();

    let status = m
        .connect(SourceConfig::new("scripted"))
        .expect("switch to second source");
    let active = status.source.unwrap();
    assert_eq!(active.driver_name, "Scripted analyzer");
    assert_eq!(status.state, SessionState::Connected);
    assert!(
        m.latest_frame().is_none(),
        "frames from the previous source are discarded"
    );
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
    assert_eq!(m.start(), Err(SessionError::NotConnected));

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
        err,
        SessionError::Source(SourceError::Unavailable(_))
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
fn trace_sources_report_read_errors_and_end_of_stream() {
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

    m.start().unwrap();
    let s = wait_until(&m, |s| {
        s.last_notice
            .as_ref()
            .is_some_and(|n| n.kind == NoticeKind::EndOfStream)
    });
    assert_eq!(s.state, SessionState::Connected);
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
