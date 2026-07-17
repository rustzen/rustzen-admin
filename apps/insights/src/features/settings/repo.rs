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
