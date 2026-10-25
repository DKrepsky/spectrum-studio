use std::sync::Arc;

use spectrum_core::SessionManager;
use spectrum_core::store::ConfigStore;

pub struct AppState {
    pub session: Arc<SessionManager>,
    pub store: Arc<ConfigStore>,
}
