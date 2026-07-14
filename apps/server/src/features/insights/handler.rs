use axum::{
    Json,
    extract::Query,
    http::{HeaderMap, header},
};
use serde_json::Value;

use crate::common::api::{ApiResponse, AppResult};

use super::{service::InsightsService, types::InsightsPayload};

pub async fn list_projects() -> AppResult<InsightsPayload> {
    Ok(ApiResponse::success(InsightsService::list_projects().await?))
}

pub async fn create_project(Json(body): Json<Value>) -> AppResult<InsightsPayload> {
    Ok(ApiResponse::success(InsightsService::create_project(body).await?))
}

pub async fn overview(Query(query): Query<Vec<(String, String)>>) -> AppResult<InsightsPayload> {
    Ok(ApiResponse::success(InsightsService::overview(query).await?))
}

pub async fn track(headers: HeaderMap, Json(body): Json<Value>) -> AppResult<InsightsPayload> {
    let project_key = headers.get("x-rustzen-project-key").and_then(|value| value.to_str().ok());
    let origin = headers.get(header::ORIGIN).and_then(|value| value.to_str().ok());
    Ok(ApiResponse::success(InsightsService::track(body, project_key, origin).await?))
}
