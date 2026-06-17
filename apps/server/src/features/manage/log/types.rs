use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Log item for list display
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct LogItemResp {
    pub id: i64,
    pub user_id: i64,
    pub username: String,
    pub action: String,
    pub description: Option<String>,
    pub data: Option<Value>,
    pub status: String,
    pub duration_ms: i32,
    pub ip_address: String,
    pub user_agent: String,
    pub created_at: NaiveDateTime,
}

/// Log query parameters
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogQuery {
    pub current: Option<i64>,
    pub page_size: Option<i64>,
    pub search: Option<String>,
    pub username: Option<String>,
    pub action: Option<String>,
    pub description: Option<String>,
    pub ip_address: Option<String>,
}

#[derive(Debug, Clone)]
pub struct LogListQuery {
    pub search: Option<String>,
    pub username: Option<String>,
    pub action: Option<String>,
    pub description: Option<String>,
    pub ip_address: Option<String>,
}

/// Log write command used by the service and repository layers.
#[derive(Debug, Clone)]
pub struct LogWriteCommand {
    pub user_id: i64,
    pub username: String,
    pub action: String,
    pub description: String,
    pub data: Option<Value>,
    pub status: String,
    pub duration_ms: i32,
    pub ip_address: String,
    pub user_agent: String,
}

#[derive(Debug, Clone)]
pub struct LogMetricsSummary {
    pub total_requests: i64,
    pub error_requests: i64,
    pub avg_response_time: f64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct LogTrendPoint {
    pub date: Option<String>,
    pub count: Option<i64>,
}
