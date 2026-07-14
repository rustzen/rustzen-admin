use reqwest::Method;
use serde_json::Value;

use crate::{common::error::AppError, features::worker_proxy::request_json, infra::config::CONFIG};

use super::types::InsightsPayload;

pub struct InsightsRepository;

impl InsightsRepository {
    pub async fn get(
        path: &str,
        capability: &str,
        query: Option<&[(String, String)]>,
    ) -> Result<InsightsPayload, AppError> {
        Self::request(Method::GET, path, capability, query, None).await
    }

    pub async fn post(
        path: &str,
        capability: &str,
        body: &Value,
    ) -> Result<InsightsPayload, AppError> {
        Self::request(Method::POST, path, capability, None, Some(body)).await
    }

    async fn request(
        method: Method,
        path: &str,
        capability: &str,
        query: Option<&[(String, String)]>,
        body: Option<&Value>,
    ) -> Result<InsightsPayload, AppError> {
        request_json(
            "insights",
            method,
            format!("{}{path}", CONFIG.insights_base_url()),
            path,
            capability,
            query,
            body,
        )
        .await
        .map(InsightsPayload)
    }
}
