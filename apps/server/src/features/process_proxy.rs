use axum::http::StatusCode;
use reqwest::{Method, Response};
use serde_json::Value;

use crate::{
    common::error::AppError,
    processes::common::{ipc_client, sign_ipc_request},
};

pub async fn request_json(
    worker: &str,
    method: Method,
    url: String,
    path: &str,
    capability: &str,
    query: Option<&[(String, String)]>,
    body: Option<&Value>,
) -> Result<Value, AppError> {
    let client = ipc_client().map_err(|_| AppError::worker_unavailable(worker))?;
    let mut request =
        sign_ipc_request(client.request(method.clone(), url), method.as_str(), path, capability)
            .map_err(|_| AppError::worker_unavailable(worker))?;
    if let Some(query) = query {
        request = request.query(query);
    }
    if let Some(body) = body {
        request = request.json(body);
    }
    let response = request.send().await.map_err(|error| {
        tracing::warn!(%error, %worker, "Worker request failed");
        AppError::worker_unavailable(worker)
    })?;
    response_json(worker, response).await
}

pub async fn request_bytes(
    worker: &str,
    url: String,
    path: &str,
    capability: &str,
) -> Result<Response, AppError> {
    let client = ipc_client().map_err(|_| AppError::worker_unavailable(worker))?;
    sign_ipc_request(client.get(url), "GET", path, capability)
        .map_err(|_| AppError::worker_unavailable(worker))?
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, %worker, "Worker download request failed");
            AppError::worker_unavailable(worker)
        })
}

async fn response_json(worker: &str, response: Response) -> Result<Value, AppError> {
    let status = response.status();
    if status.is_success() {
        if status == StatusCode::NO_CONTENT || response.content_length() == Some(0) {
            return Ok(Value::Null);
        }
        return response.json().await.map_err(|error| {
            tracing::warn!(%error, %worker, "Worker returned invalid JSON");
            AppError::worker_unavailable(worker)
        });
    }
    let message = response
        .text()
        .await
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("{worker} worker rejected the request"));
    Err(AppError::upstream(status, message))
}
