//! Connect-and-remember orchestration against a real store and the simulator.
#![allow(clippy::unwrap_used)]

use std::sync::Arc;

use spectrum_core::model::{
    DeviceDescriptor, DriverInfo, DriverStatus, ParamKind, ParamSpec, ParamValue,
    ProcessingSettings, SessionState, SourceConfig, SourceKind, SourceUpdate, Transport,
};
use spectrum_core::remember::{
    add_source, connect_new, connect_remembered, is_in_use, update_source,
};
use spectrum_core::sources::simulator::{self, SimulatorDriver};
use spectrum_core::sources::{OpenedSource, SourceDriver, SourceError};
use spectrum_core::store::{ConfigStore, connectable};
use spectrum_core::{DriverRegistry, NullSink, SessionManager};

fn session() -> SessionManager {
    let mut registry = DriverRegistry::new();
    registry.register(SimulatorDriver::unpaced());
    SessionManager::new(registry, Arc::new(NullSink), ProcessingSettings::default())
}

fn sim() -> SourceConfig {
    SourceConfig::new(simulator::DRIVER_ID)
}

fn stale() -> SourceConfig {
    let mut c = sim();
    c.settings.center_hz = Some(7e9);
    c
}

#[test]
fn success_remembers_and_selects() {
    let dir = tempfile::tempdir().unwrap();
    let (m, store) = (session(), ConfigStore::open(dir.path()));
    let status = connect_new(&m, &store, sim()).unwrap();
    assert_eq!(status.state, SessionState::Connected);
    let all = store.sources_all();
    assert_eq!(all.len(), 1);
    assert!(!all[0].label.is_empty());
    assert_eq!(store.preferences().last_source_id, Some(all[0].id.clone()));

    // Connecting the same identity again touches the entry instead of adding one.
    connect_new(&m, &store, sim()).unwrap();
    assert_eq!(store.sources_all().len(), 1);
}

#[test]
fn failure_remembers_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let (m, store) = (session(), ConfigStore::open(dir.path()));
    assert!(connect_new(&m, &store, stale()).is_err());
    assert!(connect_new(&m, &store, SourceConfig::new("nope")).is_err());
    assert!(store.sources_all().is_empty());
    assert_eq!(store.preferences().last_source_id, None);
    assert!(!dir.path().join("sources.json").exists());
}

#[test]
fn connect_by_id_updates_only_that_entry() {
    let dir = tempfile::tempdir().unwrap();
    let (m, store) = (session(), ConfigStore::open(dir.path()));
    connect_new(&m, &store, sim()).unwrap();
    let mut other = sim();
    other.device_id = Some("b".into());
    connect_new(&m, &store, other).unwrap();
    let before = store.sources_all();
    assert_eq!(before.len(), 2);

    let first = before[0].clone();
    connect_remembered(&m, &store, &first.id).unwrap();
    let after = store.sources_all();
    assert_eq!(after.len(), 2);
    assert_eq!(after[1], before[1], "the other entry is untouched");
    assert!(after[0].last_used_ms >= first.last_used_ms);
    assert_eq!(store.preferences().last_source_id, Some(first.id));
}

#[test]
fn unknown_id_is_an_error_and_changes_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let (m, store) = (session(), ConfigStore::open(dir.path()));
    let err = connect_remembered(&m, &store, "ghost").unwrap_err();
    assert_eq!(err.to_string(), "That source no longer exists.");
    assert_eq!(store.preferences().last_source_id, None);
}

#[test]
fn stale_settings_retry_with_defaults_and_store_the_effective_ones() {
    let dir = tempfile::tempdir().unwrap();
    let (m, store) = (session(), ConfigStore::open(dir.path()));
    connect_new(&m, &store, sim()).unwrap();
    let id = store.sources_all()[0].id.clone();
    // Corrupt the stored settings the way an old file could.
    {
        let mut entry = store.sources_all()[0].clone();
        entry.config = stale();
        store.forget_source(&id).unwrap();
        store.restore_source(entry).unwrap();
    }
    let status = connect_remembered(&m, &store, &id).unwrap();
    assert_eq!(status.state, SessionState::Connected);
    let stored = &store.sources_all()[0];
    assert_ne!(stored.config.settings.center_hz, Some(7e9));
    assert_eq!(store.preferences().last_source_id, Some(id));
}

