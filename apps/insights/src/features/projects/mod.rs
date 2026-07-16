mod handler;
mod repo;
pub(crate) mod service;
pub(crate) mod types;

use rustzen_auth::capability::insights;
use rustzen_ipc::{ManifestError, ModuleRouter, Require};

use crate::app::AppState;

pub fn register(router: ModuleRouter<AppState>) -> Result<ModuleRouter<AppState>, ManifestError> {
    router
        .get_with_permission("/projects", handler::list, Require(insights::PROJECT_VIEW))?
        .post_with_permission("/projects", handler::create, Require(insights::PROJECT_MANAGE))?
        .get_with_permission("/projects/{id}", handler::get, Require(insights::PROJECT_VIEW))?
        .patch_with_permission(
            "/projects/{id}",
            handler::update,
            Require(insights::PROJECT_MANAGE),
        )?
        .delete_with_permission(
            "/projects/{id}",
            handler::archive,
            Require(insights::PROJECT_MANAGE),
        )?
        .post_with_permission(
            "/projects/{id}/rotate-key",
            handler::rotate_key,
            Require(insights::PROJECT_MANAGE),
        )
}
