mod handler;
mod repo;
pub(crate) mod service;
pub(crate) mod types;

use rustzen_auth::capability::monitor;
use rustzen_ipc::{ManifestError, ModuleRouter, Require};

use crate::app::AppState;

pub(crate) fn routes(
    router: ModuleRouter<AppState>,
) -> Result<ModuleRouter<AppState>, ManifestError> {
    router
        .get_with_permission("/settings", handler::get, Require(monitor::SETTINGS_VIEW))?
        .put_with_permission("/settings", handler::update, Require(monitor::SETTINGS_MANAGE))
}
