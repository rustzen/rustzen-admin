use rustzen_storage::SqlitePool;
use sqlx::SqliteConnection;

use super::types::{NewProject, ProjectRow};

pub async fn list(pool: &SqlitePool) -> Result<Vec<ProjectRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, name, allowed_origins, created_at
         FROM insights_projects ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
}

pub async fn insert(
    connection: &mut SqliteConnection,
    project: &NewProject,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO insights_projects
         (id, name, project_key_hash, allowed_origins, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&project.id)
    .bind(&project.name)
    .bind(&project.project_key_hash)
    .bind(&project.allowed_origins)
    .bind(&project.created_at)
    .bind(&project.updated_at)
    .execute(connection)
    .await?;
    Ok(())
}
