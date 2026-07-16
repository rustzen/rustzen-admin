use rustzen_storage::SqlitePool;

pub(super) async fn delete_before(pool: &SqlitePool, cutoff: &str) -> Result<u64, sqlx::Error> {
    sqlx::query("DELETE FROM monitor_metrics WHERE collected_at < ?")
        .bind(cutoff)
        .execute(pool)
        .await
        .map(|result| result.rows_affected())
}

#[cfg(test)]
mod tests {
    use crate::infra::db::migrated_test_pool;

    use super::delete_before;

    #[tokio::test]
    async fn retention_keeps_the_cutoff_boundary() {
        let pool = migrated_test_pool().await;
        sqlx::query(
            "INSERT INTO monitor_nodes
             (id, agent_id, hostname, agent_version, last_seen_at, created_at, updated_at)
             VALUES ('node', 'agent', 'host', '1', '2026-07-14T00:00:00Z',
                     '2026-07-14T00:00:00Z', '2026-07-14T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .expect("insert node");
        for collected_at in ["2026-06-13T00:00:00Z", "2026-06-14T00:00:00Z"] {
            sqlx::query(
                "INSERT INTO monitor_metrics
                 (node_id, cpu_percent, memory_used_bytes, memory_total_bytes,
                  disk_used_bytes, disk_total_bytes, collected_at)
                 VALUES ('node', 1, 1, 2, 1, 2, ?)",
            )
            .bind(collected_at)
            .execute(&pool)
            .await
            .expect("insert metric");
        }

        assert_eq!(delete_before(&pool, "2026-06-14T00:00:00Z").await.expect("retain"), 1);
        let remaining: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM monitor_metrics")
            .fetch_one(&pool)
            .await
            .expect("count remaining metrics");
        assert_eq!(remaining, 1);
    }
}
