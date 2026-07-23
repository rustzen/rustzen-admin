pub mod handler;
pub mod service;
pub mod types;

use axum::{Router, routing::get};
use rustzen_auth::{
    capability::dashboard,
    permission::{PermissionsCheck, RouterExt},
};
use sqlx::SqlitePool;

use handler::get_stats;

pub fn dashboard_routes() -> Router<SqlitePool> {
    Router::new().route_with_permission(
        "/stats",
        get(get_stats),
        PermissionsCheck::Require(dashboard::VIEW),
    )
}
