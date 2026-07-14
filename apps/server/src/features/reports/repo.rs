use reqwest::{Method, Response};
use serde_json::Value;

use crate::{
    common::error::AppError,
    features::worker_proxy::{request_bytes, request_json},
    infra::config::CONFIG,
};

use super::types::ReportsPayload;

pub struct ReportsRepository;

impl ReportsRepository {
    pub async fn get(path: &str, capability: &str) -> Result<ReportsPayload, AppError> {
        Self::request(Method::GET, path, capability, None).await
    }

    pub async fn post(
        path: &str,
        capability: &str,
        body: &Value,
    ) -> Result<ReportsPayload, AppError> {
        Self::request(Method::POST, path, capability, Some(body)).await
    }

    pub async fn download(job_id: &str) -> Result<Response, AppError> {
        let path = format!("/ipc/v1/reports/jobs/{job_id}/download");
        request_bytes(
            "reports",
            format!("{}{path}", CONFIG.reports_base_url()),
            &path,
            "reports:view",
        )
        .await
    }

    async fn request(
        method: Method,
        path: &str,
        capability: &str,
        body: Option<&Value>,
    ) -> Result<ReportsPayload, AppError> {
        request_json(
            "reports",
            method,
            format!("{}{path}", CONFIG.reports_base_url()),
            path,
            capability,
            None,
            body,
        )
        .await
        .map(ReportsPayload)
    }
}
