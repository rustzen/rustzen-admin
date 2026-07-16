use axum::extract::{Path, State};
use rustzen_ipc::ModuleQuery;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult, Page},
};

use super::{service, types::*};

pub async fn pages(
    State(state): State<AppState>,
    ModuleQuery(query): ModuleQuery<PageQuery>,
) -> AppResult<Page<PageStat>> {
    Ok(ApiResponse::success(service::pages(&state.pool, query).await?))
}

pub async fn apis(
    State(state): State<AppState>,
    ModuleQuery(query): ModuleQuery<ApiQuery>,
) -> AppResult<Page<ApiStat>> {
    Ok(ApiResponse::success(service::apis(&state.pool, query).await?))
}

pub async fn events(
    State(state): State<AppState>,
    ModuleQuery(query): ModuleQuery<EventQuery>,
) -> AppResult<Page<Event>> {
    Ok(ApiResponse::success(service::events(&state.pool, query).await?))
}

pub async fn users(
    State(state): State<AppState>,
    ModuleQuery(query): ModuleQuery<UserQuery>,
) -> AppResult<Page<UserStat>> {
    Ok(ApiResponse::success(service::users(&state.pool, query).await?))
}

pub async fn user_events(
    State(state): State<AppState>,
    Path(visitor_id): Path<String>,
    ModuleQuery(query): ModuleQuery<UserEventQuery>,
) -> AppResult<Page<Event>> {
    Ok(ApiResponse::success(service::user_events(&state.pool, visitor_id, query).await?))
}
