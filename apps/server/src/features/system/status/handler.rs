use crate::common::api::{ApiResponse, AppResult};

use super::{service::SystemStatusService, types::SystemStatusOverview};

pub async fn get_status_overview() -> AppResult<SystemStatusOverview> {
    Ok(ApiResponse::success(SystemStatusService::overview().await?))
}
