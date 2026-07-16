use rustzen_storage::SqlitePool;

use super::types::NodeRow;

pub(super) async fn load(
    pool: &SqlitePool,
    node_id: Option<&str>,
) -> Result<Vec<NodeRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT n.id, n.agent_id, n.hostname, n.agent_version, n.last_seen_at,
                m.cpu_percent, m.memory_used_bytes, m.memory_total_bytes,
                m.disk_used_bytes, m.disk_total_bytes, m.collected_at
         FROM monitor_nodes n
         LEFT JOIN monitor_metrics m ON m.id = (
             SELECT id FROM monitor_metrics
             WHERE node_id = n.id
             ORDER BY collected_at DESC
             LIMIT 1
         )
         WHERE (? IS NULL OR n.id = ?)
         ORDER BY n.hostname ASC",
    )
    .bind(node_id)
    .bind(node_id)
    .fetch_all(pool)
    .await
}
