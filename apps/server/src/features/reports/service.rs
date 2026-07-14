use axum::{
    body::Body,
    http::{StatusCode, header},
    response::Response,
};
use serde_json::Value;

use crate::common::error::AppError;

use super::{repo::ReportsRepository, types::ReportsPayload};

pub struct ReportsService;

impl ReportsService {
    pub async fn list_templates() -> Result<ReportsPayload, AppError> {
        ReportsRepository::get("/ipc/v1/reports/templates", "reports:view").await
    }

    pub async fn save_template(body: Value) -> Result<ReportsPayload, AppError> {
        ReportsRepository::post("/ipc/v1/reports/templates", "reports:manage", &body).await
    }

    pub async fn list_jobs() -> Result<ReportsPayload, AppError> {
        ReportsRepository::get("/ipc/v1/reports/jobs", "reports:view").await
    }

    pub async fn create_job(body: Value) -> Result<ReportsPayload, AppError> {
        ReportsRepository::post("/ipc/v1/reports/jobs", "reports:manage", &body).await
    }

    pub async fn get_job(job_id: &str) -> Result<ReportsPayload, AppError> {
        ReportsRepository::get(&format!("/ipc/v1/reports/jobs/{job_id}"), "reports:view").await
    }

    pub async fn download_job(job_id: &str) -> Result<Response<Body>, AppError> {
        let response = ReportsRepository::download(job_id).await?;
        let status = response.status();
        if !status.is_success() {
            let message = response.text().await.unwrap_or_else(|_| "report download failed".into());
            return Err(AppError::upstream(status, message));
        }
        let content_type =
            response.headers().get(header::CONTENT_TYPE).cloned().unwrap_or_else(|| {
                axum::http::HeaderValue::from_static("application/octet-stream")
            });
        let disposition = response.headers().get(header::CONTENT_DISPOSITION).cloned();
        let bytes = response.bytes().await.map_err(|_| AppError::worker_unavailable("reports"))?;
        let mut builder =
            Response::builder().status(StatusCode::OK).header(header::CONTENT_TYPE, content_type);
        if let Some(disposition) = disposition {
            builder = builder.header(header::CONTENT_DISPOSITION, disposition);
        }
        builder.body(Body::from(bytes)).map_err(|_| AppError::worker_unavailable("reports"))
    }
}
