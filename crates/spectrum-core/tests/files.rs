//! Recordings through the full session: SigMF playback and CSV export → import round trip.
#![allow(clippy::unwrap_used)] // test helpers outside #[test] functions

use std::io::Write;
use std::sync::Arc;
use std::time::Duration;

use spectrum_core::formats::csv::write_spectrum_csv;
use spectrum_core::model::{
    AmplitudeUnit, DataKind, ParamValue, ProcessingSettings, SessionState, SourceConfig,
};
use spectrum_core::sources::files::{
    IQ_FILE_DRIVER_ID, IqFileDriver, TRACE_FILE_DRIVER_ID, TraceFileDriver,
};
use spectrum_core::sources::simulator::{self, SimulatorDriver};
use spectrum_core::{DriverRegistry, NullSink, SessionManager};

const WAIT: Duration = Duration::from_secs(5);

fn manager() -> SessionManager {
    let mut registry = DriverRegistry::new();
    registry.register(SimulatorDriver::unpaced());
    registry.register(IqFileDriver::unpaced());
    registry.register(TraceFileDriver);
    SessionManager::new(
        registry,
        Arc::new(NullSink),
        ProcessingSettings {
            fft_size: 2048,
            ..Default::default()
        },
    )
}

fn path_config(driver: &str, path: &std::path::Path) -> SourceConfig {
    let mut config = SourceConfig::new(driver);
    config.connection.insert(
        "path".into(),
        ParamValue::Text(path.to_str().unwrap().into()),
    );
    config
}

#[test]
fn sigmf_recording_is_analysed_like_a_live_source() {
    let dir = tempfile::tempdir().unwrap();
    let fs = 1_000_000.0;
    let tone_offset = 125_000.0; // exactly on a bin for N = 2048
    let amplitude = 0.25f64; // -12.04 dBFS
    std::fs::write(
        dir.path().join("rec.sigmf-meta"),
        format!(
            r#"{{"global":{{"core:datatype":"cf32_le","core:sample_rate":{fs},"core:version":"1.0.0"}},
               "captures":[{{"core:sample_start":0,"core:frequency":145000000}}],"annotations":[]}}"#
        ),
    )
    .unwrap();
    let mut data = std::fs::File::create(dir.path().join("rec.sigmf-data")).unwrap();
    for n in 0..200_000 {
        let ph = 2.0 * std::f64::consts::PI * tone_offset * n as f64 / fs;
        data.write_all(&((amplitude * ph.cos()) as f32).to_le_bytes())
            .unwrap();
        data.write_all(&((amplitude * ph.sin()) as f32).to_le_bytes())
            .unwrap();
    }
    drop(data);

    let m = manager();
    let status = m
        .connect(path_config(
            IQ_FILE_DRIVER_ID,
            &dir.path().join("rec.sigmf-meta"),
        ))
        .unwrap();
    let source = status.source.unwrap();
    assert!(!source.simulated);
    assert_eq!(source.device_label, "rec.sigmf-meta");
    assert_eq!(source.settings.center_hz, 145e6);
    m.start().unwrap();
    let frame = m.wait_frame(0, WAIT).unwrap();
    let h = &frame.frame.header;
    assert_eq!(h.unit, AmplitudeUnit::Dbfs);
    assert_eq!(h.span_hz, fs);
    let peak = &h.peaks[0];
    assert!(
        (peak.frequency_hz - (145e6 + tone_offset)).abs() < 1.0,
        "{peak:?}"
    );
    assert!(
        (peak.amplitude - 20.0 * amplitude.log10()).abs() < 0.05,
        "{peak:?}"
    );
}

#[test]
fn exported_csv_reloads_as_a_trace_source_with_identical_values() {
    let m = manager();
    m.connect(SourceConfig::new(simulator::DRIVER_ID)).unwrap();
    m.start().unwrap();
    let exported = m.wait_frame(0, WAIT).unwrap();
    m.stop().unwrap();

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("export.csv");
    let mut file = std::fs::File::create(&path).unwrap();
    write_spectrum_csv(&exported.frame, &mut file).unwrap();
    drop(file);

    m.connect(path_config(TRACE_FILE_DRIVER_ID, &path)).unwrap();
    m.start().unwrap();
    let after = exported.frame.header.seq;
    let reloaded = m.wait_frame(after, WAIT).unwrap();
    let h = &reloaded.frame.header;
    assert_eq!(h.data_kind, DataKind::Trace);
    assert_eq!(
        h.unit,
        AmplitudeUnit::Dbfs,
        "unit is taken from the export metadata"
    );
    assert_eq!(h.bins, exported.frame.header.bins);
    assert!((h.start_hz - exported.frame.header.start_hz).abs() < 1e-3);
    for (a, b) in reloaded.frame.live.iter().zip(&exported.frame.live) {
        // The CSV stores levels with 0.001 dB resolution.
        assert!((a - b).abs() <= 0.001, "{a} vs {b}");
    }
    // A single trace ends the "recording": acquisition stops by itself.
    let deadline = std::time::Instant::now() + WAIT;
    while m.status().state != SessionState::Connected {
        assert!(std::time::Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(5));
    }
}
