use axum::Json;
use serde::Serialize;

/// The success envelope returned by module HTTP endpoints.
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

/// The paged response body shared by compatible module endpoints.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Page<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub success: bool,
}

/// Validated request pagination shared by module endpoints.
#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub struct Pagination {
    current: i64,
    page_size: i64,
}

impl Pagination {
    pub fn parse(current: Option<i64>, page_size: Option<i64>) -> Result<Self, PaginationError> {
        let current = current.unwrap_or(1);
        let page_size = page_size.unwrap_or(20);
        if current < 1 || !(1..=100).contains(&page_size) {
            return Err(PaginationError);
        }
        (current - 1).checked_mul(page_size).ok_or(PaginationError)?;
        Ok(Self { current, page_size })
    }

    pub fn current(self) -> i64 {
        self.current
    }

    pub fn page_size(self) -> i64 {
        self.page_size
    }

    pub fn offset(self) -> i64 {
        (self.current - 1) * self.page_size
    }
}

#[derive(Debug, thiserror::Error)]
#[error("invalid pagination")]
pub struct PaginationError;

#[cfg(test)]
mod tests {
    use super::{ApiResponse, Page, Pagination};

    #[test]
    fn success_response_keeps_the_module_public_envelope() {
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

    #[test]
    fn page_and_pagination_keep_the_module_wire_contract() {
        let pagination = Pagination::parse(Some(2), Some(25)).expect("valid pagination");
        assert_eq!(pagination.current(), 2);
        assert_eq!(pagination.page_size(), 25);
        assert_eq!(pagination.offset(), 25);
        assert!(Pagination::parse(Some(0), Some(25)).is_err());
        assert!(Pagination::parse(Some(1), Some(101)).is_err());
        assert!(Pagination::parse(Some(i64::MAX), Some(100)).is_err());
        assert_eq!(
            serde_json::to_value(Page { data: vec!["run-1"], total: 1, success: true })
                .expect("serialize page"),
            serde_json::json!({ "data": ["run-1"], "total": 1, "success": true })
        );
    }
}
