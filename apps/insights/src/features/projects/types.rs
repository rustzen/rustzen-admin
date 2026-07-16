use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateProjectInput {
    pub name: String,
    #[serde(default)]
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateProjectInput {
    pub name: String,
    #[serde(default)]
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectKey {
    pub project_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedProject {
    pub id: String,
    pub name: String,
    pub project_key: String,
    pub allowed_origins: Vec<String>,
    pub archived_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, FromRow)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub allowed_origins: String,
    pub archived_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub allowed_origins: Vec<String>,
    pub archived_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl TryFrom<ProjectRow> for Project {
    type Error = serde_json::Error;

    fn try_from(row: ProjectRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.id,
            name: row.name,
            allowed_origins: serde_json::from_str(&row.allowed_origins)?,
            archived_at: row.archived_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

pub struct NewProject {
    pub id: String,
    pub name: String,
    pub project_key_hash: String,
    pub allowed_origins: String,
    pub created_at: String,
    pub updated_at: String,
}
