use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewQuery {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Overview {
    pub pv: i64,
    pub uv: i64,
    pub event_count: i64,
    pub request_count: i64,
    pub error_count: i64,
    pub average_duration_ms: f64,
    pub p95_duration_ms: u64,
    pub trend: Vec<TrendPoint>,
}

#[derive(FromRow)]
pub struct OverviewTotals {
    pub pv: i64,
    pub uv: i64,
    pub event_count: i64,
    pub request_count: i64,
    pub error_count: i64,
    pub average_duration_ms: f64,
}

#[derive(Debug, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendPoint {
    pub date: String,
    pub pv: i64,
    pub uv: i64,
    pub request_count: i64,
    pub error_count: i64,
}
