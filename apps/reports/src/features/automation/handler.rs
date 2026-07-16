use axum::{
    body::Body,
    extract::{Path, State},
    http::{HeaderValue, header},
    response::{IntoResponse, Response},
};
use rustzen_ipc::{ModuleJson, ModuleQuery};
use tokio_util::io::ReaderStream;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
    common::error::AppError,
};

use super::{repo, service, types::*};

pub async fn systems(State(state): State<AppState>) -> AppResult<Vec<System>> {
    Ok(ApiResponse::success(service::systems(&state.pool).await?))
}
pub async fn create_system(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<SaveSystem>,
) -> AppResult<System> {
    Ok(ApiResponse::success(service::create_system(&state.pool, input).await?))
}
pub async fn update_system(
    State(state): State<AppState>,
    Path(id): Path<String>,
    ModuleJson(input): ModuleJson<SaveSystem>,
) -> AppResult<System> {
    Ok(ApiResponse::success(service::update_system(&state.pool, &id, input).await?))
}
pub async fn delete_system(State(state): State<AppState>, Path(id): Path<String>) -> AppResult<()> {
    service::delete_system(&state.pool, &id).await?;
    Ok(ApiResponse::success(()))
}

pub async fn accounts(
    State(state): State<AppState>,
    ModuleQuery(query): ModuleQuery<SystemFilter>,
) -> AppResult<Vec<Account>> {
    Ok(ApiResponse::success(service::accounts(&state.pool, query.system_id.as_deref()).await?))
}
pub async fn create_account(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<SaveAccount>,
) -> AppResult<Account> {
    Ok(ApiResponse::success(service::create_account(&state, input).await?))
}
pub async fn update_account(
    State(state): State<AppState>,
    Path(id): Path<String>,
    ModuleJson(input): ModuleJson<SaveAccount>,
) -> AppResult<Account> {
    Ok(ApiResponse::success(service::update_account(&state, &id, input).await?))
}
pub async fn delete_account(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<()> {
    service::delete_account(&state.pool, &id).await?;
    Ok(ApiResponse::success(()))
}

pub async fn flows(
    State(state): State<AppState>,
    ModuleQuery(query): ModuleQuery<SystemFilter>,
) -> AppResult<Vec<Flow>> {
    Ok(ApiResponse::success(service::flows(&state.pool, query.system_id.as_deref()).await?))
}
pub async fn create_flow(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<SaveFlow>,
) -> AppResult<Flow> {
    Ok(ApiResponse::success(service::create_flow(&state.pool, input).await?))
}
pub async fn update_flow(
    State(state): State<AppState>,
    Path(id): Path<String>,
    ModuleJson(input): ModuleJson<SaveFlow>,
) -> AppResult<Flow> {
    Ok(ApiResponse::success(service::update_flow(&state.pool, &id, input).await?))
}
pub async fn delete_flow(State(state): State<AppState>, Path(id): Path<String>) -> AppResult<()> {
    service::delete_flow(&state.pool, &id).await?;
    Ok(ApiResponse::success(()))
}

pub async fn runs(
    State(state): State<AppState>,
    ModuleQuery(query): ModuleQuery<ListQuery>,
) -> AppResult<Page<Run>> {
    Ok(ApiResponse::success(service::runs(&state.pool, query).await?))
}
pub async fn run(State(state): State<AppState>, Path(id): Path<String>) -> AppResult<Run> {
    Ok(ApiResponse::success(service::run(&state.pool, &id).await?))
}
pub async fn create_run(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<CreateRun>,
) -> AppResult<Run> {
    Ok(ApiResponse::success(service::create_run(&state.pool, input).await?))
}
pub async fn cancel_run(State(state): State<AppState>, Path(id): Path<String>) -> AppResult<Run> {
    Ok(ApiResponse::success(service::cancel_run(&state.pool, &id).await?))
}
pub async fn run_steps(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Vec<RunStep>> {
    service::run(&state.pool, &id).await?;
    Ok(ApiResponse::success(repo::run_steps(&state.pool, &id).await?))
}
pub async fn run_artifacts(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Vec<Artifact>> {
    service::run(&state.pool, &id).await?;
    Ok(ApiResponse::success(repo::artifacts(&state.pool, &id).await?))
}
pub async fn artifact(
    State(state): State<AppState>,
    Path((run_id, artifact_id)): Path<(String, String)>,
) -> Result<Response, AppError> {
    let artifact = repo::artifact(&state.pool, &artifact_id, &run_id)
        .await?
        .ok_or_else(|| AppError::NotFound("artifact not found".into()))?;
    let file =
        tokio::fs::File::open(state.output_dir.join(&run_id).join(&artifact.file_name)).await?;
    let mut response = Body::from_stream(ReaderStream::new(file)).into_response();
    response.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static("image/png"));
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", artifact.file_name))
            .map_err(AppError::internal)?,
    );
    Ok(response)
}

pub async fn schedules(State(state): State<AppState>) -> AppResult<Vec<Schedule>> {
    Ok(ApiResponse::success(service::schedules(&state.pool).await?))
}
pub async fn create_schedule(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<SaveSchedule>,
) -> AppResult<Schedule> {
    Ok(ApiResponse::success(service::create_schedule(&state.pool, input).await?))
}
pub async fn update_schedule(
    State(state): State<AppState>,
    Path(id): Path<String>,
    ModuleJson(input): ModuleJson<SaveSchedule>,
) -> AppResult<Schedule> {
    Ok(ApiResponse::success(service::update_schedule(&state.pool, &id, input).await?))
}
pub async fn delete_schedule(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<()> {
    service::delete_schedule(&state.pool, &id).await?;
    Ok(ApiResponse::success(()))
}

pub async fn settings(State(state): State<AppState>) -> AppResult<RuntimeSettings> {
    Ok(ApiResponse::success(service::settings(&state).await?))
}
pub async fn update_settings(
    State(state): State<AppState>,
    ModuleJson(input): ModuleJson<UpdateSettings>,
) -> AppResult<RuntimeSettings> {
    Ok(ApiResponse::success(service::update_settings(&state, input).await?))
}