#[test]
fn failed_pick_of_a_remembered_source_keeps_it_selected() {
    let dir = tempfile::tempdir().unwrap();
    let (m, store) = (session(), ConfigStore::open(dir.path()));
    connect_new(&m, &store, sim()).unwrap();
    let entry = store.sources_all()[0].clone();
    // Same entry, but the driver no longer exists.
    let mut broken = entry.clone();
    broken.id = "broken".into();
    broken.config = SourceConfig::new("nope");
    store.restore_source(broken).unwrap();
    assert!(connect_remembered(&m, &store, "broken").is_err());
    assert_eq!(store.preferences().last_source_id, Some("broken".into()));
    assert_eq!(store.sources_all().len(), 2);
}

#[test]
fn persistence_failure_does_not_fail_the_connect() {
    let dir = tempfile::tempdir().unwrap();
    // A directory in place of the file makes every write of sources.json fail.
    std::fs::create_dir(dir.path().join("sources.json")).unwrap();
    let (m, store) = (session(), ConfigStore::open(dir.path()));
    let status = connect_new(&m, &store, sim()).unwrap();
    assert_eq!(status.state, SessionState::Connected);
    assert!(store.sources_all().is_empty());
}

#[test]
fn unrememberable_connect_clears_the_selection_so_settings_go_nowhere() {
    let dir = tempfile::tempdir().unwrap();
    let (m, store) = (session(), ConfigStore::open(dir.path()));
    // Fill the store to the cap with entries of a driver that is not available (so none can be
    // evicted).
    connect_new(&m, &store, sim()).unwrap();
    let template = store.sources_all()[0].clone();
    store.forget_source(&template.id).unwrap();
    for i in 0..200 {
        let mut e = template.clone();
        e.id = format!("full-{i}");
        e.config = SourceConfig::new("nope");
        e.config.device_id = Some(i.to_string());
        store.restore_source(e).unwrap();
    }
    store.set_last_source_id(Some("full-0")).unwrap();
    let before = store.sources_all();
    assert_eq!(before.len(), 200);

    let status = connect_new(&m, &store, sim()).unwrap();
    assert_eq!(status.state, SessionState::Connected);
    assert_eq!(store.sources_all(), before);
    assert_eq!(store.preferences().last_source_id, None);

    // What apply_source_settings does after a settings change: no selection, no write.
    let settings = status.source.unwrap().settings;
    if let Some(id) = store.preferences().last_source_id {
        store.update_source_settings(&id, &settings).unwrap();
    }
    assert_eq!(store.sources_all(), before);
}

#[test]
fn add_source_needs_a_registered_connectable_driver() {
    let dir = tempfile::tempdir().unwrap();
    let (m, store) = (session(), ConfigStore::open(dir.path()));
    let err = add_source(&m, &store, "Ghost", SourceConfig::new("nope")).unwrap_err();
    assert_eq!(err, "That source type is not available.");
    let err = add_source(&m, &store, "Sim", sim()).unwrap_err();
    assert_eq!(err, "The built-in simulator is always available.");
    assert!(store.sources_all().is_empty());
    assert_eq!(store.preferences().last_source_id, None);
}

#[test]
fn update_source_reports_unknown_ids_and_renames_while_connected() {
    let dir = tempfile::tempdir().unwrap();
    let (m, store) = (session(), ConfigStore::open(dir.path()));
    let rename = |name: &str| SourceUpdate {
        name: name.into(),
        device_id: None,
        connection: Default::default(),
    };
    let err = update_source(&m, &store, "nope", &rename("x")).unwrap_err();
    assert_eq!(err, "That source no longer exists.");

    let status = connect_new(&m, &store, sim()).unwrap();
    let rec = store.sources_all()[0].clone();
    assert!(is_in_use(&status, &rec), "connected simulator is in use");
    let saved = update_source(&m, &store, &rec.id, &rename("My sim")).unwrap();
    assert_eq!(saved.name, "My sim");
    assert_eq!(saved.last_used_ms, rec.last_used_ms);
    assert_eq!(store.preferences().last_source_id, Some(rec.id.clone()));

    // A connection change on the simulator is refused regardless of the session.
    let mut changed = rename("My sim");
    changed
        .connection
        .insert("x".into(), ParamValue::Number(1.0));
    assert_eq!(
        update_source(&m, &store, &rec.id, &changed).unwrap_err(),
        "The simulator has no settings."
    );
}

