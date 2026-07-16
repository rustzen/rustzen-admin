use axum::extract::State;
use rustzen_ipc::ModuleQuery;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
};

use super::{
    service::OverviewService,
    types::{Overview, OverviewQuery},
};

pub async fn overview(
    State(state): State<AppState>,
    ModuleQuery(query): ModuleQuery<OverviewQuery>,
) -> AppResult<Overview> {
    Ok(ApiResponse::success(OverviewService::get(&state.pool, query).await?))
}
