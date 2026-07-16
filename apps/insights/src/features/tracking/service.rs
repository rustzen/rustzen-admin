use std::time::Duration;

use chrono::{Duration as ChronoDuration, Utc};
use rustzen_config::RETENTION_DAYS;
use rustzen_storage::{SqliteMaintenancePlan, SqlitePool, run_sqlite_maintenance};

use crate::common::{error::AppError, project_key};

use super::{
    repo,
    types::{DomainCredentials, NewEvent, TrackInput},
};

pub struct TrackingService;

impl TrackingService {
    pub async fn track(
        pool: &SqlitePool,
        input: TrackInput,
        credentials: DomainCredentials,
    ) -> Result<(), AppError> {
        let project_key = credentials
            .project_key
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| AppError::unauthorized("project key is required"))?;
        let visitor_id = input.visitor_id.trim();
        let path = input.path.trim();
        if visitor_id.is_empty() || path.is_empty() {
            return Err(AppError::bad_request("visitorId and path are required"));
        }

        let mut transaction = pool.begin().await.map_err(AppError::internal)?;
        let project = repo::find_project_by_key(&mut transaction, &project_key::hash(project_key))
            .await
            .map_err(AppError::internal)?
            .ok_or_else(|| AppError::unauthorized("invalid project key"))?;
        let allowed_origins: Vec<String> =
            serde_json::from_str(&project.allowed_origins).map_err(AppError::internal)?;
        if !origin_allowed(&allowed_origins, credentials.origin.as_deref()) {
            return Err(AppError::forbidden("origin is not allowed"));
        }

        let event = NewEvent {
            project_id: project.id,
            event_type: input.event_type.as_str(),
            visitor_id,
            path,
            duration_ms: input.duration_ms.map(to_i64),
            is_error: i64::from(input.is_error),
            occurred_at: input.occurred_at.unwrap_or_else(Utc::now).to_rfc3339(),
        };
        repo::insert_event(&mut transaction, &event).await.map_err(AppError::internal)?;
        transaction.commit().await.map_err(AppError::internal)?;
        Ok(())
    }
}

pub fn spawn_retention(pool: SqlitePool) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;
            let cutoff = (Utc::now() - ChronoDuration::days(RETENTION_DAYS as i64)).to_rfc3339();
            match cleanup_before(&pool, &cutoff).await {
                Ok(0) => {}
                Ok(deleted) => {
                    tracing::info!(deleted, "Insights retention completed");
                    if let Err(error) =
                        run_sqlite_maintenance(&pool, SqliteMaintenancePlan::reclaim()).await
                    {
                        tracing::error!(%error, "Insights SQLite maintenance failed");
                    }
                }
                Err(error) => tracing::error!(%error, "Insights retention failed"),
            }
        }
    });
}

async fn cleanup_before(pool: &SqlitePool, cutoff: &str) -> Result<u64, AppError> {
    let mut transaction = pool.begin().await.map_err(AppError::internal)?;
    let deleted =
        repo::delete_events_before(&mut transaction, cutoff).await.map_err(AppError::internal)?;
    transaction.commit().await.map_err(AppError::internal)?;
    Ok(deleted)
}

fn origin_allowed(allowed: &[String], origin: Option<&str>) -> bool {
    if allowed.is_empty() {
        return origin.is_none();
    }
    origin
        .map(|origin| origin.trim().trim_end_matches('/').to_ascii_lowercase())
        .is_some_and(|origin| allowed.iter().any(|allowed| allowed == &origin))
}

fn to_i64(value: u64) -> i64 {
    i64::try_from(value).unwrap_or(i64::MAX)
}

#[cfg(test)]
mod tests {
    use chrono::{TimeZone, Utc};
    use sqlx::sqlite::SqlitePoolOptions;

    use crate::{
        features::{
            projects::{service::ProjectsService, types::CreateProjectInput},
            tracking::types::{DomainCredentials, EventType, TrackInput},
        },
        infra::db,
    };

    use super::{TrackingService, cleanup_before, origin_allowed};

    #[test]
    fn origin_contract_remains_exact_and_conservative() {
        assert!(origin_allowed(&[], None));
        assert!(!origin_allowed(&[], Some("https://example.com")));
        assert!(origin_allowed(&["https://example.com".to_string()], Some("https://example.com/")));
        assert!(!origin_allowed(
            &["https://example.com".to_string()],
            Some("https://sub.example.com")
        ));
    }

    #[tokio::test]
    async fn retention_deletes_only_events_before_cutoff() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect");
        db::migrate(&pool).await.expect("migrate");
        let project = ProjectsService::create(
            &pool,
            CreateProjectInput { name: "Project".to_string(), allowed_origins: Vec::new() },
        )
        .await
        .expect("project");

        for occurred_at in [
            Utc.with_ymd_and_hms(2026, 6, 13, 0, 0, 0).single().expect("date"),
            Utc.with_ymd_and_hms(2026, 6, 14, 0, 0, 0).single().expect("date"),
        ] {
            TrackingService::track(
                &pool,
                TrackInput {
                    event_type: EventType::PageView,
                    visitor_id: "visitor".to_string(),
                    path: "/".to_string(),
                    duration_ms: None,
                    is_error: false,
                    occurred_at: Some(occurred_at),
                },
                DomainCredentials { project_key: Some(project.project_key.clone()), origin: None },
            )
            .await
            .expect("track");
        }

        assert_eq!(cleanup_before(&pool, "2026-06-14T00:00:00+00:00").await.expect("cleanup"), 1);
    }
}
