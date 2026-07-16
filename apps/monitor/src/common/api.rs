use axum::Json;
use serde::Serialize;

use crate::common::error::AppError;

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub code: i32,
    pub message: String,
    pub data: T,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Json<Self> {
        Json(Self { code: 0, message: "Success".to_string(), data })
    }
}

pub type AppResult<T> = Result<Json<ApiResponse<T>>, AppError>;

#[cfg(test)]
mod tests {
    use super::ApiResponse;

    #[test]
    fn success_response_keeps_the_public_envelope() {
        let response = ApiResponse::success(serde_json::json!({ "id": "node-1" }));
        assert_eq!(
            serde_json::to_value(response.0).expect("serialize response"),
            serde_json::json!({
                "code": 0,
                "message": "Success",
                "data": { "id": "node-1" }
            })
        );
    }
}
