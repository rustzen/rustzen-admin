use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HeartbeatInput {
    pub agent_id: String,
    pub hostname: String,
    pub agent_version: String,
    pub cpu_percent: f32,
    pub memory_used_bytes: u64,
    pub memory_total_bytes: u64,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub collected_at: DateTime<Utc>,
}

pub(super) struct HeartbeatRecord<'a> {
    pub node_id: &'a str,
    pub input: &'a HeartbeatInput,
    pub collected_at: &'a str,
    pub now: &'a str,
    pub memory_used_bytes: i64,
    pub memory_total_bytes: i64,
    pub disk_used_bytes: i64,
    pub disk_total_bytes: i64,
}
