use axum::http::StatusCode;
use serde_json::Value;

use crate::common::error::AppError;

use super::{repo::InsightsRepository, types::InsightsPayload};

pub struct InsightsService;

impl InsightsService {
    pub async fn list_projects() -> Result<InsightsPayload, AppError> {
        InsightsRepository::get("/ipc/v1/insights/projects", "insights:view", None).await
    }

    pub async fn create_project(body: Value) -> Result<InsightsPayload, AppError> {
        InsightsRepository::post("/ipc/v1/insights/projects", "insights:manage", &body).await
    }

    pub async fn overview(query: Vec<(String, String)>) -> Result<InsightsPayload, AppError> {
        InsightsRepository::get("/ipc/v1/insights/overview", "insights:view", Some(&query)).await
    }

    pub async fn track(
        mut body: Value,
        project_key: Option<&str>,
        origin: Option<&str>,
    ) -> Result<InsightsPayload, AppError> {
        let project_key =
            project_key.filter(|value| !value.trim().is_empty()).ok_or_else(|| {
                AppError::upstream(StatusCode::UNAUTHORIZED, "project key is required")
            })?;
        let object = body.as_object_mut().ok_or_else(|| {
            AppError::upstream(StatusCode::BAD_REQUEST, "event body must be an object")
        })?;
        object.insert("projectKey".to_string(), Value::String(project_key.to_string()));
        object.insert(
            "origin".to_string(),
            origin.map_or(Value::Null, |value| Value::String(value.to_string())),
        );
        InsightsRepository::post("/ipc/v1/insights/track", "insights:track", &body).await
    }
}
