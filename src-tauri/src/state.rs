use std::sync::{Arc, OnceLock};

use spectrum_core::SessionManager;
use spectrum_core::autoconnect::AutoConnect;
use spectrum_core::store::ConfigStore;

pub struct AppState {
    pub session: Arc<SessionManager>,
    pub store: Arc<ConfigStore>,
    /// Started in `setup`, after this state is managed; stopped on exit.
    pub auto_connect: OnceLock<AutoConnect>,
}
