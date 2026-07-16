use sqlx::SqliteConnection;

use super::types::{NewEvent, ProjectCredential};

pub async fn find_project_by_key(
    connection: &mut SqliteConnection,
    project_key_hash: &str,
) -> Result<Option<ProjectCredential>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, allowed_origins
         FROM insights_projects WHERE project_key_hash = ?",
    )
    .bind(project_key_hash)
    .fetch_optional(connection)
    .await
}

pub async fn insert_event(
    connection: &mut SqliteConnection,
    event: &NewEvent<'_>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO insights_events
         (project_id, event_type, visitor_id, path, duration_ms, is_error, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&event.project_id)
    .bind(event.event_type)
    .bind(event.visitor_id)
    .bind(event.path)
    .bind(event.duration_ms)
    .bind(event.is_error)
    .bind(&event.occurred_at)
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
