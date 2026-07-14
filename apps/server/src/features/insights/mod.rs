mod handler;
mod repo;
mod service;
mod types;

use axum::{
    Router,
    routing::{get, post},
};
use rustzen_auth::{
    capability::insights,
    permission::{PermissionsCheck, RouterExt},
};
use sqlx::SqlitePool;

use handler::{create_project, list_projects, overview, track};

pub fn protected_routes() -> Router<SqlitePool> {
    Router::new()
        .route_with_permission(
            "/projects",
            get(list_projects),
            PermissionsCheck::Require(insights::VIEW),
        )
        .route_with_permission(
            "/projects",
            post(create_project),
            PermissionsCheck::Require(insights::MANAGE),
        )
        .route_with_permission(
            "/overview",
            get(overview),
            PermissionsCheck::Require(insights::VIEW),
        )
}

pub fn public_routes() -> Router<SqlitePool> {
    Router::new().route("/track", post(track))
}