#[test]
fn a_record_is_not_in_use_when_the_session_is_idle_or_runs_another_source() {
    let dir = tempfile::tempdir().unwrap();
    let (m, store) = (session(), ConfigStore::open(dir.path()));
    let idle = m.status();
    connect_new(&m, &store, sim()).unwrap();
    let rec = store.sources_all()[0].clone();
    assert!(!is_in_use(&idle, &rec));
    let mut other = rec.clone();
    other.config.device_id = Some("elsewhere".into());
    assert!(!is_in_use(&m.status(), &other), "different identity");
}

// ---- Identity of an untested Save: one physical device is one row --------------------------

const ANALYZER: &str = "analyzer";

/// A scripted analyzer driver: discovery lists the given (serial, port) pairs, `open` always
/// fails (the tests below must never need to connect).
struct Scripted(Vec<(&'static str, &'static str)>);

impl SourceDriver for Scripted {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: ANALYZER.into(),
            name: "Analyzer".into(),
            description: String::new(),
            kind: SourceKind::SpectrumAnalyzer,
            transport: Transport::Usb,
            status: DriverStatus::Available,
            supports_discovery: true,
            connection_params: vec![ParamSpec {
                id: "port".into(),
                label: "Serial port".into(),
                group: None,
                help: None,
                kind: ParamKind::Text { max_length: 256 },
                default: ParamValue::Text(String::new()),
                required: false,
            }],
        }
    }

    fn discover(&self) -> Result<Vec<DeviceDescriptor>, SourceError> {
        Ok(self
            .0
            .iter()
            .map(|(serial, port)| DeviceDescriptor {
                driver_id: ANALYZER.into(),
                device_id: (*serial).into(),
                label: format!("Analyzer {serial}"),
                location: Some((*port).into()),
                details: vec![],
            })
            .collect())
    }

    fn open(&self, _: &SourceConfig) -> Result<OpenedSource, SourceError> {
        Err(SourceError::unavailable("scripted: never opens"))
    }
}

fn session_with(devices: Vec<(&'static str, &'static str)>) -> SessionManager {
    let mut registry = DriverRegistry::new();
    registry.register(Scripted(devices));
    SessionManager::new(registry, Arc::new(NullSink), ProcessingSettings::default())
}

fn at(port: &str) -> SourceConfig {
    let mut c = SourceConfig::new(ANALYZER);
    c.connection
        .insert("port".into(), ParamValue::Text(port.into()));
    c
}

#[test]
fn adding_the_port_of_a_detected_device_binds_its_serial() {
    let dir = tempfile::tempdir().unwrap();
    let m = session_with(vec![("S1", "/dev/ttyACM0"), ("S2", "/dev/ttyACM1")]);
    let store = ConfigStore::open(dir.path());
    let saved = add_source(&m, &store, "Bench", at("/dev/ttyACM1")).unwrap();
    assert_eq!(saved.config.device_id.as_deref(), Some("S2"));
    assert_eq!(saved.name, "Bench");
    // The device is now remembered: a second untested Add of its port is a duplicate, not a row.
    let err = add_source(&m, &store, "Again", at("/dev/ttyACM1")).unwrap_err();
    assert!(err.contains("Bench"), "{err}");
    assert_eq!(store.sources_all().len(), 1);
}

