//! Connects a source and remembers it: the orchestration behind the "pick a source" commands.
//!
//! Remembering is best effort. A source that connected stays connected even if the store cannot
//! be written (disk full, read-only directory, entry cap); the problem is logged.

use crate::model::{
    DriverInfo, DriverStatus, ParamMap, ParamValue, SessionState, SessionStatus, SourceConfig,
    SourceUpdate,
};
use crate::session::{SessionError, SessionManager};
use crate::store::{ConfigStore, SavedSource, same_identity};

/// Connects the remembered source `id` (with its stored settings, falling back to defaults when
/// they are stale) and, on success, refreshes that entry. `last_source_id` is set when the
/// attempt starts, so a failed pick is still the selection.
pub fn connect_remembered(
    session: &SessionManager,
    store: &ConfigStore,
    id: &str,
) -> Result<SessionStatus, SessionError> {
    let config = store
        .sources_all()
        .into_iter()
        .find(|s| s.id == id)
        .map(|s| s.config)
        .ok_or_else(|| SessionError::Invalid("That source no longer exists.".into()))?;
    log_failure(store.set_last_source_id(Some(id)));
    let status = session.connect_with_default_fallback(config)?;
    remember(session, store, Some(id), &status);
    Ok(status)
}

/// Connects an ad hoc configuration and, on success only, remembers it (touching the existing
/// entry with the same identity, or creating one).
pub fn connect_new(
    session: &SessionManager,
    store: &ConfigStore,
    config: SourceConfig,
) -> Result<SessionStatus, SessionError> {
    let status = session.connect(config)?;
    remember(session, store, None, &status);
    Ok(status)
}

/// Whether `record` is the source of the live session: the session is connecting, connected,
/// acquiring or disconnecting and the resolved identity of its active source matches.
pub fn is_in_use(status: &SessionStatus, record: &SavedSource) -> bool {
    matches!(
        status.state,
        SessionState::Connecting
            | SessionState::Connected
            | SessionState::Acquiring
            | SessionState::Disconnecting
    ) && status
        .source
        .as_ref()
        .is_some_and(|a| same_identity(&a.config, &record.config))
}

/// The serial of the detected device that sits at the place `connection` points to, when the
/// driver can enumerate devices and exactly one of them is there. This is an enumerate-only scan
/// (discovery never opens a device), so it is safe next to a running session. It makes an untested
/// Save of a port bind to the same identity the scan already shows, so one device is one row.
fn identify_by_location(
    session: &SessionManager,
    driver: &DriverInfo,
    connection: &ParamMap,
) -> Option<String> {
    if !driver.supports_discovery {
        return None;
    }
    let devices = session.discover(&driver.id).ok()?;
    let mut here = devices.iter().filter(|d| {
        d.location.as_deref().is_some_and(|loc| {
            connection
                .values()
                .any(|v| matches!(v, ParamValue::Text(t) if t == loc))
        })
    });
    match (here.next(), here.next()) {
        (Some(device), None) => Some(device.device_id.clone()),
        _ => None,
    }
}

/// Creates a record without connecting (no session or selection change). A connection without a
/// device id is bound to the detected device at that place, if any (see `identify_by_location`).
pub fn add_source(
    session: &SessionManager,
    store: &ConfigStore,
    name: &str,
    mut config: SourceConfig,
) -> Result<SavedSource, String> {
    let drivers = session.drivers();
    let driver = drivers
        .iter()
        .find(|d| d.id == config.driver_id)
        .ok_or("That source type is not available.")?;
    if config.device_id.is_none() {
        config.device_id = identify_by_location(session, driver, &config.connection);
    }
    store.add_source(name, config, driver, |id| is_available(&drivers, id))
}

/// Edits a record; the connection settings are locked while it is the live source.
pub fn update_source(
    session: &SessionManager,
    store: &ConfigStore,
    id: &str,
    update: &SourceUpdate,
) -> Result<SavedSource, String> {
    let mut update = update.clone();
    let record = store
        .sources_all()
        .into_iter()
        .find(|s| s.id == id)
        .ok_or("That source no longer exists.")?;
    let drivers = session.drivers();
    let driver = drivers
        .iter()
        .find(|d| d.id == record.config.driver_id)
        .ok_or("That source type is not available.")?;
    let locked = is_in_use(&session.status(), &record);
    // An entry that only knows its port (never connected or tested) adopts the identity of the
    // device detected there, so editing the port cannot leave a second row for that device.
    if update.device_id.is_none() && record.config.device_id.is_none() && !locked {
        update.device_id = identify_by_location(session, driver, &update.connection);
    }
    store.update_source(id, &update, driver, locked)
}

fn is_available(drivers: &[crate::model::DriverInfo], driver_id: &str) -> bool {
    drivers
        .iter()
        .any(|d| d.id == driver_id && d.status == DriverStatus::Available)
}

fn remember(
    session: &SessionManager,
    store: &ConfigStore,
    id: Option<&str>,
    status: &SessionStatus,
) {
    let Some(active) = status.source.as_ref() else {
        return;
    };
    let drivers = session.drivers();
    let available = |driver_id: &str| is_available(&drivers, driver_id);
    match store.remember_connected(id, active, available) {
        Ok(saved) => log_failure(store.set_last_source_id(Some(&saved.id))),
        Err(e) => {
            tracing::warn!(error = %e, "could not remember the connected source");
            // The connected source has no entry; leaving the previous selection would make a
            // later settings change overwrite that other source's entry.
            log_failure(store.set_last_source_id(None));
        }
    }
}

fn log_failure(result: Result<(), String>) {
    if let Err(e) = result {
        tracing::warn!(error = %e, "could not save the selected source");
    }
}
