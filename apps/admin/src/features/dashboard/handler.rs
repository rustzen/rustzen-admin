use super::{service::DashboardService, types::StatsResp};
use crate::common::api::{ApiResponse, AppResult};
use axum::extract::State;

use sqlx::SqlitePool;
use tracing::instrument;

#[instrument(skip(pool))]
pub async fn get_stats(State(pool): State<SqlitePool>) -> AppResult<StatsResp> {
    Ok(ApiResponse::success(DashboardService::get_stats(&pool).await?))
}
