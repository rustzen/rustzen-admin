pub mod handler;
pub mod service;
pub mod types;

use axum::{Router, routing::get};
use handler::get_status_overview;
use rustzen_auth::{
    capability::system_status,
    permission::{PermissionsCheck, RouterExt},
};
use sqlx::SqlitePool;

pub fn status_routes() -> Router<SqlitePool> {
    Router::new().route_with_permission(
        "/",
        get(get_status_overview),
        PermissionsCheck::Require(system_status::VIEW),
    )
}
