use axum::Json;
pub use rustzen_ipc::{ApiResponse, Page};

use super::error::AppError;

pub type AppResult<T> = Result<Json<ApiResponse<T>>, AppError>;
