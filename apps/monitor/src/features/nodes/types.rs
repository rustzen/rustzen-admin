use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NodeRow {
    pub(super) id: String,
    pub(super) agent_id: String,
    pub(super) hostname: String,
    pub(super) agent_version: String,
    pub(super) last_seen_at: String,
    pub(super) cpu_percent: Option<f32>,
    pub(super) memory_used_bytes: Option<i64>,
    pub(super) memory_total_bytes: Option<i64>,
    pub(super) disk_used_bytes: Option<i64>,
    pub(super) disk_total_bytes: Option<i64>,
    pub(super) collected_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NodeView {
    #[serde(flatten)]
    pub(super) row: NodeRow,
    pub(super) status: &'static str,
}
