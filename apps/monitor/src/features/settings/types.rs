use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MonitoringSettings {
    pub offline_after_seconds: i64,
    pub metrics_retention_days: i64,
    pub check_result_retention_days: i64,
    pub default_check_interval_seconds: i64,
    pub default_check_timeout_ms: i64,
    pub failure_threshold: i64,
    pub cpu_threshold_percent: f64,
    pub memory_threshold_percent: f64,
    pub disk_threshold_percent: f64,
    pub updated_at: String,
}
