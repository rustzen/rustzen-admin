use std::time::Duration;

use axum::extract::{Path, State};
use rustzen_ipc::{ModuleJson, ModuleQuery};
use rustzen_storage::{SqliteMaintenancePlan, SqlitePool, run_sqlite_maintenance};

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
};

use super::{
    service,
    types::{
        Check, CheckResult, ListQuery, Page, ProbeResult, ResultQuery, SaveCheck, SetCheckEnabled,
        TestCheck,
    },
};

pub(crate) async fn list(
    State(state): State<AppState>,
    ModuleQuery(query): ModuleQuery<ListQuery>,
) -> AppResult<Page<Check>> {
    Ok(ApiResponse::success(service::list(&state.pool, query).await?))
}

pub(crate) async fn get(State(state): State<AppState>, Path(id): Path<String>) -> AppResult<Check> {
    Ok(ApiResponse::success(service::get(&state.pool, &id).await?))
}

pub(crate) async fn create(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<SaveCheck>,
) -> AppResult<Check> {
    Ok(ApiResponse::success(service::create(&state.pool, input).await?))
}

pub(crate) async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    ModuleJson(input): ModuleJson<SaveCheck>,
) -> AppResult<Check> {
    Ok(ApiResponse::success(service::update(&state.pool, &id, input).await?))
}

pub(crate) async fn set_enabled(
    State(state): State<AppState>,
    Path(id): Path<String>,
    ModuleJson(input): ModuleJson<SetCheckEnabled>,
) -> AppResult<Check> {
    Ok(ApiResponse::success(service::set_enabled(&state.pool, &id, input.enabled).await?))
}

pub(crate) async fn delete(State(state): State<AppState>, Path(id): Path<String>) -> AppResult<()> {
    service::delete(&state.pool, &id).await?;
    Ok(ApiResponse::success(()))
}

pub(crate) async fn test(ModuleJson(input): ModuleJson<TestCheck>) -> AppResult<ProbeResult> {
    Ok(ApiResponse::success(service::test(input).await?))
}

pub(crate) async fn results(
    State(state): State<AppState>,
    Path(id): Path<String>,
    ModuleQuery(query): ModuleQuery<ResultQuery>,
) -> AppResult<Page<CheckResult>> {
    Ok(ApiResponse::success(service::results(&state.pool, &id, query).await?))
}

pub fn spawn_scheduler(pool: SqlitePool) {
    tokio::spawn(async move {
        loop {
            if let Err(error) = service::run_once(&pool).await {
                tracing::error!(%error, "TCP check scheduler failed");
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    });
}

pub fn spawn_retention(pool: SqlitePool) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60 * 60)).await;
            match service::cleanup(&pool).await {
                Ok(deleted) if deleted > 0 => {
                    if let Err(error) =
                        run_sqlite_maintenance(&pool, SqliteMaintenancePlan::reclaim()).await
                    {
                        tracing::error!(%error, "TCP check result maintenance failed");
                    }
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "TCP check result retention failed"),
            }
        }
    });
}
