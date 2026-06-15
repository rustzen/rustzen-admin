use axum::{
    http::StatusCode,
    Json,
    response::{IntoResponse, Response},
};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("Invalid or expired token")]
    InvalidToken,
    #[error("Missing auth context")]
    MissingAuthContext,
    #[error("Permission denied")]
    PermissionDenied,
}

impl IntoResponse for CoreError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            CoreError::InvalidToken => (StatusCode::UNAUTHORIZED, 401, "Invalid or expired token"),
            CoreError::MissingAuthContext => (StatusCode::UNAUTHORIZED, 401, "Missing auth context"),
            CoreError::PermissionDenied => (StatusCode::FORBIDDEN, 403, "Permission denied"),
        };

        (status, Json(CoreErrorResponse { code, message, data: None })).into_response()
    }
}

#[derive(Serialize)]
struct CoreErrorResponse {
    code: i32,
    message: &'static str,
    data: Option<()>,
}
