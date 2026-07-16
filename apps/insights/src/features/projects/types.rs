use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    #[serde(default)]
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedProject {
    pub id: String,
    pub name: String,
    pub project_key: String,
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub allowed_origins: String,
    pub created_at: String,
}

pub struct NewProject {
    pub id: String,
    pub name: String,
    pub project_key_hash: String,
    pub allowed_origins: String,
    pub created_at: String,
    pub updated_at: String,
}
