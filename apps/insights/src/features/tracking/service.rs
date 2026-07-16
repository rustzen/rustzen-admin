use std::time::Duration;

use chrono::{Duration as ChronoDuration, Utc};
use rustzen_storage::{SqliteMaintenancePlan, SqlitePool, run_sqlite_maintenance};

use crate::common::{error::AppError, project_key};

use super::{
    repo,
    types::{DomainCredentials, NewEvent, TrackAccepted, TrackInput},
};

pub struct TrackingService;

impl TrackingService {
    pub async fn track(
        pool: &SqlitePool,
        inputs: Vec<TrackInput>,
        credentials: DomainCredentials,
    ) -> Result<TrackAccepted, AppError> {
        let settings = crate::features::settings::service::get(pool).await?;
        if inputs.is_empty() || inputs.len() > settings.max_batch_events as usize {
            return Err(AppError::bad_request(format!(
                "batch must contain 1 to {} events",
                settings.max_batch_events
            )));
        }
        let now = Utc::now();
        let events = inputs
            .into_iter()
            .map(|input| validate_event(input, &now))
            .collect::<Result<Vec<_>, _>>()?;

        let mut transaction = pool.begin().await.map_err(AppError::internal)?;
        let project = repo::find_project_by_key(
            &mut transaction,
            &project_key::hash(credentials.project_key.trim()),
        )
        .await?
        .ok_or_else(|| AppError::unauthorized("invalid project key"))?;
        let allowed_origins: Vec<String> = serde_json::from_str(&project.allowed_origins)?;
        if !origin_allowed(&allowed_origins, credentials.origin.as_deref()) {
            return Err(AppError::forbidden("origin is not allowed"));
        }

        let accepted = events.len();
        for mut event in events {
            event.project_id.clone_from(&project.id);
            repo::insert_event(&mut transaction, &event).await?;
        }
        transaction.commit().await.map_err(AppError::internal)?;
        Ok(TrackAccepted { accepted })
    }
}

pub fn spawn_retention(pool: SqlitePool) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;
            let result = async {
                let settings = crate::features::settings::service::get(&pool).await?;
                let cutoff =
                    (Utc::now() - ChronoDuration::days(settings.event_retention_days)).to_rfc3339();
                cleanup_before(&pool, &cutoff).await
            }
            .await;
            match result {
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
    let deleted = repo::delete_events_before(&mut transaction, cutoff).await?;
    transaction.commit().await.map_err(AppError::internal)?;
    Ok(deleted)
}

fn validate_event(
    input: TrackInput,
    received_at: &chrono::DateTime<Utc>,
) -> Result<NewEvent, AppError> {
    let event_name = input
        .event_name
        .or(input.event_type)
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty() && value.len() <= 100)
        .ok_or_else(|| AppError::bad_request("eventName is required"))?;
    let visitor_id = required(input.visitor_id, "visitorId", 200)?;
    if !input.properties.is_object() {
        return Err(AppError::bad_request("properties must be an object"));
    }
    let legacy_path = clean_optional(input.path, 2000)?;
    let mut page_path = clean_optional(input.page_path, 2000)?;
    let mut api_path = clean_optional(input.api_path, 2000)?;
    if event_name == "page_view" && page_path.is_none() {
        page_path = legacy_path.clone();
    }
    if event_name == "api_request" && api_path.is_none() {
        api_path = legacy_path;
    }
    if event_name == "page_view" && page_path.is_none() {
        return Err(AppError::bad_request("pagePath is required for page_view"));
    }
    if event_name == "api_request" && api_path.is_none() {
        return Err(AppError::bad_request("apiPath is required for api_request"));
    }
    let properties = serde_json::to_string(&input.properties).map_err(AppError::internal)?;
    if properties.len() > 16_384 {
        return Err(AppError::bad_request("properties exceed 16 KiB"));
    }
    Ok(NewEvent {
        project_id: String::new(),
        event_name,
        visitor_id,
        user_id: clean_optional(input.user_id, 200)?,
        session_id: clean_optional(input.session_id, 200)?,
        platform: clean_optional(input.platform, 50)?,
        page_path,
        referrer: clean_optional(input.referrer, 2000)?,
        api_path,
        api_method: clean_optional(input.api_method, 20)?.map(|value| value.to_ascii_uppercase()),
        status_code: input.status_code,
        duration_ms: input.duration_ms.map(to_i64),
        is_error: i64::from(input.is_error),
        properties,
        occurred_at: input.occurred_at.unwrap_or(*received_at).to_rfc3339(),
        received_at: received_at.to_rfc3339(),
    })
}

fn required(value: String, name: &str, max: usize) -> Result<String, AppError> {
    clean_optional(Some(value), max)?
        .ok_or_else(|| AppError::bad_request(format!("{name} is required")))
}

fn clean_optional(value: Option<String>, max: usize) -> Result<Option<String>, AppError> {
    value
        .map(|value| {
            let value = value.trim().to_string();
            if value.len() > max {
                Err(AppError::bad_request("event field is too long"))
            } else if value.is_empty() {
                Ok(None)
            } else {
                Ok(Some(value))
            }
        })
        .transpose()
        .map(Option::flatten)
}

fn origin_allowed(allowed: &[String], origin: Option<&str>) -> bool {
    if allowed.is_empty() {
        return true;
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
    use super::origin_allowed;

    #[test]
    fn origin_contract_allows_unrestricted_projects_and_exact_allowlists() {
        assert!(origin_allowed(&[], None));
        assert!(origin_allowed(&[], Some("https://example.com")));
        assert!(origin_allowed(&["https://example.com".to_string()], Some("https://example.com/")));
        assert!(!origin_allowed(
            &["https://example.com".to_string()],
            Some("https://sub.example.com")
        ));
    }
}
