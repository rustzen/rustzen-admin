use std::fmt::Display;

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};

#[derive(Debug)]
pub struct AppError {
    status: StatusCode,
    message: String,
}

impl AppError {
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, message)
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, message)
    }

    pub fn input_rejection(status: StatusCode, message: impl Into<String>) -> Self {
        Self::new(status, message)
    }

    pub fn internal(error: impl Display) -> Self {
        tracing::error!(%error, "Insights request failed");
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "insights worker error")
    }

    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self { status, message: message.into() }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for AppError {}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let body = Json(serde_json::json!({
            "code": 40002,
            "message": self.message,
            "data": null,
        }));
        (self.status, body).into_response()
    }
}
