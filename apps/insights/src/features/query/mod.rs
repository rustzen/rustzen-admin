mod handler;
mod repo;
mod service;
mod types;

use rustzen_auth::capability::insights;
use rustzen_ipc::{ManifestError, ModuleRouter, Require};

use crate::app::AppState;

pub fn register(router: ModuleRouter<AppState>) -> Result<ModuleRouter<AppState>, ManifestError> {
    router.get_with_permission("/events", handler::events, Require(insights::EVENT_VIEW))
}
