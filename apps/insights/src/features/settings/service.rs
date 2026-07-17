use rustzen_storage::SqlitePool;

use crate::common::error::AppError;

use super::{repo, types::Settings};

pub async fn get(pool: &SqlitePool) -> Result<Settings, AppError> {
    repo::get(pool).await.map_err(AppError::internal)
}
