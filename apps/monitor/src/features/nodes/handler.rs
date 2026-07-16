use axum::extract::{Path, State};

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
};

use super::{
    service,
    types::{NodeOverview, NodeView},
};

pub(crate) async fn overview(State(state): State<AppState>) -> AppResult<NodeOverview> {
    Ok(ApiResponse::success(service::overview(&state.pool).await?))
}

pub(crate) async fn list(State(state): State<AppState>) -> AppResult<Vec<NodeView>> {
    Ok(ApiResponse::success(service::list(&state.pool).await?))
}

pub(crate) async fn get(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
) -> AppResult<NodeView> {
    Ok(ApiResponse::success(service::get(&state.pool, &node_id).await?))
}
