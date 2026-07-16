use rustzen_storage::SqlitePool;
use sqlx::{Sqlite, Transaction};

use super::types::{Check, CheckExecution, CheckResult};

pub(super) async fn list(
    pool: &SqlitePool,
    offset: i64,
    limit: i64,
    enabled: Option<bool>,
    status: Option<&str>,
) -> Result<(Vec<Check>, i64), sqlx::Error> {
    let rows = sqlx::query_as(
        "SELECT id, name, host, port, interval_seconds, timeout_ms, failure_threshold,
                enabled, last_status, last_checked_at, last_latency_ms, consecutive_failures,
                created_at, updated_at
         FROM monitor_checks
         WHERE (? IS NULL OR enabled = ?)
           AND (? IS NULL OR last_status = ?)
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?",
    )
    .bind(enabled)
    .bind(enabled)
    .bind(status)
    .bind(status)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    let total = sqlx::query_scalar(
        "SELECT COUNT(*) FROM monitor_checks
         WHERE (? IS NULL OR enabled = ?)
           AND (? IS NULL OR last_status = ?)",
    )
    .bind(enabled)
    .bind(enabled)
    .bind(status)
    .bind(status)
    .fetch_one(pool)
    .await?;
    Ok((rows, total))
}

pub(super) async fn get(pool: &SqlitePool, id: &str) -> Result<Option<Check>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, name, host, port, interval_seconds, timeout_ms, failure_threshold,
                enabled, last_status, last_checked_at, last_latency_ms, consecutive_failures,
                created_at, updated_at
         FROM monitor_checks WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub(super) async fn insert(pool: &SqlitePool, check: &Check) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO monitor_checks (
           id, name, host, port, interval_seconds, timeout_ms, failure_threshold,
           enabled, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&check.id)
    .bind(&check.name)
    .bind(&check.host)
    .bind(check.port)
    .bind(check.interval_seconds)
    .bind(check.timeout_ms)
    .bind(check.failure_threshold)
    .bind(check.enabled)
    .bind(&check.created_at)
    .bind(&check.updated_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub(super) async fn update(pool: &SqlitePool, check: &Check) -> Result<bool, sqlx::Error> {
    sqlx::query(
        "UPDATE monitor_checks SET name = ?, host = ?, port = ?, interval_seconds = ?,
                timeout_ms = ?, failure_threshold = ?, enabled = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(&check.name)
    .bind(&check.host)
    .bind(check.port)
    .bind(check.interval_seconds)
    .bind(check.timeout_ms)
    .bind(check.failure_threshold)
    .bind(check.enabled)
    .bind(&check.updated_at)
    .bind(&check.id)
    .execute(pool)
    .await
    .map(|result| result.rows_affected() == 1)
}

pub(super) async fn set_enabled(
    pool: &SqlitePool,
    id: &str,
    enabled: bool,
    updated_at: &str,
) -> Result<bool, sqlx::Error> {
    sqlx::query("UPDATE monitor_checks SET enabled = ?, updated_at = ? WHERE id = ?")
        .bind(enabled)
        .bind(updated_at)
        .bind(id)
        .execute(pool)
        .await
        .map(|result| result.rows_affected() == 1)
}

pub(super) async fn delete(pool: &SqlitePool, id: &str) -> Result<bool, sqlx::Error> {
    sqlx::query("DELETE FROM monitor_checks WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map(|result| result.rows_affected() == 1)
}

pub(super) async fn due(pool: &SqlitePool, now: &str) -> Result<Vec<Check>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, name, host, port, interval_seconds, timeout_ms, failure_threshold,
                enabled, last_status, last_checked_at, last_latency_ms, consecutive_failures,
                created_at, updated_at
         FROM monitor_checks
         WHERE enabled = TRUE
           AND (last_checked_at IS NULL
                OR unixepoch(last_checked_at) + interval_seconds <= unixepoch(?))
         ORDER BY COALESCE(last_checked_at, created_at) ASC
         LIMIT 16",
    )
    .bind(now)
    .fetch_all(pool)
    .await
}

pub(super) async fn record_execution(
    transaction: &mut Transaction<'_, Sqlite>,
    check: &Check,
    execution: &CheckExecution,
    checked_at: &str,
) -> Result<i64, sqlx::Error> {
    let consecutive_failures =
        if execution.status == "down" { check.consecutive_failures + 1 } else { 0 };
    sqlx::query(
        "UPDATE monitor_checks SET last_status = ?, last_checked_at = ?,
                last_latency_ms = ?, consecutive_failures = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(execution.status)
    .bind(checked_at)
    .bind(execution.latency_ms)
    .bind(consecutive_failures)
    .bind(checked_at)
    .bind(&check.id)
    .execute(&mut **transaction)
    .await?;
    sqlx::query(
        "INSERT INTO monitor_check_results
           (check_id, status, latency_ms, error, checked_at)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&check.id)
    .bind(execution.status)
    .bind(execution.latency_ms)
    .bind(&execution.error)
    .bind(checked_at)
    .execute(&mut **transaction)
    .await?;
    Ok(consecutive_failures)
}

pub(super) async fn results(
    pool: &SqlitePool,
    check_id: &str,
    offset: i64,
    limit: i64,
) -> Result<(Vec<CheckResult>, i64), sqlx::Error> {
    let rows = sqlx::query_as(
        "SELECT id, check_id, status, latency_ms, error, checked_at
         FROM monitor_check_results WHERE check_id = ?
         ORDER BY checked_at DESC LIMIT ? OFFSET ?",
    )
    .bind(check_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    let total = sqlx::query_scalar("SELECT COUNT(*) FROM monitor_check_results WHERE check_id = ?")
        .bind(check_id)
        .fetch_one(pool)
        .await?;
    Ok((rows, total))
}

pub(super) async fn delete_results_before(
    pool: &SqlitePool,
    cutoff: &str,
) -> Result<u64, sqlx::Error> {
    sqlx::query("DELETE FROM monitor_check_results WHERE checked_at < ?")
        .bind(cutoff)
        .execute(pool)
        .await
        .map(|result| result.rows_affected())
}

pub(super) async fn unhealthy_count(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM monitor_checks WHERE enabled = TRUE AND last_status = 'down'",
    )
    .fetch_one(pool)
    .await
}
