use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub(super) struct RetentionResult {
    pub deleted: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MetricsQuery {
    pub from: Option<String>,
    pub to: Option<String>,
    pub bucket: Option<String>,
}

#[derive(Debug, FromRow)]
pub(super) struct MetricPointRow {
    pub collected_at: String,
    pub cpu_percent: f64,
    pub memory_percent: f64,
    pub disk_percent: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MetricPoint {
    pub collected_at: String,
    pub cpu_percent: f64,
    pub memory_percent: f64,
    pub disk_percent: f64,
}

impl From<MetricPointRow> for MetricPoint {
    fn from(row: MetricPointRow) -> Self {
        Self {
            collected_at: row.collected_at,
            cpu_percent: row.cpu_percent,
            memory_percent: row.memory_percent,
            disk_percent: row.disk_percent,
        }
    }
}
