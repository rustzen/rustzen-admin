use std::time::Duration;

use rustzen_storage::SqlitePool;

use super::service;

pub fn spawn_evaluator(pool: SqlitePool) {
    tokio::spawn(async move {
        loop {
            if let Err(error) = service::evaluate_once(&pool).await {
                tracing::error!(%error, "Monitoring incident evaluation failed");
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });
}
