//! IPC commands. Each one validates its input (via typed deserialisation and core validation),
//! runs blocking work off the main thread and maps errors to user-facing messages.

use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use spectrum_core::SessionManager;
use spectrum_core::formats::csv::write_spectrum_csv;
use spectrum_core::model::{
    DeviceDescriptor, DriverInfo, ProcessingSettings, SessionStatus, SettingsPatch, SourceConfig,
    SourceSettings,
};
use spectrum_core::store::{DisplayPreferences, Preferences, SavedSource};
use tauri::ipc::Response;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

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
pub async fn connect_source(
    state: State<'_, AppState>,
    config: SourceConfig,
) -> CommandResult<SessionStatus> {
    let status = blocking(&state.session, move |s| s.connect(config)).await??;
    let config = status.source.as_ref().map(|a| a.config.clone());
    // Remember the selection for the next start; a failure here must not fail the connection.
    if let Err(e) = state.store.update_preferences(|p| p.last_source = config) {
        tracing::warn!(error = %e, "could not save the last used source");
    }
    Ok(status)
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
    Ok(blocking(&state.session, move |s| s.apply_settings(patch)).await??)
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

#[tauri::command]
pub fn list_saved_sources(state: State<'_, AppState>) -> Vec<SavedSource> {
    state.store.saved_sources()
}

#[tauri::command]
pub fn save_source(
    state: State<'_, AppState>,
    id: Option<String>,
    name: String,
    config: SourceConfig,
) -> CommandResult<SavedSource> {
    Ok(state.store.save_source(id.as_deref(), &name, config)?)
}

#[tauri::command]
pub fn delete_saved_source(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    Ok(state.store.delete_source(&id)?)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub path: String,
    pub points: usize,
}

/// Asks for a destination with a native dialog and writes the latest frame as CSV. Returns
/// `None` if the user cancelled. The path never comes from the webview.
#[tauri::command]
pub async fn export_csv(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CommandResult<Option<ExportResult>> {
    let Some(frame) = state.session.latest_frame() else {
        return Err(CommandError::new(
            "There is no spectrum to export yet. Start an acquisition first.",
        ));
    };
    let file_name = format!(
        "spectrum-{}.csv",
        spectrum_core::display::iso8601_utc(frame.frame.header.timestamp_ms)
            .replace([':', '.'], "-")
    );
    let directory = app
        .path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .ok();
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app
            .dialog()
            .file()
            .set_title("Export spectrum as CSV")
            .set_file_name(&file_name)
            .add_filter("CSV", &["csv"]);
        if let Some(dir) = directory {
            dialog = dialog.set_directory(dir);
        }
        let Some(path) = dialog.blocking_save_file() else {
            return Ok(None);
        };
        let mut path = path
            .into_path()
            .map_err(|_| CommandError::new("Only local files can be written."))?;
        if path
            .extension()
            .is_none_or(|e| !e.eq_ignore_ascii_case("csv"))
        {
            path.set_extension("csv");
        }
        let file = std::fs::File::create(&path)
            .map_err(|e| CommandError::new(format!("Could not create {}: {e}", path.display())))?;
        let mut writer = std::io::BufWriter::new(file);
        write_spectrum_csv(&frame.frame, &mut writer)
            .and_then(|()| std::io::Write::flush(&mut writer))
            .map_err(|e| CommandError::new(format!("Could not write {}: {e}", path.display())))?;
        Ok(Some(ExportResult {
            path: path.display().to_string(),
            points: frame.frame.live.len(),
        }))
    })
    .await?
}
