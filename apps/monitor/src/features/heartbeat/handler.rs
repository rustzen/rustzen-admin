use axum::{extract::State, http::HeaderMap};
use rustzen_ipc::ModuleJson;

use crate::{
    app::AppState,
    common::api::{ApiResponse, AppResult},
    middleware::require_agent_token,
};

use super::{service, types::HeartbeatInput};

pub(crate) async fn submit(
    State(state): State<AppState>,
    headers: HeaderMap,
    ModuleJson(input): ModuleJson<HeartbeatInput>,
) -> AppResult<()> {
    require_agent_token(&headers, state.agent_token.as_ref())?;
    service::record(&state.pool, input).await?;
    Ok(ApiResponse::success(()))
}
