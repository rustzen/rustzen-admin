use chrono::{DateTime, Duration, Utc};
use rustzen_storage::{SqliteMaintenancePlan, SqlitePool, run_sqlite_maintenance};

use crate::common::error::AppError;

use super::{
    repo,
    types::{MetricPoint, MetricsQuery, RetentionResult},
};

pub(crate) async fn list(
    pool: &SqlitePool,
    node_id: &str,
    query: MetricsQuery,
) -> Result<Vec<MetricPoint>, AppError> {
    let to = parse_time(query.to.as_deref(), Utc::now())?;
    let from = parse_time(query.from.as_deref(), to - Duration::hours(24))?;
    if from > to {
        return Err(AppError::invalid_input("from must not be after to"));
    }
    if to - from > Duration::days(90) {
        return Err(AppError::invalid_input("metric query range cannot exceed 90 days"));
    }
    let rows = match query.bucket.as_deref().unwrap_or("raw") {
        "raw" => repo::load_raw(pool, node_id, &from.to_rfc3339(), &to.to_rfc3339()).await?,
        "5m" => {
            repo::load_bucketed(pool, node_id, &from.to_rfc3339(), &to.to_rfc3339(), 300).await?
        }
        "1h" => {
            repo::load_bucketed(pool, node_id, &from.to_rfc3339(), &to.to_rfc3339(), 3600).await?
        }
        _ => return Err(AppError::invalid_input("bucket must be raw, 5m, or 1h")),
    };
    Ok(rows.into_iter().map(MetricPoint::from).collect())
}

fn parse_time(value: Option<&str>, default: DateTime<Utc>) -> Result<DateTime<Utc>, AppError> {
    value
        .map(DateTime::parse_from_rfc3339)
        .transpose()
        .map(|value| value.map(|value| value.with_timezone(&Utc)).unwrap_or(default))
        .map_err(|_| AppError::invalid_input("from and to must be RFC3339 timestamps"))
}

pub(super) async fn run_once(
    pool: &SqlitePool,
) -> Result<RetentionResult, Box<dyn std::error::Error + Send + Sync>> {
    let retention_days =
        crate::features::settings::service::get(pool).await?.metrics_retention_days;
    let cutoff = (Utc::now() - Duration::days(retention_days)).to_rfc3339();
    let deleted = repo::delete_before(pool, &cutoff).await?;
    if deleted > 0 {
        run_sqlite_maintenance(pool, SqliteMaintenancePlan::reclaim()).await?;
    }
    Ok(RetentionResult { deleted })
}
