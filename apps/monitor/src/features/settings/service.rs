use rustzen_storage::SqlitePool;

use crate::common::error::AppError;

use super::{repo, types::MonitoringSettings};

pub(crate) async fn get(pool: &SqlitePool) -> Result<MonitoringSettings, AppError> {
    Ok(repo::get(pool).await?)
}

#[cfg(test)]
mod tests {
    use crate::infra::db::migrated_test_pool;

    use super::get;

    #[tokio::test]
    async fn default_settings_are_available() {
        let pool = migrated_test_pool().await;
        let settings = get(&pool).await.expect("settings");
        assert!(settings.offline_after_seconds > 0);
        assert!(settings.metrics_retention_days > 0);
    }
}
