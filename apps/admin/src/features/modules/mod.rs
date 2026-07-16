pub mod gateway;
pub mod handler;
pub mod registry;
pub mod repo;
pub mod service;
pub mod types;

use axum::{
    Router,
    routing::{get, put},
};
use rustzen_auth::{
    capability::{dashboard, system_module},
    permission::{PermissionsCheck, RouterExt},
};

use self::{
    handler::{dashboard, list, navigation, update},
    service::ModuleControlState,
};

pub fn control_routes() -> Router<ModuleControlState> {
    Router::new()
        .route_with_permission(
            "/api/system/modules",
            get(list),
            PermissionsCheck::Require(system_module::LIST),
        )
        .route_with_permission(
            "/api/system/modules/{module}/enabled",
            put(update),
            PermissionsCheck::Require(system_module::UPDATE),
        )
        .route("/api/system/modules/navigation", get(navigation))
        .route_with_permission(
            "/api/dashboard/modules",
            get(dashboard),
            PermissionsCheck::Require(dashboard::VIEW),
        )
}
