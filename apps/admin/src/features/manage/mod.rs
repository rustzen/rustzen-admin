pub mod deploy;
pub mod log;
pub mod task;

use axum::Router;
use sqlx::SqlitePool;

use deploy::deploy_routes;
use log::log_routes;
use task::task_routes;

pub fn manage_routes() -> Router<SqlitePool> {
    Router::new()
        .nest("/logs", log_routes())
        .nest("/tasks", task_routes())
        .nest("/deploy", deploy_routes())
}
