use rustzen_storage::SqlitePool;

use super::types::{MonitoringSettings, UpdateMonitoringSettings};

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

pub(super) async fn update(
    pool: &SqlitePool,
    input: &UpdateMonitoringSettings,
    updated_at: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE monitor_settings SET
           offline_after_seconds = ?, metrics_retention_days = ?,
           check_result_retention_days = ?, default_check_interval_seconds = ?,
           default_check_timeout_ms = ?, failure_threshold = ?,
           cpu_threshold_percent = ?, memory_threshold_percent = ?,
           disk_threshold_percent = ?, updated_at = ?
         WHERE id = 1",
    )
    .bind(input.offline_after_seconds)
    .bind(input.metrics_retention_days)
    .bind(input.check_result_retention_days)
    .bind(input.default_check_interval_seconds)
    .bind(input.default_check_timeout_ms)
    .bind(input.failure_threshold)
    .bind(input.cpu_threshold_percent)
    .bind(input.memory_threshold_percent)
    .bind(input.disk_threshold_percent)
    .bind(updated_at)
    .execute(pool)
    .await?;
    Ok(())
}
