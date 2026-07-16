use axum::extract::State;
use rustzen_ipc::ModuleJson;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
};

use super::types::{SaveTemplateInput, Template};

pub async fn list(State(state): State<AppState>) -> AppResult<Vec<Template>> {
    Ok(ApiResponse::success(state.templates.list().await?))
}

pub async fn save(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<SaveTemplateInput>,
) -> AppResult<Template> {
    Ok(ApiResponse::success(state.templates.save(input).await?))
}
