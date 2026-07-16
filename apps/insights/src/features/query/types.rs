use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageQuery {
    pub project_id: String,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub path: Option<String>,
    pub current: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiQuery {
    pub project_id: String,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub path: Option<String>,
    pub current: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventQuery {
    pub project_id: String,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub event_name: Option<String>,
    pub visitor_id: Option<String>,
    pub platform: Option<String>,
    pub current: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserQuery {
    pub project_id: String,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub keyword: Option<String>,
    pub current: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserEventQuery {
    pub project_id: String,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub current: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageStat {
    pub page_path: String,
    pub pv: i64,
    pub uv: i64,
    pub average_duration_ms: f64,
    pub last_seen_at: String,
}

#[derive(Debug, FromRow)]
pub struct ApiStatRow {
    pub api_path: String,
    pub api_method: Option<String>,
    pub request_count: i64,
    pub error_count: i64,
    pub average_duration_ms: f64,
    pub p95_duration_ms: i64,
    pub last_seen_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiStat {
    pub api_path: String,
    pub api_method: Option<String>,
    pub request_count: i64,
    pub error_count: i64,
    pub error_rate: f64,
    pub average_duration_ms: f64,
    pub p95_duration_ms: u64,
    pub last_seen_at: String,
}

#[derive(Debug, FromRow)]
pub struct EventRow {
    pub id: i64,
    pub event_name: String,
    pub visitor_id: String,
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub platform: Option<String>,
    pub page_path: Option<String>,
    pub referrer: Option<String>,
    pub api_path: Option<String>,
    pub api_method: Option<String>,
    pub status_code: Option<i64>,
    pub duration_ms: Option<i64>,
    pub is_error: bool,
    pub properties: String,
    pub occurred_at: String,
    pub received_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub id: i64,
    pub event_name: String,
    pub visitor_id: String,
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub platform: Option<String>,
    pub page_path: Option<String>,
    pub referrer: Option<String>,
    pub api_path: Option<String>,
    pub api_method: Option<String>,
    pub status_code: Option<i64>,
    pub duration_ms: Option<i64>,
    pub is_error: bool,
    pub properties: Value,
    pub occurred_at: String,
    pub received_at: String,
}

impl TryFrom<EventRow> for Event {
    type Error = serde_json::Error;

    fn try_from(row: EventRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.id,
            event_name: row.event_name,
            visitor_id: row.visitor_id,
            user_id: row.user_id,
            session_id: row.session_id,
            platform: row.platform,
            page_path: row.page_path,
            referrer: row.referrer,
            api_path: row.api_path,
            api_method: row.api_method,
            status_code: row.status_code,
            duration_ms: row.duration_ms,
            is_error: row.is_error,
            properties: serde_json::from_str(&row.properties)?,
            occurred_at: row.occurred_at,
            received_at: row.received_at,
        })
    }
}

#[derive(Debug, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserStat {
    pub visitor_id: String,
    pub user_id: Option<String>,
    pub platform: Option<String>,
    pub event_count: i64,
    pub first_seen_at: String,
    pub last_seen_at: String,
}
