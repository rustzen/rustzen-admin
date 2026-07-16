use chrono::Utc;
use rustzen_storage::SqlitePool;
use uuid::Uuid;

use crate::common::{error::AppError, project_key};

use super::{
    repo,
    types::{CreateProjectInput, CreatedProject, NewProject, ProjectRow},
};

pub struct ProjectsService;

impl ProjectsService {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<ProjectRow>, AppError> {
        repo::list(pool).await.map_err(AppError::internal)
    }

    pub async fn create(
        pool: &SqlitePool,
        input: CreateProjectInput,
    ) -> Result<CreatedProject, AppError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(AppError::bad_request("name is required"));
        }

        let id = Uuid::new_v4().to_string();
        let project_key = format!("rzpk_{}", Uuid::new_v4().simple());
        let allowed_origins = normalize_origins(input.allowed_origins);
        let origins_json = serde_json::to_string(&allowed_origins).map_err(AppError::internal)?;
        let now = Utc::now().to_rfc3339();
        let project = NewProject {
            id: id.clone(),
            name: name.to_string(),
            project_key_hash: project_key::hash(&project_key),
            allowed_origins: origins_json,
            created_at: now.clone(),
            updated_at: now,
        };

        let mut transaction = pool.begin().await.map_err(AppError::internal)?;
        repo::insert(&mut transaction, &project).await.map_err(AppError::internal)?;
        transaction.commit().await.map_err(AppError::internal)?;

        Ok(CreatedProject { id, name: name.to_string(), project_key, allowed_origins })
    }
}

fn normalize_origins(origins: Vec<String>) -> Vec<String> {
    let mut values = origins
        .into_iter()
        .map(|origin| origin.trim().trim_end_matches('/').to_ascii_lowercase())
        .filter(|origin| !origin.is_empty())
        .collect::<Vec<_>>();
    values.sort();
    values.dedup();
    values
}

#[cfg(test)]
mod tests {
    use super::normalize_origins;

    #[test]
    fn origin_normalization_preserves_exact_allowlist_semantics() {
        assert_eq!(
            normalize_origins(vec![
                " HTTPS://EXAMPLE.COM/ ".to_string(),
                "https://example.com".to_string(),
                "".to_string(),
            ]),
            vec!["https://example.com"]
        );
    }
}
