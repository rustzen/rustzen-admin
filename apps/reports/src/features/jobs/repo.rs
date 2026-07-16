use sqlx::SqlitePool;

use crate::common::error::AppError;

use super::types::{Job, NewJob};

#[derive(Clone)]
pub struct JobsRepository {
    pool: SqlitePool,
}

impl JobsRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn list(&self) -> Result<Vec<Job>, AppError> {
        sqlx::query_as(
            "SELECT id, template_id, status, input_json, output_file, error,
                    created_at, started_at, finished_at, expires_at
             FROM report_jobs
             ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::database)
    }

    pub async fn find(&self, id: &str) -> Result<Option<Job>, AppError> {
        sqlx::query_as(
            "SELECT id, template_id, status, input_json, output_file, error,
                    created_at, started_at, finished_at, expires_at
             FROM report_jobs
             WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::database)
    }

    pub async fn insert_queued(&self, job: NewJob<'_>) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO report_jobs
             (id, template_id, status, input_json, created_at, expires_at)
             VALUES (?, ?, 'queued', ?, ?, ?)",
        )
        .bind(job.id)
        .bind(job.template_id)
        .bind(job.input_json)
        .bind(job.created_at)
        .bind(job.expires_at)
        .execute(&self.pool)
        .await
        .map(|_| ())
        .map_err(AppError::database)
    }

    pub async fn mark_running(&self, id: &str, started_at: &str) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE report_jobs
             SET status = 'running', started_at = ?
             WHERE id = ?",
        )
        .bind(started_at)
        .bind(id)
        .execute(&self.pool)
        .await
        .map(|_| ())
        .map_err(AppError::database)
    }

    pub async fn mark_succeeded(
        &self,
        id: &str,
        output_file: &str,
        finished_at: &str,
    ) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE report_jobs
             SET status = 'succeeded', output_file = ?, finished_at = ?
             WHERE id = ?",
        )
        .bind(output_file)
        .bind(finished_at)
        .bind(id)
        .execute(&self.pool)
        .await
        .map(|_| ())
        .map_err(AppError::database)
    }

    pub async fn mark_failed(
        &self,
        id: &str,
        error: &str,
        finished_at: &str,
    ) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE report_jobs
             SET status = 'failed', error = ?, finished_at = ?
             WHERE id = ?",
        )
        .bind(error)
        .bind(finished_at)
        .bind(id)
        .execute(&self.pool)
        .await
        .map(|_| ())
        .map_err(AppError::database)
    }

    pub async fn recover_interrupted(&self, finished_at: &str) -> Result<u64, AppError> {
        sqlx::query(
            "UPDATE report_jobs
             SET status = 'failed', error = 'reports worker restarted', finished_at = ?
             WHERE status IN ('queued', 'running')",
        )
        .bind(finished_at)
        .execute(&self.pool)
        .await
        .map(|result| result.rows_affected())
        .map_err(AppError::database)
    }
}
