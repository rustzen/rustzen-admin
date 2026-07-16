use axum::extract::State;
use rustzen_ipc::ModuleJson;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
};

use super::{
    service::ProjectsService,
    types::{CreateProjectInput, CreatedProject, ProjectRow},
};

pub async fn list(State(state): State<AppState>) -> AppResult<Vec<ProjectRow>> {
    Ok(ApiResponse::success(ProjectsService::list(&state.pool).await?))
}

pub async fn create(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<CreateProjectInput>,
) -> AppResult<CreatedProject> {
    Ok(ApiResponse::success(ProjectsService::create(&state.pool, input).await?))
}
