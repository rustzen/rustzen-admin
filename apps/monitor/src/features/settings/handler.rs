use axum::extract::State;
use rustzen_ipc::ModuleJson;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
};

use super::{service, types::MonitoringSettings, types::UpdateMonitoringSettings};

pub(crate) async fn get(State(state): State<AppState>) -> AppResult<MonitoringSettings> {
    Ok(ApiResponse::success(service::get(&state.pool).await?))
}

pub(crate) async fn update(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<UpdateMonitoringSettings>,
) -> AppResult<MonitoringSettings> {
    Ok(ApiResponse::success(service::update(&state.pool, input).await?))
}
