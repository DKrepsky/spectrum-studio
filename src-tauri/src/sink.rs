use spectrum_core::SessionSink;
use spectrum_core::model::SessionStatus;
use tauri::{AppHandle, Emitter};

pub const STATUS_EVENT: &str = "session-status";

/// Forwards session status changes to the webview as events.
pub struct EventSink(pub AppHandle);

impl SessionSink for EventSink {
    fn status_changed(&self, status: &SessionStatus) {
        // Emitting only fails when the app is shutting down; nothing useful to do then.
        let _ = self.0.emit(STATUS_EVENT, status);
    }
}
