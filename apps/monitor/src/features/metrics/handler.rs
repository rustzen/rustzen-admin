use std::time::Duration;

use rustzen_storage::SqlitePool;

use super::service;

const RETENTION_INTERVAL: Duration = Duration::from_secs(60 * 60);

pub fn spawn_retention(pool: SqlitePool) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(RETENTION_INTERVAL).await;
            match service::run_once(&pool).await {
                Ok(result) if result.deleted > 0 => {
                    tracing::info!(deleted = result.deleted, "Monitor metric retention completed");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "Monitor metric retention failed"),
            }
        }
    });
}
