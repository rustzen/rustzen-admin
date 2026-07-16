use sqlx::{Sqlite, Transaction};

use super::types::HeartbeatRecord;

pub(super) async fn find_node_id(
    transaction: &mut Transaction<'_, Sqlite>,
    agent_id: &str,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM monitor_nodes WHERE agent_id = ?")
        .bind(agent_id)
        .fetch_optional(&mut **transaction)
        .await
}

pub(super) async fn upsert_node(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &HeartbeatRecord<'_>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO monitor_nodes (
           id, agent_id, hostname, agent_version, last_seen_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(agent_id) DO UPDATE SET
           hostname = excluded.hostname,
           agent_version = excluded.agent_version,
           last_seen_at = excluded.last_seen_at,
           updated_at = excluded.updated_at",
    )
    .bind(record.node_id)
    .bind(&record.input.agent_id)
    .bind(&record.input.hostname)
    .bind(&record.input.agent_version)
    .bind(record.collected_at)
    .bind(record.now)
    .bind(record.now)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

pub(super) async fn insert_metric(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &HeartbeatRecord<'_>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO monitor_metrics (
           node_id, cpu_percent, memory_used_bytes, memory_total_bytes,
           disk_used_bytes, disk_total_bytes, collected_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(record.node_id)
    .bind(record.input.cpu_percent)
    .bind(record.memory_used_bytes)
    .bind(record.memory_total_bytes)
    .bind(record.disk_used_bytes)
    .bind(record.disk_total_bytes)
    .bind(record.collected_at)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}
