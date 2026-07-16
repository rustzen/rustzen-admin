mod handler;
mod repo;
mod service;
mod types;

use rustzen_auth::capability::reports;
use rustzen_ipc::{ManifestError, ModuleRouter, Require};

use crate::app::AppState;

pub use service::FilesService;

pub fn routes(router: ModuleRouter<AppState>) -> Result<ModuleRouter<AppState>, ManifestError> {
    router.get_with_permission(
        "/jobs/{job_id}/download",
        handler::download,
        Require(reports::RUN_VIEW),
    )
}
