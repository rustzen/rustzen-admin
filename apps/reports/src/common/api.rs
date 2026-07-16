use axum::Json;
use serde::Serialize;

use super::error::AppError;

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub code: i32,
    pub message: &'static str,
    pub data: T,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Json<Self> {
        Json(Self { code: 0, message: "Success", data })
    }
}

pub type AppResult<T> = Result<Json<ApiResponse<T>>, AppError>;
