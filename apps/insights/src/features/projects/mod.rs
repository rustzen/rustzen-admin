mod handler;
mod repo;
pub(crate) mod service;
pub(crate) mod types;

use rustzen_auth::capability::insights;
use rustzen_ipc::{ManifestError, ModuleRouter, Require};

use crate::app::AppState;

pub fn register(router: ModuleRouter<AppState>) -> Result<ModuleRouter<AppState>, ManifestError> {
    router
        .get_with_permission("/projects", handler::list, Require(insights::VIEW))?
        .post_with_permission("/projects", handler::create, Require(insights::MANAGE))
}
