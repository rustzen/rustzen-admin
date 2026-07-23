use axum::Json;
pub use rustzen_ipc::ApiResponse;

use crate::common::error::AppError;

pub type AppResult<T> = Result<Json<ApiResponse<T>>, AppError>;