#[test]
fn adding_a_port_with_nothing_detected_there_stays_unbound() {
    let dir = tempfile::tempdir().unwrap();
    let m = session_with(vec![("S1", "/dev/ttyACM0")]);
    let store = ConfigStore::open(dir.path());
    let saved = add_source(&m, &store, "Elsewhere", at("/dev/ttyUSB7")).unwrap();
    assert_eq!(saved.config.device_id, None);
    // Two devices claiming one port is ambiguous: do not guess.
    let m = session_with(vec![("S1", "/dev/ttyACM0"), ("S2", "/dev/ttyACM0")]);
    let saved = add_source(&m, &store, "Ambiguous", at("/dev/ttyACM0")).unwrap();
    assert_eq!(saved.config.device_id, None);
}

#[test]
fn an_explicit_serial_is_kept_even_if_the_port_belongs_to_another_device() {
    let dir = tempfile::tempdir().unwrap();
    let m = session_with(vec![("S1", "/dev/ttyACM0")]);
    let store = ConfigStore::open(dir.path());
    let mut config = at("/dev/ttyACM0");
    config.device_id = Some("S9".into());
    let saved = add_source(&m, &store, "Tested", config).unwrap();
    assert_eq!(saved.config.device_id.as_deref(), Some("S9"));
}

#[test]
fn editing_the_port_of_an_unbound_entry_binds_the_device_found_there() {
    let dir = tempfile::tempdir().unwrap();
    let m = session_with(vec![]);
    let store = ConfigStore::open(dir.path());
    let saved = add_source(&m, &store, "Bench", at("/dev/ttyACM5")).unwrap();
    assert_eq!(saved.config.device_id, None);

    let m = session_with(vec![("S1", "/dev/ttyACM0")]);
    let update = |port: &str| SourceUpdate {
        name: "Bench".into(),
        device_id: None,
        connection: at(port).connection,
    };
    let edited = update_source(&m, &store, &saved.id, &update("/dev/ttyACM0")).unwrap();
    assert_eq!(edited.config.device_id.as_deref(), Some("S1"));
    assert_eq!(store.sources_all().len(), 1);

    // A bound entry keeps its identity when only the port hint changes.
    let moved = update_source(&m, &store, &saved.id, &update("/dev/ttyACM3")).unwrap();
    assert_eq!(moved.config.device_id.as_deref(), Some("S1"));
}

/// Entries of drivers that no longer exist (file readers removed) must load, stay hidden from the
/// connectable list, survive a rewrite of `sources.json` and never break normalisation.
#[test]
fn entries_of_removed_drivers_stay_hidden_and_survive_a_rewrite() {
    let dir = tempfile::tempdir().unwrap();
    let legacy = r#"{
        "version": 3,
        "sources": [
            {"id": "old-csv", "name": "Old trace", "config": {
                "driverId": "trace-csv", "connection": {"path": "/x/trace.csv"}},
             "createdMs": 1, "updatedMs": 1, "lastUsedMs": 1},
            {"id": "old-iq", "name": "Old IQ", "config": {
                "driverId": "iq-file", "connection": {"path": "/x/tone.cf32"}},
             "createdMs": 2, "updatedMs": 2, "lastUsedMs": 2}
        ]
    }"#;
    std::fs::write(dir.path().join("sources.json"), legacy).unwrap();
    let registry = DriverRegistry::with_core_drivers();
    let store = ConfigStore::open_with(dir.path(), &|driver, id, label| {
        registry.normalize_device_id(driver, id, label)
    });
    assert!(store.warnings().is_empty());
    assert_eq!(store.sources_all().len(), 2);
    assert!(connectable(&store.sources_all(), &registry.infos()).is_empty());
    assert_eq!(registry.normalize_device_id("iq-file", None, "x"), None);

    // A connect rewrites the file; the removed-driver entries are carried over untouched.
    let m = session();
    connect_new(&m, &store, sim()).unwrap();
    let reopened = ConfigStore::open(dir.path());
    let all = reopened.sources_all();
    assert!(
        all.iter()
            .any(|s| s.id == "old-csv" && s.name == "Old trace")
    );
    assert!(
        all.iter()
            .any(|s| s.id == "old-iq" && s.config.driver_id == "iq-file")
    );
    let visible = connectable(&all, &registry.infos());
    assert_eq!(visible.len(), 1);
    assert_eq!(visible[0].config.driver_id, simulator::DRIVER_ID);
}
