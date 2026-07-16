mod handler;
mod repo;
mod service;
mod types;

use rustzen_auth::capability::insights;
use rustzen_ipc::{ManifestError, ModuleRouter, Require};

use crate::app::AppState;

pub fn register(router: ModuleRouter<AppState>) -> Result<ModuleRouter<AppState>, ManifestError> {
    router
        .get_with_permission("/pages", handler::pages, Require(insights::PAGE_VIEW))?
        .get_with_permission("/apis", handler::apis, Require(insights::API_VIEW))?
        .get_with_permission("/events", handler::events, Require(insights::EVENT_VIEW))?
        .get_with_permission("/users", handler::users, Require(insights::USER_VIEW))?
        .get_with_permission(
            "/users/{visitor_id}/events",
            handler::user_events,
            Require(insights::USER_VIEW),
        )
}
