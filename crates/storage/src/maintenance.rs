use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::CoreError;

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct SqliteMaintenancePlan {
    checkpoint_truncate: bool,
    incremental_vacuum: bool,
    optimize: bool,
}

impl SqliteMaintenancePlan {
    pub fn reclaim() -> Self {
        Self { checkpoint_truncate: true, incremental_vacuum: true, optimize: true }
    }
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct SqlitePragmaSnapshot {
    pub page_size: i64,
    pub page_count: i64,
    pub freelist_count: i64,
    pub freelist_bytes: i64,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct WalCheckpointResult {
    pub busy: i64,
    pub log_frames: i64,
    pub checkpointed_frames: i64,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct SqliteMaintenanceReport {
    pub before: SqlitePragmaSnapshot,
    pub after: SqlitePragmaSnapshot,
    pub checkpoint: Option<WalCheckpointResult>,
    pub optimized: bool,
    pub vacuumed: bool,
}

pub async fn run_sqlite_maintenance(
    pool: &SqlitePool,
    plan: SqliteMaintenancePlan,
) -> Result<SqliteMaintenanceReport, CoreError> {
    let before = pragma_snapshot(pool).await?;
    let checkpoint = if plan.checkpoint_truncate {
        let (busy, log_frames, checkpointed_frames) =
            sqlx::query_as("PRAGMA wal_checkpoint(TRUNCATE)").fetch_one(pool).await?;
        Some(WalCheckpointResult { busy, log_frames, checkpointed_frames })
    } else {
        None
    };
    if plan.optimize {
        sqlx::query("PRAGMA optimize").execute(pool).await?;
    }
    if plan.incremental_vacuum {
        sqlx::query("PRAGMA incremental_vacuum").execute(pool).await?;
    }
    Ok(SqliteMaintenanceReport {
        before,
        after: pragma_snapshot(pool).await?,
        checkpoint,
        optimized: plan.optimize,
        vacuumed: plan.incremental_vacuum,
    })
}

async fn pragma_snapshot(pool: &SqlitePool) -> Result<SqlitePragmaSnapshot, CoreError> {
    let page_size: i64 = sqlx::query_scalar("PRAGMA page_size").fetch_one(pool).await?;
    let page_count: i64 = sqlx::query_scalar("PRAGMA page_count").fetch_one(pool).await?;
    let freelist_count: i64 = sqlx::query_scalar("PRAGMA freelist_count").fetch_one(pool).await?;
    Ok(SqlitePragmaSnapshot {
        page_size,
        page_count,
        freelist_count,
        freelist_bytes: page_size.saturating_mul(freelist_count),
    })
}

#[cfg(test)]
mod tests {
    use super::SqliteMaintenancePlan;

    #[test]
    fn reclaim_plan_enables_all_safe_maintenance_steps() {
        let plan = SqliteMaintenancePlan::reclaim();
        assert!(plan.checkpoint_truncate);
        assert!(plan.incremental_vacuum);
        assert!(plan.optimize);
    }
}
