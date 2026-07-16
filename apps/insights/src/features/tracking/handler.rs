use axum::{
    Json,
    extract::State,
    http::{HeaderMap, HeaderValue, StatusCode, header},
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
    types::{DomainCredentials, TrackAccepted, TrackInput},
};

pub async fn track(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<TrackAccepted> {
    let project_key = header_value(&headers, "x-rustzen-project-key")
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::unauthorized("project key is required"))?;
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
    let origin = headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
        .or_else(|| {
            headers
                .get(header::REFERER)
                .and_then(|value| value.to_str().ok())
                .and_then(referer_origin)
        });
    let result = TrackingService::track(
        &state.pool,
        inputs,
        DomainCredentials { project_key: project_key.to_string(), origin },
    )
    .await?;
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

fn header_value<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|value| value.to_str().ok())
}

fn referer_origin(value: &str) -> Option<String> {
    let scheme_end = value.find("://")? + 3;
    let path = value[scheme_end..].find('/').map(|index| scheme_end + index).unwrap_or(value.len());
    Some(value[..path].to_ascii_lowercase())
}
