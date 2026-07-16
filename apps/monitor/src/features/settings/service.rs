use chrono::Utc;
use rustzen_storage::SqlitePool;

use crate::common::error::AppError;

use super::{
    repo,
    types::{MonitoringSettings, UpdateMonitoringSettings},
};

pub(crate) async fn get(pool: &SqlitePool) -> Result<MonitoringSettings, AppError> {
    Ok(repo::get(pool).await?)
}

pub(crate) async fn update(
    pool: &SqlitePool,
    input: UpdateMonitoringSettings,
) -> Result<MonitoringSettings, AppError> {
    validate(&input)?;
    repo::update(pool, &input, &Utc::now().to_rfc3339()).await?;
    get(pool).await
}

fn validate(input: &UpdateMonitoringSettings) -> Result<(), AppError> {
    validate_integer("offlineAfterSeconds", input.offline_after_seconds, 30, 3600)?;
    validate_integer("metricsRetentionDays", input.metrics_retention_days, 1, 365)?;
    validate_integer("checkResultRetentionDays", input.check_result_retention_days, 1, 365)?;
    validate_integer(
        "defaultCheckIntervalSeconds",
        input.default_check_interval_seconds,
        30,
        86400,
    )?;
    validate_integer("defaultCheckTimeoutMs", input.default_check_timeout_ms, 100, 30000)?;
    validate_integer("failureThreshold", input.failure_threshold, 1, 20)?;
    for (name, value) in [
        ("cpuThresholdPercent", input.cpu_threshold_percent),
        ("memoryThresholdPercent", input.memory_threshold_percent),
        ("diskThresholdPercent", input.disk_threshold_percent),
    ] {
        if !value.is_finite() || !(1.0..=100.0).contains(&value) {
            return Err(AppError::invalid_input(format!("{name} must be between 1 and 100")));
        }
    }
    Ok(())
}

fn validate_integer(name: &str, value: i64, minimum: i64, maximum: i64) -> Result<(), AppError> {
    if !(minimum..=maximum).contains(&value) {
        return Err(AppError::invalid_input(format!(
            "{name} must be between {minimum} and {maximum}"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::infra::db::migrated_test_pool;

    use super::{UpdateMonitoringSettings, get, update};

    fn input() -> UpdateMonitoringSettings {
        UpdateMonitoringSettings {
            offline_after_seconds: 120,
            metrics_retention_days: 14,
            check_result_retention_days: 21,
            default_check_interval_seconds: 60,
            default_check_timeout_ms: 1500,
            failure_threshold: 2,
            cpu_threshold_percent: 80.0,
            memory_threshold_percent: 85.0,
            disk_threshold_percent: 90.0,
        }
    }

    #[tokio::test]
    async fn settings_are_validated_and_persisted() {
        let pool = migrated_test_pool().await;
        let updated = update(&pool, input()).await.expect("update settings");
        assert_eq!(updated.offline_after_seconds, 120);
        assert_eq!(get(&pool).await.expect("reload settings").metrics_retention_days, 14);

        let mut invalid = input();
        invalid.failure_threshold = 0;
        assert!(update(&pool, invalid).await.is_err());
    }
}
