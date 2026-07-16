use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::FromRow;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackInput {
    pub event_type: EventType,
    pub visitor_id: String,
    pub path: String,
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub is_error: bool,
    pub occurred_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    PageView,
    ApiRequest,
}

impl EventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::PageView => "page_view",
            Self::ApiRequest => "api_request",
        }
    }
}

pub struct DomainCredentials {
    pub project_key: Option<String>,
    pub origin: Option<String>,
}

#[derive(FromRow)]
pub struct ProjectCredential {
    pub id: String,
    pub allowed_origins: String,
}

pub struct NewEvent<'a> {
    pub project_id: String,
    pub event_type: &'static str,
    pub visitor_id: &'a str,
    pub path: &'a str,
    pub duration_ms: Option<i64>,
    pub is_error: i64,
    pub occurred_at: String,
}
