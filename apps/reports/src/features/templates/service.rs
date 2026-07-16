use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::common::error::AppError;

use super::{
    repo::TemplatesRepository,
    types::{SaveTemplateInput, Template},
};

#[derive(Clone)]
pub struct TemplatesService {
    repo: TemplatesRepository,
}

impl TemplatesService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { repo: TemplatesRepository::new(pool) }
    }

    pub async fn list(&self) -> Result<Vec<Template>, AppError> {
        self.repo.list().await
    }

    pub async fn save(&self, input: SaveTemplateInput) -> Result<Template, AppError> {
        let SaveTemplateInput { id, name, content } = input;
        let name = name.trim();
        let content = content.trim();
        if name.is_empty() || content.is_empty() {
            return Err(AppError::InvalidInput("name and content are required".to_string()));
        }
        let id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
        self.repo.save(&id, name, content, &Utc::now().to_rfc3339()).await
    }

    pub async fn find_for_job(&self, id: &str) -> Result<Template, AppError> {
        self.repo
            .find(id)
            .await?
            .ok_or_else(|| AppError::NotFound("template not found".to_string()))
    }
}
