use rustzen_storage::SqlitePool;

use super::types::MonitoringSettings;

pub(super) async fn get(pool: &SqlitePool) -> Result<MonitoringSettings, sqlx::Error> {
    sqlx::query_as(
        "SELECT offline_after_seconds, metrics_retention_days, check_result_retention_days,
                default_check_interval_seconds, default_check_timeout_ms, failure_threshold,
                cpu_threshold_percent, memory_threshold_percent, disk_threshold_percent, updated_at
         FROM monitor_settings WHERE id = 1",
    )
    .fetch_one(pool)
    .await
}
