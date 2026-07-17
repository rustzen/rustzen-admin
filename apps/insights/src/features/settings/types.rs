use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub event_retention_days: i64,
    pub default_query_days: i64,
    pub max_query_days: i64,
    pub max_batch_events: i64,
    pub business_timezone: String,
    pub updated_at: String,
}
