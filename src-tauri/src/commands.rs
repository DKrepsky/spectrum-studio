//! IPC commands. Each one validates its input (via typed deserialisation and core validation),
//! runs blocking work off the main thread and maps errors to user-facing messages.

use std::sync::Arc;
use std::time::Duration;

use spectrum_core::SessionManager;
use spectrum_core::model::{
    DeviceDescriptor, DiscoveryResult, DriverInfo, ParamMap, ProcessingSettings, SessionStatus,
    SettingsPatch, SourceConfig, SourceSettings, SourceTestResult, SourceUpdate,
};
use spectrum_core::remember;
use spectrum_core::store::{DisplayPreferences, Preferences, SavedSource, SourceList};
use tauri::State;
use tauri::ipc::Response;

use crate::error::{CommandError, CommandResult};
use crate::state::AppState;

/// How long `next_frame` waits for a new frame before returning an empty response.
const FRAME_POLL_TIMEOUT: Duration = Duration::from_millis(500);

async fn blocking<T: Send + 'static>(
    session: &Arc<SessionManager>,
    f: impl FnOnce(&SessionManager) -> T + Send + 'static,
) -> CommandResult<T> {
    let session = session.clone();
    Ok(tauri::async_runtime::spawn_blocking(move || f(&session)).await?)
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> SessionStatus {
    state.session.status()
}

#[tauri::command]
pub fn list_drivers(state: State<'_, AppState>) -> Vec<DriverInfo> {
    state.session.drivers()
}

#[tauri::command]
pub async fn discover_devices(
    state: State<'_, AppState>,
    driver_id: String,
) -> CommandResult<Vec<DeviceDescriptor>> {
    Ok(blocking(&state.session, move |s| s.discover(&driver_id)).await??)
}

#[tauri::command]
pub fn list_sources(state: State<'_, AppState>) -> SourceList {
    state.store.source_list(&state.session.drivers())
}

/// Scans every driver that can enumerate devices. A failing driver is reported in its result.
#[tauri::command]
pub async fn discover_all(state: State<'_, AppState>) -> CommandResult<Vec<DiscoveryResult>> {
    blocking(&state.session, |s| s.discover_all()).await
}

/// Connects the remembered source `id` with its stored settings.
#[tauri::command]
pub async fn connect_remembered(
    state: State<'_, AppState>,
    id: String,
) -> CommandResult<SessionStatus> {
    let store = state.store.clone();
    Ok(blocking(&state.session, move |s| {
        remember::connect_remembered(s, &store, &id)
    })
    .await??)
}

/// Connects an ad hoc configuration and remembers it if the connection succeeds.
#[tauri::command]
pub async fn connect_source(
    state: State<'_, AppState>,
    config: SourceConfig,
) -> CommandResult<SessionStatus> {
    let store = state.store.clone();
    Ok(blocking(&state.session, move |s| {
        remember::connect_new(s, &store, config)
    })
    .await??)
}

#[tauri::command]
pub async fn disconnect_source(state: State<'_, AppState>) -> CommandResult<()> {
    blocking(&state.session, |s| s.disconnect()).await
}

#[tauri::command]
pub async fn start_acquisition(state: State<'_, AppState>) -> CommandResult<()> {
    Ok(blocking(&state.session, |s| s.start()).await??)
}

#[tauri::command]
pub async fn stop_acquisition(state: State<'_, AppState>) -> CommandResult<()> {
    Ok(blocking(&state.session, |s| s.stop()).await??)
}

#[tauri::command]
pub async fn apply_source_settings(
    state: State<'_, AppState>,
    patch: SettingsPatch,
) -> CommandResult<SourceSettings> {
    let settings = blocking(&state.session, move |s| s.apply_settings(patch)).await??;
    // Remember the effective settings with the selected source; the change itself is applied,
    // so a persistence problem is only logged.
    if let Some(id) = state.store.preferences().last_source_id
        && let Err(e) = state.store.update_source_settings(&id, &settings)
    {
        tracing::warn!(error = %e, "could not save the source settings");
    }
    Ok(settings)
}

#[tauri::command]
pub async fn set_processing(
    state: State<'_, AppState>,
    settings: ProcessingSettings,
) -> CommandResult<()> {
    let to_store = settings.clone();
    blocking(&state.session, move |s| s.set_processing(settings)).await??;
    state
        .store
        .update_preferences(|p| p.processing = to_store)
        .map_err(|e| CommandError::new(format!("The setting was applied but not saved: {e}")))?;
    Ok(())
}

#[tauri::command]
pub fn reset_holds(state: State<'_, AppState>) {
    state.session.reset_holds();
}

#[tauri::command]
pub fn dismiss_notice(state: State<'_, AppState>) {
    state.session.dismiss_notice();
}

/// Long-poll for the next frame newer than `after_seq`. Returns the binary frame (ADR 0003), or
/// an empty body if none arrived within the poll timeout.
#[tauri::command]
pub async fn next_frame(state: State<'_, AppState>, after_seq: u32) -> CommandResult<Response> {
    let frame = blocking(&state.session, move |s| {
        s.wait_frame(after_seq, FRAME_POLL_TIMEOUT)
    })
    .await?;
    Ok(Response::new(
        frame.map(|f| f.bytes.clone()).unwrap_or_default(),
    ))
}

#[tauri::command]
pub fn get_preferences(state: State<'_, AppState>) -> Preferences {
    state.store.preferences()
}

/// Problems found while loading persisted files (reported once to the user).
#[tauri::command]
pub fn store_warnings(state: State<'_, AppState>) -> Vec<String> {
    state.store.warnings().to_vec()
}

#[tauri::command]
pub fn save_display_preferences(
    state: State<'_, AppState>,
    display: DisplayPreferences,
) -> CommandResult<()> {
    state.store.update_preferences(|p| p.display = display)?;
    Ok(())
}

/// Creates a record without connecting.
#[tauri::command]
pub async fn add_source(
    state: State<'_, AppState>,
    name: String,
    config: SourceConfig,
) -> CommandResult<SourceList> {
    let store = state.store.clone();
    blocking(&state.session, move |s| {
        remember::add_source(s, &store, &name, config).map(|_| store.source_list(&s.drivers()))
    })
    .await?
    .map_err(CommandError::new)
}

/// Edits a record's name and connection (the connection is locked while it is the live source).
#[tauri::command]
pub async fn update_source(
    state: State<'_, AppState>,
    id: String,
    update: SourceUpdate,
) -> CommandResult<SourceList> {
    let store = state.store.clone();
    blocking(&state.session, move |s| {
        remember::update_source(s, &store, &id, &update).map(|_| store.source_list(&s.drivers()))
    })
    .await?
    .map_err(CommandError::new)
}

/// Opens a device with exactly `connection` and closes it again, without touching the session.
#[tauri::command]
pub async fn test_source(
    state: State<'_, AppState>,
    driver_id: String,
    connection: ParamMap,
) -> CommandResult<SourceTestResult> {
    Ok(blocking(&state.session, move |s| {
        s.test_source(&driver_id, connection)
    })
    .await??)
}

#[tauri::command]
pub fn forget_source(state: State<'_, AppState>, id: String) -> CommandResult<SourceList> {
    state.store.forget_source(&id)?;
    Ok(state.store.source_list(&state.session.drivers()))
}

#[tauri::command]
pub fn restore_source(
    state: State<'_, AppState>,
    source: SavedSource,
) -> CommandResult<SourceList> {
    state.store.restore_source(source)?;
    Ok(state.store.source_list(&state.session.drivers()))
}
