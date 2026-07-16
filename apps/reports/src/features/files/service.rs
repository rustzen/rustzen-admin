use std::{path::PathBuf, sync::Arc, time::Duration};

use rustzen_storage::{SqliteMaintenancePlan, run_sqlite_maintenance};
use sqlx::SqlitePool;

use crate::common::error::AppError;

use super::{repo::FilesRepository, types::OpenedReportFile};

#[derive(Clone)]
pub struct FilesService {
    repo: FilesRepository,
    pool: SqlitePool,
    output_dir: Arc<PathBuf>,
}

impl FilesService {
    pub fn new(pool: SqlitePool, output_dir: PathBuf) -> Self {
        Self { repo: FilesRepository::new(pool.clone()), pool, output_dir: Arc::new(output_dir) }
    }

    pub async fn open_download(&self, job_id: &str) -> Result<OpenedReportFile, AppError> {
        let record = self
            .repo
            .find_download(job_id)
            .await?
            .ok_or_else(|| AppError::NotFound("report job not found".to_string()))?;
        if record.status != "succeeded" {
            return Err(AppError::Conflict("report is not ready".to_string()));
        }
        let file_name = record
            .output_file
            .filter(|value| is_safe_file_name(value))
            .ok_or_else(|| AppError::NotFound("report output not found".to_string()))?;
        let path = self.output_dir.join(&file_name);
        let file = tokio::fs::File::open(&path).await.map_err(|error| {
            tracing::error!(%error, %job_id, path = %path.display(), "Report output open failed");
            AppError::NotFound("report output not found".to_string())
        })?;
        let length = file.metadata().await.map_err(AppError::internal)?.len();
        Ok(OpenedReportFile { file_name, file, length, path })
    }

    pub async fn write_output(&self, file_name: &str, content: String) -> std::io::Result<()> {
        if !is_safe_file_name(file_name) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "invalid report output file name",
            ));
        }
        tokio::fs::write(self.output_dir.join(file_name), content).await
    }

    pub async fn cleanup_expired(&self, now: &str) -> Result<u64, AppError> {
        for output in self.repo.expired_outputs(now).await? {
            let Some(file_name) = output.output_file.filter(|name| is_safe_file_name(name)) else {
                continue;
            };
            if let Err(error) = tokio::fs::remove_file(self.output_dir.join(file_name)).await
                && error.kind() != std::io::ErrorKind::NotFound
            {
                return Err(AppError::internal(error));
            }
        }
        let deleted = self.repo.delete_expired(now).await?;
        if deleted > 0
            && let Err(error) =
                run_sqlite_maintenance(&self.pool, SqliteMaintenancePlan::reclaim()).await
        {
            tracing::error!(%error, "Reports SQLite maintenance failed");
        }
        Ok(deleted)
    }

    pub fn spawn_retention(&self) {
        let service = self.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;
                let now = chrono::Utc::now().to_rfc3339();
                match service.cleanup_expired(&now).await {
                    Ok(0) => {}
                    Ok(deleted) => {
                        tracing::info!(deleted, "Report retention cleanup completed");
                    }
                    Err(error) => tracing::error!(%error, "Report retention cleanup failed"),
                }
            }
        });
    }
}

fn is_safe_file_name(value: &str) -> bool {
    !value.is_empty()
        && value != "."
        && value != ".."
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
}

#[cfg(test)]
mod tests {
    use super::is_safe_file_name;

    #[test]
    fn accepts_generated_names_and_rejects_paths_or_headers() {
        assert!(is_safe_file_name("4d96bc86-55be-43e0-a3db-1d78fb498938.html"));
        for value in ["", ".", "..", "../report.html", "report/name", "bad\nname.html"] {
            assert!(!is_safe_file_name(value));
        }
    }
}
