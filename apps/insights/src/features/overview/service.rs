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
        let from = query.from.unwrap_or_else(|| Utc::now() - Duration::days(30));
        let to = query.to.unwrap_or_else(Utc::now);
        if from > to {
            return Err(AppError::bad_request("from must be before to"));
        }

        let from = from.to_rfc3339();
        let to = to.to_rfc3339();
        let mut transaction = pool.begin().await.map_err(AppError::internal)?;
        let totals = repo::totals(&mut transaction, &query.project_id, &from, &to)
            .await
            .map_err(AppError::internal)?;
        let durations = repo::durations(&mut transaction, &query.project_id, &from, &to)
            .await
            .map_err(AppError::internal)?;
        transaction.commit().await.map_err(AppError::internal)?;

        Ok(Overview {
            pv: totals.pv,
            uv: totals.uv,
            request_count: totals.request_count,
            error_count: totals.error_count,
            average_duration_ms: totals.average_duration_ms,
            p95_duration_ms: percentile_95(&durations),
        })
    }
}

fn percentile_95(sorted: &[i64]) -> u64 {
    if sorted.is_empty() {
        return 0;
    }
    let index = ((sorted.len() * 95).div_ceil(100)).saturating_sub(1);
    u64::try_from(sorted[index]).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::percentile_95;

    #[test]
    fn percentile_contract_uses_nearest_rank() {
        assert_eq!(percentile_95(&[]), 0);
        assert_eq!(percentile_95(&[10, 20, 30, 40, 50]), 50);
        assert_eq!(percentile_95(&[10; 100]), 10);
    }
}
