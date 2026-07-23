use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Check {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: i64,
    pub interval_seconds: i64,
    pub timeout_ms: i64,
    pub failure_threshold: i64,
    pub enabled: bool,
    pub last_status: Option<String>,
    pub last_checked_at: Option<String>,
    pub last_latency_ms: Option<i64>,
    pub consecutive_failures: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SaveCheck {
    pub name: String,
    pub host: String,
    pub port: i64,
    pub interval_seconds: Option<i64>,
    pub timeout_ms: Option<i64>,
    pub failure_threshold: Option<i64>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct TestCheck {
    pub host: String,
    pub port: i64,
    pub timeout_ms: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SetCheckEnabled {
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ListQuery {
    pub current: Option<i64>,
    pub page_size: Option<i64>,
    pub enabled: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ResultQuery {
    pub current: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CheckResult {
    pub id: i64,
    pub check_id: String,
    pub status: String,
    pub latency_ms: Option<i64>,
    pub error: Option<String>,
    pub checked_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProbeResult {
    pub status: &'static str,
    pub latency_ms: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub(super) struct CheckExecution {
    pub status: &'static str,
    pub latency_ms: Option<i64>,
    pub error: Option<String>,
}
