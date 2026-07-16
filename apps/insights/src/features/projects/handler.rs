use axum::extract::{Path, State};
use rustzen_ipc::ModuleJson;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
};

use super::{
    service::ProjectsService,
    types::{CreateProjectInput, CreatedProject, Project, ProjectKey, UpdateProjectInput},
};

pub async fn list(State(state): State<AppState>) -> AppResult<Vec<Project>> {
    Ok(ApiResponse::success(ProjectsService::list(&state.pool).await?))
}

pub async fn get(State(state): State<AppState>, Path(id): Path<String>) -> AppResult<Project> {
    Ok(ApiResponse::success(ProjectsService::get(&state.pool, &id).await?))
}

pub async fn create(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<CreateProjectInput>,
) -> AppResult<CreatedProject> {
    Ok(ApiResponse::success(ProjectsService::create(&state.pool, input).await?))
}

pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    ModuleJson(input): ModuleJson<UpdateProjectInput>,
) -> AppResult<Project> {
    Ok(ApiResponse::success(ProjectsService::update(&state.pool, &id, input).await?))
}

pub async fn rotate_key(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<ProjectKey> {
    Ok(ApiResponse::success(ProjectsService::rotate_key(&state.pool, &id).await?))
}

pub async fn archive(State(state): State<AppState>, Path(id): Path<String>) -> AppResult<()> {
    ProjectsService::archive(&state.pool, &id).await?;
    Ok(ApiResponse::success(()))
}
