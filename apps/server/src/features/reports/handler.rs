use axum::{Json, body::Body, extract::Path, response::Response};
use serde_json::Value;

use crate::common::{
    api::{ApiResponse, AppResult},
    error::AppError,
};

use super::{service::ReportsService, types::ReportsPayload};

pub async fn list_templates() -> AppResult<ReportsPayload> {
    Ok(ApiResponse::success(ReportsService::list_templates().await?))
}

pub async fn save_template(Json(body): Json<Value>) -> AppResult<ReportsPayload> {
    Ok(ApiResponse::success(ReportsService::save_template(body).await?))
}

pub async fn list_jobs() -> AppResult<ReportsPayload> {
    Ok(ApiResponse::success(ReportsService::list_jobs().await?))
}

pub async fn create_job(Json(body): Json<Value>) -> AppResult<ReportsPayload> {
    Ok(ApiResponse::success(ReportsService::create_job(body).await?))
}

pub async fn get_job(Path(job_id): Path<String>) -> AppResult<ReportsPayload> {
    Ok(ApiResponse::success(ReportsService::get_job(&job_id).await?))
}

pub async fn download_job(Path(job_id): Path<String>) -> Result<Response<Body>, AppError> {
    ReportsService::download_job(&job_id).await
}
