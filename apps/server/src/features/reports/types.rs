use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize)]
#[serde(transparent)]
pub struct ReportsPayload(pub Value);
