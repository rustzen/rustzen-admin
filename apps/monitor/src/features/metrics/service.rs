use chrono::{Duration, Utc};
use rustzen_config::RETENTION_DAYS;
use rustzen_storage::{SqliteMaintenancePlan, SqlitePool, run_sqlite_maintenance};

use super::{repo, types::RetentionResult};

pub(super) async fn run_once(
    pool: &SqlitePool,
) -> Result<RetentionResult, Box<dyn std::error::Error + Send + Sync>> {
    let cutoff = (Utc::now() - Duration::days(RETENTION_DAYS as i64)).to_rfc3339();
    let deleted = repo::delete_before(pool, &cutoff).await?;
    if deleted > 0 {
        run_sqlite_maintenance(pool, SqliteMaintenancePlan::reclaim()).await?;
    }
    Ok(RetentionResult { deleted })
}
