use chrono::Utc;
use rustzen_storage::SqlitePool;

use crate::common::error::AppError;

use super::{
    repo,
    types::{Settings, UpdateSettings},
};

pub async fn get(pool: &SqlitePool) -> Result<Settings, AppError> {
    repo::get(pool).await.map_err(AppError::internal)
}

pub async fn update(pool: &SqlitePool, input: UpdateSettings) -> Result<Settings, AppError> {
    if !(1..=3650).contains(&input.event_retention_days)
        || !(1..=90).contains(&input.default_query_days)
        || !(1..=365).contains(&input.max_query_days)
        || input.default_query_days > input.max_query_days
    {
        return Err(AppError::bad_request("invalid Analytics settings"));
    }
    repo::update(
        pool,
        input.event_retention_days,
        input.default_query_days,
        input.max_query_days,
        &Utc::now().to_rfc3339(),
    )
    .await?;
    get(pool).await
}
