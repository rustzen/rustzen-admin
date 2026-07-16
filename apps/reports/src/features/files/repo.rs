use sqlx::SqlitePool;

use crate::common::error::AppError;

use super::types::{DownloadRecord, ExpiredOutput};

#[derive(Clone)]
pub struct FilesRepository {
    pool: SqlitePool,
}

impl FilesRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn find_download(&self, job_id: &str) -> Result<Option<DownloadRecord>, AppError> {
        sqlx::query_as(
            "SELECT status, output_file
             FROM report_jobs
             WHERE id = ?",
        )
        .bind(job_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::database)
    }

    pub async fn expired_outputs(&self, now: &str) -> Result<Vec<ExpiredOutput>, AppError> {
        sqlx::query_as(
            "SELECT output_file
             FROM report_jobs
             WHERE expires_at < ?",
        )
        .bind(now)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::database)
    }

    pub async fn delete_expired(&self, now: &str) -> Result<u64, AppError> {
        sqlx::query("DELETE FROM report_jobs WHERE expires_at < ?")
            .bind(now)
            .execute(&self.pool)
            .await
            .map(|result| result.rows_affected())
            .map_err(AppError::database)
    }
}
