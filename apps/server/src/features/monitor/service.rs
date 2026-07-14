use axum::http::StatusCode;

use crate::common::error::AppError;

use super::{repo::MonitorRepository, types::MonitorPayload};

pub struct MonitorService;

impl MonitorService {
    pub async fn list_nodes() -> Result<MonitorPayload, AppError> {
        MonitorRepository::get("/ipc/v1/monitor/nodes").await
    }

    pub async fn get_node(node_id: &str) -> Result<MonitorPayload, AppError> {
        if node_id.trim().is_empty() {
            return Err(AppError::upstream(StatusCode::BAD_REQUEST, "node id is required"));
        }
        MonitorRepository::get(&format!("/ipc/v1/monitor/nodes/{node_id}")).await
    }
}
