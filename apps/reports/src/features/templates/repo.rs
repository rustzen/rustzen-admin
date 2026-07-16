use sqlx::SqlitePool;

use crate::common::error::AppError;

use super::types::Template;

#[derive(Clone)]
pub struct TemplatesRepository {
    pool: SqlitePool,
}

impl TemplatesRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn list(&self) -> Result<Vec<Template>, AppError> {
        sqlx::query_as(
            "SELECT id, name, content, created_at, updated_at
             FROM report_templates
             ORDER BY updated_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::database)
    }

    pub async fn save(
        &self,
        id: &str,
        name: &str,
        content: &str,
        now: &str,
    ) -> Result<Template, AppError> {
        sqlx::query_as(
            "INSERT INTO report_templates (id, name, content, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               content = excluded.content,
               updated_at = excluded.updated_at
             RETURNING id, name, content, created_at, updated_at",
        )
        .bind(id)
        .bind(name)
        .bind(content)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::database)
    }

    pub async fn find(&self, id: &str) -> Result<Option<Template>, AppError> {
        sqlx::query_as(
            "SELECT id, name, content, created_at, updated_at
             FROM report_templates
             WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::database)
    }
}
