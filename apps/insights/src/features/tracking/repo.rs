use sqlx::SqliteConnection;

use super::types::NewEvent;

pub async fn insert_event(
    connection: &mut SqliteConnection,
    event: &NewEvent,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO insights_events (
           project_id, event_name, visitor_id, user_id, session_id, platform,
           page_path, referrer, api_path, api_method, status_code, duration_ms,
           is_error, properties, occurred_at, received_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&event.project_id)
    .bind(&event.event_name)
    .bind(&event.visitor_id)
    .bind(&event.user_id)
    .bind(&event.session_id)
    .bind(&event.platform)
    .bind(&event.page_path)
    .bind(&event.referrer)
    .bind(&event.api_path)
    .bind(&event.api_method)
    .bind(event.status_code)
    .bind(event.duration_ms)
    .bind(event.is_error)
    .bind(&event.properties)
    .bind(&event.occurred_at)
    .bind(&event.received_at)
    .execute(connection)
    .await?;
    Ok(())
}

pub async fn delete_events_before(
    connection: &mut SqliteConnection,
    cutoff: &str,
) -> Result<u64, sqlx::Error> {
    sqlx::query("DELETE FROM insights_events WHERE occurred_at < ?")
        .bind(cutoff)
        .execute(connection)
        .await
        .map(|result| result.rows_affected())
}
