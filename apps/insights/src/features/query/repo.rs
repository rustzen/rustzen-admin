use rustzen_storage::SqlitePool;

use super::types::EventRow;

pub struct Window<'a> {
    pub from: &'a str,
    pub to: &'a str,
    pub offset: i64,
    pub limit: i64,
}

pub async fn events(
    pool: &SqlitePool,
    window: &Window<'_>,
    event_name: Option<&str>,
    visitor_id: Option<&str>,
    platform: Option<&str>,
) -> Result<(Vec<EventRow>, i64), sqlx::Error> {
    let rows = sqlx::query_as(
        "SELECT id, event_name, visitor_id, user_id, session_id, platform, page_path,
                referrer, api_path, api_method, status_code, duration_ms, is_error,
                properties, occurred_at, received_at FROM insights_events
         WHERE occurred_at >= ? AND occurred_at <= ?
           AND (? IS NULL OR event_name = ?) AND (? IS NULL OR visitor_id = ?)
           AND (? IS NULL OR platform = ?)
         ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?",
    )
    .bind(window.from)
    .bind(window.to)
    .bind(event_name)
    .bind(event_name)
    .bind(visitor_id)
    .bind(visitor_id)
    .bind(platform)
    .bind(platform)
    .bind(window.limit)
    .bind(window.offset)
    .fetch_all(pool)
    .await?;
    let total = sqlx::query_scalar(
        "SELECT COUNT(*) FROM insights_events
         WHERE occurred_at >= ? AND occurred_at <= ?
           AND (? IS NULL OR event_name = ?) AND (? IS NULL OR visitor_id = ?)
           AND (? IS NULL OR platform = ?)",
    )
    .bind(window.from)
    .bind(window.to)
    .bind(event_name)
    .bind(event_name)
    .bind(visitor_id)
    .bind(visitor_id)
    .bind(platform)
    .bind(platform)
    .fetch_one(pool)
    .await?;
    Ok((rows, total))
}
