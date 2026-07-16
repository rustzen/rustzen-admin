use axum::extract::{Path, State};
use rustzen_ipc::ModuleJson;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
};

use super::types::{CreateJobInput, Job};

pub async fn list(State(state): State<AppState>) -> AppResult<Vec<Job>> {
    Ok(ApiResponse::success(state.jobs.list().await?))
}

pub async fn create(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<CreateJobInput>,
) -> AppResult<Job> {
    Ok(ApiResponse::success(state.jobs.create(input).await?))
}

pub async fn get(State(state): State<AppState>, Path(job_id): Path<String>) -> AppResult<Job> {
    Ok(ApiResponse::success(state.jobs.get(&job_id).await?))
}
