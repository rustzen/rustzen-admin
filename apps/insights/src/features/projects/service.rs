use chrono::Utc;
use rustzen_storage::SqlitePool;
use uuid::Uuid;

use crate::common::{error::AppError, project_key};

use super::{
    repo,
    types::{
        CreateProjectInput, CreatedProject, NewProject, Project, ProjectKey, UpdateProjectInput,
    },
};

pub struct ProjectsService;

impl ProjectsService {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<Project>, AppError> {
        repo::list(pool)
            .await?
            .into_iter()
            .map(Project::try_from)
            .collect::<Result<_, _>>()
            .map_err(AppError::internal)
    }

    pub async fn get(pool: &SqlitePool, id: &str) -> Result<Project, AppError> {
        repo::get(pool, id)
            .await?
            .ok_or_else(|| AppError::not_found("project"))?
            .try_into()
            .map_err(AppError::internal)
    }

    pub async fn create(
        pool: &SqlitePool,
        input: CreateProjectInput,
    ) -> Result<CreatedProject, AppError> {
        let (name, allowed_origins) = validate(input.name, input.allowed_origins)?;
        let id = Uuid::new_v4().to_string();
        let project_key = new_key();
        let origins_json = serde_json::to_string(&allowed_origins).map_err(AppError::internal)?;
        let now = Utc::now().to_rfc3339();
        repo::insert(
            pool,
            &NewProject {
                id: id.clone(),
                name: name.clone(),
                project_key_hash: project_key::hash(&project_key),
                allowed_origins: origins_json,
                created_at: now.clone(),
                updated_at: now.clone(),
            },
        )
        .await?;
        Ok(CreatedProject {
            id,
            name,
            project_key,
            allowed_origins,
            archived_at: None,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        input: UpdateProjectInput,
    ) -> Result<Project, AppError> {
        let (name, origins) = validate(input.name, input.allowed_origins)?;
        let origins = serde_json::to_string(&origins).map_err(AppError::internal)?;
        if !repo::update(pool, id, &name, &origins, &Utc::now().to_rfc3339()).await? {
            return Err(AppError::not_found("active project"));
        }
        Self::get(pool, id).await
    }

    pub async fn rotate_key(pool: &SqlitePool, id: &str) -> Result<ProjectKey, AppError> {
        let key = new_key();
        if !repo::rotate_key(pool, id, &project_key::hash(&key), &Utc::now().to_rfc3339()).await? {
            return Err(AppError::not_found("active project"));
        }
        Ok(ProjectKey { project_key: key })
    }

    pub async fn archive(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
        if !repo::archive(pool, id, &Utc::now().to_rfc3339()).await? {
            return Err(AppError::not_found("active project"));
        }
        Ok(())
    }
}

fn new_key() -> String {
    format!("rzpk_{}", Uuid::new_v4().simple())
}

fn validate(name: String, origins: Vec<String>) -> Result<(String, Vec<String>), AppError> {
    let name = name.trim().to_string();
    if name.is_empty() || name.len() > 100 {
        return Err(AppError::bad_request("name must contain 1 to 100 characters"));
    }
    Ok((name, normalize_origins(origins)?))
}

fn normalize_origins(origins: Vec<String>) -> Result<Vec<String>, AppError> {
    let mut values = Vec::with_capacity(origins.len());
    for origin in origins {
        let origin = origin.trim().trim_end_matches('/').to_ascii_lowercase();
        if origin.is_empty() {
            continue;
        }
        let valid = origin
            .strip_prefix("http://")
            .or_else(|| origin.strip_prefix("https://"))
            .is_some_and(|host| !host.is_empty() && !host.contains('/'));
        if !valid {
            return Err(AppError::bad_request("allowed origins must be HTTP/HTTPS origins"));
        }
        values.push(origin);
    }
    values.sort();
    values.dedup();
    Ok(values)
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
            ])
            .expect("origins"),
            vec!["https://example.com"]
        );
        assert!(normalize_origins(vec!["example.com".to_string()]).is_err());
    }
}
