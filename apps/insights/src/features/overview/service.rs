use chrono::{Duration, Utc};
use rustzen_storage::SqlitePool;

use crate::common::error::AppError;

use super::{
    repo,
    types::{Overview, OverviewQuery},
};

pub struct OverviewService;

impl OverviewService {
    pub async fn get(pool: &SqlitePool, query: OverviewQuery) -> Result<Overview, AppError> {
        let settings = crate::features::settings::service::get(pool).await?;
        let from =
            query.from.unwrap_or_else(|| Utc::now() - Duration::days(settings.default_query_days));
        let to = query.to.unwrap_or_else(Utc::now);
        if from > to || to - from > Duration::days(settings.max_query_days) {
            return Err(AppError::bad_request("invalid Analytics query range"));
        }

        let from = from.to_rfc3339();
        let to = to.to_rfc3339();
        let mut transaction = pool.begin().await.map_err(AppError::internal)?;
        let totals =
            repo::totals(&mut transaction, "", &from, &to).await.map_err(AppError::internal)?;
        let p95_duration = repo::p95_duration(&mut transaction, "", &from, &to)
            .await
            .map_err(AppError::internal)?;
        let trend =
            repo::trend(&mut transaction, "", &from, &to).await.map_err(AppError::internal)?;
        transaction.commit().await.map_err(AppError::internal)?;

        Ok(Overview {
            pv: totals.pv,
            uv: totals.uv,
            event_count: totals.event_count,
            request_count: totals.request_count,
            error_count: totals.error_count,
            average_duration_ms: totals.average_duration_ms,
            p95_duration_ms: p95_duration.and_then(|value| u64::try_from(value).ok()).unwrap_or(0),
            trend,
        })
    }
}
