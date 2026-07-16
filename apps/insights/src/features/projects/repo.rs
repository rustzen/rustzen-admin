use rustzen_storage::SqlitePool;

use super::types::{NewProject, ProjectRow};

pub async fn list(pool: &SqlitePool) -> Result<Vec<ProjectRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, name, allowed_origins, archived_at, created_at, updated_at
         FROM insights_projects ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
}

pub async fn get(pool: &SqlitePool, id: &str) -> Result<Option<ProjectRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, name, allowed_origins, archived_at, created_at, updated_at
         FROM insights_projects WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn insert(pool: &SqlitePool, project: &NewProject) -> Result<(), sqlx::Error> {
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
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    allowed_origins: &str,
    updated_at: &str,
) -> Result<bool, sqlx::Error> {
    sqlx::query(
        "UPDATE insights_projects SET name = ?, allowed_origins = ?, updated_at = ?
         WHERE id = ? AND archived_at IS NULL",
    )
    .bind(name)
    .bind(allowed_origins)
    .bind(updated_at)
    .bind(id)
    .execute(pool)
    .await
    .map(|result| result.rows_affected() == 1)
}

pub async fn rotate_key(
    pool: &SqlitePool,
    id: &str,
    key_hash: &str,
    updated_at: &str,
) -> Result<bool, sqlx::Error> {
    sqlx::query(
        "UPDATE insights_projects SET project_key_hash = ?, updated_at = ?
         WHERE id = ? AND archived_at IS NULL",
    )
    .bind(key_hash)
    .bind(updated_at)
    .bind(id)
    .execute(pool)
    .await
    .map(|result| result.rows_affected() == 1)
}

pub async fn archive(pool: &SqlitePool, id: &str, now: &str) -> Result<bool, sqlx::Error> {
    sqlx::query(
        "UPDATE insights_projects SET archived_at = ?, updated_at = ?
         WHERE id = ? AND archived_at IS NULL",
    )
    .bind(now)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map(|result| result.rows_affected() == 1)
}
