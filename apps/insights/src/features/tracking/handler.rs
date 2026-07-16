use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode, header},
};
use serde_json::Value;

use crate::{
    app::AppState,
    common::{
        api::{ApiResponse, AppResult},
        error::AppError,
    },
};

use super::{
    service::TrackingService,
    types::{DomainCredentials, TrackInput},
};

pub async fn track(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<()> {
    let project_key = header_value(&headers, "x-rustzen-project-key")
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::unauthorized("project key is required"))?;
    if !body.is_object() {
        return Err(AppError::bad_request("event body must be an object"));
    }
    let input = serde_json::from_value::<TrackInput>(body).map_err(|error| {
        AppError::input_rejection(
            StatusCode::UNPROCESSABLE_ENTITY,
            format!("Failed to deserialize the JSON body into the target type: {error}"),
        )
    })?;
    let credentials = DomainCredentials {
        project_key: Some(project_key.to_string()),
        origin: headers
            .get(header::ORIGIN)
            .and_then(|value| value.to_str().ok())
            .map(str::to_string),
    };
    TrackingService::track(&state.pool, input, credentials).await?;
    Ok(ApiResponse::success(()))
}

fn header_value<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|value| value.to_str().ok())
}
