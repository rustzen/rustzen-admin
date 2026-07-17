use axum::{
    Json,
    extract::State,
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
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
    types::{TrackAccepted, TrackInput},
};

pub async fn track(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<TrackAccepted> {
    let values = match body {
        Value::Array(values) => values,
        value @ Value::Object(_) => vec![value],
        _ => return Err(AppError::bad_request("event body must be an object or array")),
    };
    let inputs = values
        .into_iter()
        .map(serde_json::from_value::<TrackInput>)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| {
            AppError::input_rejection(
                StatusCode::UNPROCESSABLE_ENTITY,
                format!("Failed to deserialize the JSON body into the target type: {error}"),
            )
        })?;
    let result = TrackingService::track(&state.pool, inputs).await?;
    Ok(ApiResponse::success(result))
}

pub async fn tracker() -> Response {
    const SCRIPT: &str = include_str!("tracker.js");
    let mut response = SCRIPT.into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/javascript; charset=utf-8"),
    );
    response
}
