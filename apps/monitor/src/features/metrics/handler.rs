use std::time::Duration;

use axum::extract::{Path, State};
use rustzen_ipc::ModuleQuery;
use rustzen_storage::SqlitePool;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
};

use super::service;
use super::types::{MetricPoint, MetricsQuery};

const RETENTION_INTERVAL: Duration = Duration::from_secs(60 * 60);

pub fn spawn_retention(pool: SqlitePool) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(RETENTION_INTERVAL).await;
            match service::run_once(&pool).await {
                Ok(result) if result.deleted > 0 => {
                    tracing::info!(deleted = result.deleted, "Monitor metric retention completed");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "Monitor metric retention failed"),
            }
        }
    });
}

pub(crate) async fn list(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    ModuleQuery(query): ModuleQuery<MetricsQuery>,
) -> AppResult<Vec<MetricPoint>> {
    Ok(ApiResponse::success(service::list(&state.pool, &node_id, query).await?))
}
