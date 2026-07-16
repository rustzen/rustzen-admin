mod handler;
mod repo;
mod service;
mod types;

pub use handler::spawn_retention;

use rustzen_auth::capability::monitor;
use rustzen_ipc::{ManifestError, ModuleRouter, Require};

use crate::app::AppState;

pub(crate) fn routes(
    router: ModuleRouter<AppState>,
) -> Result<ModuleRouter<AppState>, ManifestError> {
    router.get_with_permission(
        "/nodes/{node_id}/metrics",
        handler::list,
        Require(monitor::NODE_VIEW),
    )
}
