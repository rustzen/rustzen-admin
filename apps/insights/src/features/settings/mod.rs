mod handler;
mod repo;
pub(crate) mod service;
mod types;

use rustzen_auth::capability::insights;
use rustzen_ipc::{ManifestError, ModuleRouter, Require};

use crate::app::AppState;

pub fn register(router: ModuleRouter<AppState>) -> Result<ModuleRouter<AppState>, ManifestError> {
    router
        .get_with_permission("/settings", handler::get, Require(insights::SETTINGS_VIEW))?
        .put_with_permission("/settings", handler::update, Require(insights::SETTINGS_MANAGE))
}
