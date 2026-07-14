mod handler;
mod repo;
mod service;
mod types;

use axum::{
    Router,
    routing::{get, post},
};
use rustzen_auth::{
    capability::reports,
    permission::{PermissionsCheck, RouterExt},
};
use sqlx::SqlitePool;

use handler::{create_job, download_job, get_job, list_jobs, list_templates, save_template};

pub fn reports_routes() -> Router<SqlitePool> {
    Router::new()
        .route_with_permission(
            "/templates",
            get(list_templates),
            PermissionsCheck::Require(reports::VIEW),
        )
        .route_with_permission(
            "/templates",
            post(save_template),
            PermissionsCheck::Require(reports::MANAGE),
        )
        .route_with_permission("/jobs", get(list_jobs), PermissionsCheck::Require(reports::VIEW))
        .route_with_permission(
            "/jobs",
            post(create_job),
            PermissionsCheck::Require(reports::MANAGE),
        )
        .route_with_permission(
            "/jobs/{job_id}",
            get(get_job),
            PermissionsCheck::Require(reports::VIEW),
        )
        .route_with_permission(
            "/jobs/{job_id}/download",
            get(download_job),
            PermissionsCheck::Require(reports::VIEW),
        )
}
