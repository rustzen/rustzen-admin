use axum::extract::Path;

use crate::common::api::{ApiResponse, AppResult};

use super::{service::MonitorService, types::MonitorPayload};

pub async fn list_nodes() -> AppResult<MonitorPayload> {
    Ok(ApiResponse::success(MonitorService::list_nodes().await?))
}

pub async fn get_node(Path(node_id): Path<String>) -> AppResult<MonitorPayload> {
    Ok(ApiResponse::success(MonitorService::get_node(&node_id).await?))
}
