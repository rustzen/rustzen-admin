use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NodeRow {
    pub(crate) id: String,
    pub(crate) agent_id: String,
    pub(crate) hostname: String,
    pub(crate) agent_version: String,
    pub(crate) last_seen_at: String,
    pub(crate) cpu_percent: Option<f32>,
    pub(crate) memory_used_bytes: Option<i64>,
    pub(crate) memory_total_bytes: Option<i64>,
    pub(crate) disk_used_bytes: Option<i64>,
    pub(crate) disk_total_bytes: Option<i64>,
    pub(crate) collected_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NodeView {
    #[serde(flatten)]
    pub(crate) row: NodeRow,
    pub(crate) status: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NodeOverview {
    pub(super) registered_nodes: usize,
    pub(super) online_nodes: usize,
    pub(super) offline_nodes: usize,
    pub(super) active_incidents: i64,
    pub(super) unhealthy_checks: i64,
}
