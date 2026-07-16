use rustzen_storage::SqlitePool;

use super::types::MetricPointRow;

pub(super) async fn delete_before(pool: &SqlitePool, cutoff: &str) -> Result<u64, sqlx::Error> {
    sqlx::query("DELETE FROM monitor_metrics WHERE collected_at < ?")
        .bind(cutoff)
        .execute(pool)
        .await
        .map(|result| result.rows_affected())
}

pub(super) async fn load_raw(
    pool: &SqlitePool,
    node_id: &str,
    from: &str,
    to: &str,
) -> Result<Vec<MetricPointRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT collected_at, CAST(cpu_percent AS REAL) AS cpu_percent,
                CASE WHEN memory_total_bytes > 0
                     THEN memory_used_bytes * 100.0 / memory_total_bytes ELSE 0 END AS memory_percent,
                CASE WHEN disk_total_bytes > 0
                     THEN disk_used_bytes * 100.0 / disk_total_bytes ELSE 0 END AS disk_percent
         FROM monitor_metrics
         WHERE node_id = ? AND collected_at >= ? AND collected_at <= ?
         ORDER BY collected_at ASC
         LIMIT 2000",
    )
    .bind(node_id)
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await
}

pub(super) async fn load_bucketed(
    pool: &SqlitePool,
    node_id: &str,
    from: &str,
    to: &str,
    bucket_seconds: i64,
) -> Result<Vec<MetricPointRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT strftime('%Y-%m-%dT%H:%M:%SZ',
                         (unixepoch(collected_at) / ?) * ?, 'unixepoch') AS collected_at,
                AVG(cpu_percent) AS cpu_percent,
                AVG(CASE WHEN memory_total_bytes > 0
                         THEN memory_used_bytes * 100.0 / memory_total_bytes ELSE 0 END)
                    AS memory_percent,
                AVG(CASE WHEN disk_total_bytes > 0
                         THEN disk_used_bytes * 100.0 / disk_total_bytes ELSE 0 END)
                    AS disk_percent
         FROM monitor_metrics
         WHERE node_id = ? AND collected_at >= ? AND collected_at <= ?
         GROUP BY unixepoch(collected_at) / ?
         ORDER BY collected_at ASC
         LIMIT 2000",
    )
    .bind(bucket_seconds)
    .bind(bucket_seconds)
    .bind(node_id)
    .bind(from)
    .bind(to)
    .bind(bucket_seconds)
    .fetch_all(pool)
    .await
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
