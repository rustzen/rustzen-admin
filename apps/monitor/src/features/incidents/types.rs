use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::features::checks::types::Page;

#[derive(Debug, Clone, FromRow)]
pub(super) struct IncidentRow {
    pub id: String,
    pub source_type: String,
    pub source_id: String,
    pub kind: String,
    pub title: String,
    pub status: String,
    pub details: String,
    pub opened_at: String,
    pub acknowledged_at: Option<String>,
    pub resolved_at: Option<String>,
    pub last_observed_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Incident {
    pub id: String,
    pub source_type: String,
    pub source_id: String,
    pub kind: String,
    pub title: String,
    pub status: String,
    pub details: serde_json::Value,
    pub opened_at: String,
    pub acknowledged_at: Option<String>,
    pub resolved_at: Option<String>,
    pub last_observed_at: String,
}

impl From<IncidentRow> for Incident {
    fn from(row: IncidentRow) -> Self {
        Self {
            id: row.id,
            source_type: row.source_type,
            source_id: row.source_id,
            kind: row.kind,
            title: row.title,
            status: row.status,
            details: serde_json::from_str(&row.details).unwrap_or(serde_json::Value::Null),
            opened_at: row.opened_at,
            acknowledged_at: row.acknowledged_at,
            resolved_at: row.resolved_at,
            last_observed_at: row.last_observed_at,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IncidentQuery {
    pub current: Option<i64>,
    pub page_size: Option<i64>,
    pub status: Option<String>,
    pub source_type: Option<String>,
}

pub(crate) type IncidentPage = Page<Incident>;

#[derive(Debug, Clone, FromRow)]
pub(super) struct ResourceSample {
    pub cpu_percent: f64,
    pub memory_percent: f64,
    pub disk_percent: f64,
}
