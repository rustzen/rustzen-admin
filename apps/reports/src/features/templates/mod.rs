mod handler;
mod repo;
mod service;
mod types;

use rustzen_auth::capability::reports;
use rustzen_ipc::{ManifestError, ModuleRouter, Require};

use crate::app::AppState;

pub use service::TemplatesService;

pub fn routes(router: ModuleRouter<AppState>) -> Result<ModuleRouter<AppState>, ManifestError> {
    router
        .get_with_permission("/templates", handler::list, Require(reports::TEMPLATE_VIEW))?
        .post_with_permission("/templates", handler::save, Require(reports::MANAGE))
}
