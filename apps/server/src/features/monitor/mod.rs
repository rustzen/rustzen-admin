mod handler;
mod repo;
mod service;
mod types;

use axum::{Router, routing::get};
use rustzen_auth::{
    capability::monitor,
    permission::{PermissionsCheck, RouterExt},
};
use sqlx::SqlitePool;

use handler::{get_node, list_nodes};

pub fn monitor_routes() -> Router<SqlitePool> {
    Router::new()
        .route_with_permission("/nodes", get(list_nodes), PermissionsCheck::Require(monitor::VIEW))
        .route_with_permission(
            "/nodes/{node_id}",
            get(get_node),
            PermissionsCheck::Require(monitor::VIEW),
        )
}
