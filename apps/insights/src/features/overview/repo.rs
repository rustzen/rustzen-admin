use sqlx::SqliteConnection;

use super::types::OverviewTotals;

pub async fn totals(
    connection: &mut SqliteConnection,
    project_id: &str,
    from: &str,
    to: &str,
) -> Result<OverviewTotals, sqlx::Error> {
    sqlx::query_as(
        "SELECT
           COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS pv,
           COUNT(DISTINCT visitor_id) AS uv,
           COALESCE(SUM(CASE WHEN event_type = 'api_request' THEN 1 ELSE 0 END), 0)
             AS request_count,
           COALESCE(SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END), 0) AS error_count,
           COALESCE(AVG(CASE WHEN event_type = 'api_request' THEN duration_ms END), 0.0)
             AS average_duration_ms
         FROM insights_events
         WHERE project_id = ? AND occurred_at >= ? AND occurred_at <= ?",
    )
    .bind(project_id)
    .bind(from)
    .bind(to)
    .fetch_one(connection)
    .await
}

pub async fn durations(
    connection: &mut SqliteConnection,
    project_id: &str,
    from: &str,
    to: &str,
) -> Result<Vec<i64>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT duration_ms FROM insights_events
         WHERE project_id = ? AND event_type = 'api_request'
           AND duration_ms IS NOT NULL AND occurred_at >= ? AND occurred_at <= ?
         ORDER BY duration_ms ASC",
    )
    .bind(project_id)
    .bind(from)
    .bind(to)
    .fetch_all(connection)
    .await
}
