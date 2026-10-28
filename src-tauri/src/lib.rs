//! Tauri shell: wires the core session to IPC commands and events. Domain logic lives in
//! `spectrum-core`.

mod commands;
mod error;
mod sink;
mod state;

use std::sync::Arc;

use spectrum_core::store::ConfigStore;
use spectrum_core::{DriverRegistry, SessionManager};
use spectrum_driver_sa430::Sa430Driver;
use tauri::{Manager, RunEvent};

use crate::sink::EventSink;
use crate::state::AppState;

/// Composition root for signal sources: the core's drivers plus every hardware driver crate.
fn driver_registry() -> DriverRegistry {
    let mut registry = DriverRegistry::with_core_drivers();
    registry.register(Sa430Driver::new());
    registry
}

/// Logs to stderr. `RUST_LOG` overrides the default level (e.g. `RUST_LOG=spectrum_core=debug`).
fn init_logging() {
    use tracing_subscriber::EnvFilter;
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    // Ignore the error: a subscriber may already be installed (tests, embedding).
    let _ = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(std::io::stderr)
        .try_init();
}

pub fn run() {
    init_logging();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let store = ConfigStore::open(app.path().app_config_dir()?);
            let session = SessionManager::new(
                driver_registry(),
                Arc::new(EventSink(app.handle().clone())),
                store.preferences().processing,
            );
            app.manage(AppState {
                session: Arc::new(session),
                store: Arc::new(store),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::list_drivers,
            commands::discover_devices,
            commands::connect_source,
            commands::disconnect_source,
            commands::start_acquisition,
            commands::stop_acquisition,
            commands::apply_source_settings,
            commands::set_processing,
            commands::reset_holds,
            commands::dismiss_notice,
            commands::next_frame,
            commands::get_preferences,
            commands::store_warnings,
            commands::save_display_preferences,
            commands::list_saved_sources,
            commands::save_source,
            commands::delete_saved_source,
            commands::export_csv,
        ])
        .build(tauri::generate_context!());

    let app = match app {
        Ok(app) => app,
        Err(e) => {
            tracing::error!(error = %e, "Spectrum Studio failed to start");
            std::process::exit(1);
        }
    };
    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            // Stop acquisition and release the device before the process exits.
            if let Some(state) = handle.try_state::<AppState>() {
                state.session.disconnect();
            }
        }
    });
}
