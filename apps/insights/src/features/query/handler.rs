use axum::extract::State;
use rustzen_ipc::ModuleQuery;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult, Page},
};

use super::{
    service,
    types::{Event, EventQuery},
};

pub async fn events(
    State(state): State<AppState>,
    ModuleQuery(query): ModuleQuery<EventQuery>,
) -> AppResult<Page<Event>> {
    Ok(ApiResponse::success(service::events(&state.pool, query).await?))
}
