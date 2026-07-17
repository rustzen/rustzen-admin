use sqlx::SqliteConnection;

use super::types::{OverviewTotals, TrendPoint};

pub async fn totals(
    connection: &mut SqliteConnection,
    _project_id: &str,
    from: &str,
    to: &str,
) -> Result<OverviewTotals, sqlx::Error> {
    sqlx::query_as(
        "SELECT
           COALESCE(SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END), 0) AS pv,
           COUNT(DISTINCT visitor_id) AS uv,
           COUNT(*) AS event_count,
           COALESCE(SUM(CASE WHEN event_name = 'api_request' THEN 1 ELSE 0 END), 0)
             AS request_count,
           COALESCE(SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END), 0) AS error_count,
           COALESCE(AVG(CASE WHEN event_name = 'api_request' THEN duration_ms END), 0.0)
             AS average_duration_ms
         FROM insights_events
         WHERE occurred_at >= ? AND occurred_at <= ?",
    )
    .bind(from)
    .bind(to)
    .fetch_one(connection)
    .await
}

pub async fn p95_duration(
    connection: &mut SqliteConnection,
    _project_id: &str,
    from: &str,
    to: &str,
) -> Result<Option<i64>, sqlx::Error> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM insights_events
         WHERE event_name = 'api_request' AND duration_ms IS NOT NULL
         AND occurred_at >= ? AND occurred_at <= ?",
    )
    .bind(from)
    .bind(to)
    .fetch_one(&mut *connection)
    .await?;
    if count == 0 {
        return Ok(None);
    }
    let offset = (count * 95 + 99) / 100 - 1;
    sqlx::query_scalar(
        "SELECT duration_ms FROM insights_events
         WHERE event_name = 'api_request' AND duration_ms IS NOT NULL
         AND occurred_at >= ? AND occurred_at <= ? ORDER BY duration_ms ASC LIMIT 1 OFFSET ?",
    )
    .bind(from)
    .bind(to)
    .bind(offset)
    .fetch_optional(connection)
    .await
}

pub async fn trend(
    connection: &mut SqliteConnection,
    _project_id: &str,
    from: &str,
    to: &str,
) -> Result<Vec<TrendPoint>, sqlx::Error> {
    sqlx::query_as(
        "SELECT substr(occurred_at, 1, 10) AS date,
                SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS pv,
                COUNT(DISTINCT visitor_id) AS uv,
                SUM(CASE WHEN event_name = 'api_request' THEN 1 ELSE 0 END) AS request_count,
                SUM(is_error) AS error_count
         FROM insights_events WHERE occurred_at >= ? AND occurred_at <= ?
         GROUP BY substr(occurred_at, 1, 10) ORDER BY date ASC",
    )
    .bind(from)
    .bind(to)
    .fetch_all(connection)
    .await
}
