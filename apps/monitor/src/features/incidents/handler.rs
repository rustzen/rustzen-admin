use std::time::Duration;

use axum::extract::{Path, State};
use rustzen_ipc::ModuleQuery;
use rustzen_storage::SqlitePool;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
};

use super::{
    service,
    types::{Incident, IncidentPage, IncidentQuery},
};

pub(crate) async fn list(
    State(state): State<AppState>,
    ModuleQuery(query): ModuleQuery<IncidentQuery>,
) -> AppResult<IncidentPage> {
    Ok(ApiResponse::success(service::list(&state.pool, query).await?))
}

pub(crate) async fn get(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Incident> {
    Ok(ApiResponse::success(service::get(&state.pool, &id).await?))
}

pub(crate) async fn acknowledge(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Incident> {
    Ok(ApiResponse::success(service::acknowledge(&state.pool, &id).await?))
}

pub fn spawn_evaluator(pool: SqlitePool) {
    tokio::spawn(async move {
        loop {
            if let Err(error) = service::evaluate_once(&pool).await {
                tracing::error!(%error, "Monitoring incident evaluation failed");
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });
}
