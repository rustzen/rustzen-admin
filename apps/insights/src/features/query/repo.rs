use rustzen_storage::SqlitePool;

use super::types::{ApiStatRow, EventRow, PageStat, UserStat};

pub struct Window<'a> {
    pub project_id: &'a str,
    pub from: &'a str,
    pub to: &'a str,
    pub offset: i64,
    pub limit: i64,
}

pub async fn pages(
    pool: &SqlitePool,
    window: &Window<'_>,
    path: Option<&str>,
) -> Result<(Vec<PageStat>, i64), sqlx::Error> {
    let rows = sqlx::query_as(
        "SELECT page_path, COUNT(*) AS pv, COUNT(DISTINCT visitor_id) AS uv,
                COALESCE(AVG(duration_ms), 0.0) AS average_duration_ms,
                MAX(occurred_at) AS last_seen_at
         FROM insights_events
         WHERE project_id = ? AND event_name = 'page_view'
           AND occurred_at >= ? AND occurred_at <= ? AND page_path IS NOT NULL
           AND (? IS NULL OR page_path LIKE '%' || ? || '%')
         GROUP BY page_path ORDER BY pv DESC, page_path ASC LIMIT ? OFFSET ?",
    )
    .bind(window.project_id)
    .bind(window.from)
    .bind(window.to)
    .bind(path)
    .bind(path)
    .bind(window.limit)
    .bind(window.offset)
    .fetch_all(pool)
    .await?;
    let total = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT page_path) FROM insights_events
         WHERE project_id = ? AND event_name = 'page_view'
           AND occurred_at >= ? AND occurred_at <= ? AND page_path IS NOT NULL
           AND (? IS NULL OR page_path LIKE '%' || ? || '%')",
    )
    .bind(window.project_id)
    .bind(window.from)
    .bind(window.to)
    .bind(path)
    .bind(path)
    .fetch_one(pool)
    .await?;
    Ok((rows, total))
}

pub async fn apis(
    pool: &SqlitePool,
    window: &Window<'_>,
    path: Option<&str>,
) -> Result<(Vec<ApiStatRow>, i64), sqlx::Error> {
    let rows = sqlx::query_as(
        "WITH filtered AS (
             SELECT api_path, api_method, duration_ms, is_error, occurred_at
             FROM insights_events
             WHERE project_id = ? AND event_name = 'api_request'
               AND occurred_at >= ? AND occurred_at <= ? AND api_path IS NOT NULL
               AND (? IS NULL OR api_path LIKE '%' || ? || '%')
         ), ranked AS (
             SELECT api_path, api_method, duration_ms,
                    ROW_NUMBER() OVER (
                        PARTITION BY api_path, api_method ORDER BY duration_ms
                    ) AS duration_rank,
                    COUNT(duration_ms) OVER (
                        PARTITION BY api_path, api_method
                    ) AS duration_count
             FROM filtered WHERE duration_ms IS NOT NULL
         ), percentiles AS (
             SELECT api_path, api_method, duration_ms AS p95_duration_ms
             FROM ranked WHERE duration_rank = ((duration_count * 95 + 99) / 100)
         )
         SELECT filtered.api_path, filtered.api_method, COUNT(*) AS request_count,
                SUM(filtered.is_error) AS error_count,
                COALESCE(AVG(filtered.duration_ms), 0.0) AS average_duration_ms,
                COALESCE(MAX(percentiles.p95_duration_ms), 0) AS p95_duration_ms,
                MAX(filtered.occurred_at) AS last_seen_at
         FROM filtered
         LEFT JOIN percentiles
           ON percentiles.api_path = filtered.api_path
          AND percentiles.api_method IS filtered.api_method
         GROUP BY filtered.api_path, filtered.api_method
         ORDER BY request_count DESC, filtered.api_path ASC LIMIT ? OFFSET ?",
    )
    .bind(window.project_id)
    .bind(window.from)
    .bind(window.to)
    .bind(path)
    .bind(path)
    .bind(window.limit)
    .bind(window.offset)
    .fetch_all(pool)
    .await?;
    let total = sqlx::query_scalar(
        "SELECT COUNT(*) FROM (SELECT 1 FROM insights_events
         WHERE project_id = ? AND event_name = 'api_request'
           AND occurred_at >= ? AND occurred_at <= ? AND api_path IS NOT NULL
           AND (? IS NULL OR api_path LIKE '%' || ? || '%') GROUP BY api_path, api_method)",
    )
    .bind(window.project_id)
    .bind(window.from)
    .bind(window.to)
    .bind(path)
    .bind(path)
    .fetch_one(pool)
    .await?;
    Ok((rows, total))
}

#[allow(clippy::too_many_arguments)]
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
         WHERE project_id = ? AND occurred_at >= ? AND occurred_at <= ?
           AND (? IS NULL OR event_name = ?) AND (? IS NULL OR visitor_id = ?)
           AND (? IS NULL OR platform = ?)
         ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?",
    )
    .bind(window.project_id)
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
         WHERE project_id = ? AND occurred_at >= ? AND occurred_at <= ?
           AND (? IS NULL OR event_name = ?) AND (? IS NULL OR visitor_id = ?)
           AND (? IS NULL OR platform = ?)",
    )
    .bind(window.project_id)
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

pub async fn users(
    pool: &SqlitePool,
    window: &Window<'_>,
    keyword: Option<&str>,
) -> Result<(Vec<UserStat>, i64), sqlx::Error> {
    let rows = sqlx::query_as(
        "SELECT visitor_id, MAX(user_id) AS user_id, MAX(platform) AS platform,
                COUNT(*) AS event_count, MIN(occurred_at) AS first_seen_at,
                MAX(occurred_at) AS last_seen_at
         FROM insights_events WHERE project_id = ? AND occurred_at >= ? AND occurred_at <= ?
           AND (? IS NULL OR visitor_id LIKE '%' || ? || '%' OR user_id LIKE '%' || ? || '%')
         GROUP BY visitor_id ORDER BY last_seen_at DESC LIMIT ? OFFSET ?",
    )
    .bind(window.project_id)
    .bind(window.from)
    .bind(window.to)
    .bind(keyword)
    .bind(keyword)
    .bind(keyword)
    .bind(window.limit)
    .bind(window.offset)
    .fetch_all(pool)
    .await?;
    let total = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT visitor_id) FROM insights_events
         WHERE project_id = ? AND occurred_at >= ? AND occurred_at <= ?
           AND (? IS NULL OR visitor_id LIKE '%' || ? || '%' OR user_id LIKE '%' || ? || '%')",
    )
    .bind(window.project_id)
    .bind(window.from)
    .bind(window.to)
    .bind(keyword)
    .bind(keyword)
    .bind(keyword)
    .fetch_one(pool)
    .await?;
    Ok((rows, total))
}
