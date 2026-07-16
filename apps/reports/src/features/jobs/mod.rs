mod handler;
mod repo;
mod service;
mod types;

use rustzen_auth::capability::reports;
use rustzen_ipc::{ManifestError, ModuleRouter, Require};

use crate::app::AppState;

pub use service::JobsService;

pub fn routes(router: ModuleRouter<AppState>) -> Result<ModuleRouter<AppState>, ManifestError> {
    router
        .get_with_permission("/jobs", handler::list, Require(reports::VIEW))?
        .post_with_permission("/jobs", handler::create, Require(reports::MANAGE))?
        .get_with_permission("/jobs/{job_id}", handler::get, Require(reports::VIEW))
}
