mod handler;
mod repo;
pub(crate) mod service;
pub(crate) mod types;

use rustzen_auth::capability::monitor;
use rustzen_ipc::{ManifestError, ModuleRouter, Require};

use crate::app::AppState;

pub use handler::{spawn_retention, spawn_scheduler};

pub(crate) fn routes(
    router: ModuleRouter<AppState>,
) -> Result<ModuleRouter<AppState>, ManifestError> {
    router
        .get_with_permission("/checks", handler::list, Require(monitor::CHECK_VIEW))?
        .post_with_permission("/checks", handler::create, Require(monitor::CHECK_MANAGE))?
        .post_with_permission("/checks/test", handler::test, Require(monitor::CHECK_MANAGE))?
        .get_with_permission("/checks/{id}", handler::get, Require(monitor::CHECK_VIEW))?
        .put_with_permission("/checks/{id}", handler::update, Require(monitor::CHECK_MANAGE))?
        .delete_with_permission("/checks/{id}", handler::delete, Require(monitor::CHECK_MANAGE))?
        .put_with_permission(
            "/checks/{id}/enabled",
            handler::set_enabled,
            Require(monitor::CHECK_MANAGE),
        )?
        .get_with_permission("/checks/{id}/results", handler::results, Require(monitor::CHECK_VIEW))
}
