use rustzen_storage::SqlitePool;

use super::types::Settings;

pub async fn get(pool: &SqlitePool) -> Result<Settings, sqlx::Error> {
    sqlx::query_as(
        "SELECT event_retention_days, default_query_days, max_query_days,
                max_batch_events, business_timezone, updated_at
         FROM insights_settings WHERE singleton = 1",
    )
    .fetch_one(pool)
    .await
}

pub async fn update(
    pool: &SqlitePool,
    event_retention_days: i64,
    default_query_days: i64,
    max_query_days: i64,
    updated_at: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE insights_settings
         SET event_retention_days = ?, default_query_days = ?, max_query_days = ?, updated_at = ?
         WHERE singleton = 1",
    )
    .bind(event_retention_days)
    .bind(default_query_days)
    .bind(max_query_days)
    .bind(updated_at)
    .execute(pool)
    .await?;
    Ok(())
}
