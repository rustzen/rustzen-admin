use axum::extract::State;
use rustzen_ipc::ModuleJson;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
};

use super::{
    service,
    types::{Settings, UpdateSettings},
};

pub async fn get(State(state): State<AppState>) -> AppResult<Settings> {
    Ok(ApiResponse::success(service::get(&state.pool).await?))
}

pub async fn update(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<UpdateSettings>,
) -> AppResult<Settings> {
    Ok(ApiResponse::success(service::update(&state.pool, input).await?))
}
