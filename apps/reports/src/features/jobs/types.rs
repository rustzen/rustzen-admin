use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobInput {
    pub template_id: String,
    #[serde(default)]
    pub data: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub template_id: String,
    pub status: String,
    pub input_json: String,
    pub output_file: Option<String>,
    pub error: Option<String>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub expires_at: String,
}

pub struct NewJob<'a> {
    pub id: &'a str,
    pub template_id: &'a str,
    pub input_json: &'a str,
    pub created_at: &'a str,
    pub expires_at: &'a str,
}
