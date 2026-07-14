use std::time::Duration;

use axum::{
    Json, Router,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    middleware,
    routing::{get, post},
};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use rustzen_config::RETENTION_DAYS;
use rustzen_storage::{SqliteMaintenancePlan, run_sqlite_maintenance};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, SqlitePool};
use uuid::Uuid;

use crate::{
    infra::config::CONFIG,
    workers::common::{health, map_worker_error, require_capability, require_ipc},
};

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations/insights");

#[derive(Clone)]
struct InsightsState {
    pool: SqlitePool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateProjectInput {
    name: String,
    #[serde(default)]
    allowed_origins: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreatedProject {
    id: String,
    name: String,
    project_key: String,
    allowed_origins: Vec<String>,
}

#[derive(Debug, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRow {
    id: String,
    name: String,
    allowed_origins: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrackInput {
    project_key: String,
    origin: Option<String>,
    event_type: EventType,
    visitor_id: String,
    path: String,
    duration_ms: Option<u64>,
    #[serde(default)]
    is_error: bool,
    occurred_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum EventType {
    PageView,
    ApiRequest,
}

impl EventType {
    fn as_str(&self) -> &'static str {
        match self {
            Self::PageView => "page_view",
            Self::ApiRequest => "api_request",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OverviewQuery {
    project_id: String,
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Overview {
    pv: i64,
    uv: i64,
    request_count: i64,
    error_count: i64,
    average_duration_ms: f64,
    p95_duration_ms: u64,
}

pub async fn run_worker() -> Result<(), Box<dyn std::error::Error>> {
    let pool = crate::infra::db::create_pool_for_path(&CONFIG.insights_database_path()).await?;
    MIGRATOR.run(&pool).await?;
    crate::infra::db::test_connection(&pool).await?;
    spawn_retention(pool.clone());
    let protected = Router::new()
        .route("/ipc/v1/insights/projects", get(list_projects).post(create_project))
        .route("/ipc/v1/insights/track", post(track))
        .route("/ipc/v1/insights/overview", get(overview))
        .route_layer(middleware::from_fn(require_ipc));
    let app = Router::new()
        .route("/health", get(health))
        .merge(protected)
        .with_state(InsightsState { pool });
    let address = format!("{}:{}", CONFIG.worker_host, CONFIG.insights_port);
    let listener = tokio::net::TcpListener::bind(&address).await?;
    tracing::info!(%address, "Insights Worker started");
    axum::serve(listener, app).await.map_err(map_worker_error)
}

async fn create_project(
    State(state): State<InsightsState>,
    headers: HeaderMap,
    Json(input): Json<CreateProjectInput>,
) -> Result<Json<CreatedProject>, (StatusCode, String)> {
    require_capability(&headers, "insights:manage")?;
    let name = input.name.trim();
    if name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "name is required".to_string()));
    }
    let id = Uuid::new_v4().to_string();
    let project_key = format!("rzpk_{}", Uuid::new_v4().simple());
    let allowed_origins = normalize_origins(input.allowed_origins);
    let origins_json = serde_json::to_string(&allowed_origins).map_err(internal_error)?;
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO insights_projects
         (id, name, project_key_hash, allowed_origins, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(name)
    .bind(hash_key(&project_key))
    .bind(&origins_json)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(internal_error)?;
    Ok(Json(CreatedProject { id, name: name.to_string(), project_key, allowed_origins }))
}

async fn list_projects(
    State(state): State<InsightsState>,
    headers: HeaderMap,
) -> Result<Json<Vec<ProjectRow>>, (StatusCode, String)> {
    require_capability(&headers, "insights:view")?;
    let rows = sqlx::query_as(
        "SELECT id, name, allowed_origins, created_at
         FROM insights_projects ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;
    Ok(Json(rows))
}

async fn track(
    State(state): State<InsightsState>,
    headers: HeaderMap,
    Json(input): Json<TrackInput>,
) -> Result<StatusCode, (StatusCode, String)> {
    require_capability(&headers, "insights:track")?;
    if input.visitor_id.trim().is_empty() || input.path.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "visitorId and path are required".to_string()));
    }
    let project = sqlx::query_as::<_, (String, String)>(
        "SELECT id, allowed_origins FROM insights_projects WHERE project_key_hash = ?",
    )
    .bind(hash_key(&input.project_key))
    .fetch_optional(&state.pool)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| (StatusCode::UNAUTHORIZED, "invalid project key".to_string()))?;
    let allowed_origins: Vec<String> = serde_json::from_str(&project.1).map_err(internal_error)?;
    if !origin_allowed(&allowed_origins, input.origin.as_deref()) {
        return Err((StatusCode::FORBIDDEN, "origin is not allowed".to_string()));
    }
    sqlx::query(
        "INSERT INTO insights_events
         (project_id, event_type, visitor_id, path, duration_ms, is_error, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(project.0)
    .bind(input.event_type.as_str())
    .bind(input.visitor_id.trim())
    .bind(input.path.trim())
    .bind(input.duration_ms.map(to_i64))
    .bind(if input.is_error { 1_i64 } else { 0_i64 })
    .bind(input.occurred_at.unwrap_or_else(Utc::now).to_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(internal_error)?;
    Ok(StatusCode::ACCEPTED)
}

async fn overview(
    State(state): State<InsightsState>,
    headers: HeaderMap,
    Query(query): Query<OverviewQuery>,
) -> Result<Json<Overview>, (StatusCode, String)> {
    require_capability(&headers, "insights:view")?;
    let from = query.from.unwrap_or_else(|| Utc::now() - ChronoDuration::days(30));
    let to = query.to.unwrap_or_else(Utc::now);
    if from > to {
        return Err((StatusCode::BAD_REQUEST, "from must be before to".to_string()));
    }
    let (pv, uv, request_count, error_count, average_duration_ms): (i64, i64, i64, i64, f64) =
        sqlx::query_as(
            "SELECT
           COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0),
           COUNT(DISTINCT visitor_id),
           COALESCE(SUM(CASE WHEN event_type = 'api_request' THEN 1 ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END), 0),
           COALESCE(AVG(CASE WHEN event_type = 'api_request' THEN duration_ms END), 0)
         FROM insights_events
         WHERE project_id = ? AND occurred_at >= ? AND occurred_at <= ?",
        )
        .bind(&query.project_id)
        .bind(from.to_rfc3339())
        .bind(to.to_rfc3339())
        .fetch_one(&state.pool)
        .await
        .map_err(internal_error)?;
    let durations: Vec<i64> = sqlx::query_scalar(
        "SELECT duration_ms FROM insights_events
         WHERE project_id = ? AND event_type = 'api_request'
           AND duration_ms IS NOT NULL AND occurred_at >= ? AND occurred_at <= ?
         ORDER BY duration_ms ASC",
    )
    .bind(&query.project_id)
    .bind(from.to_rfc3339())
    .bind(to.to_rfc3339())
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;
    Ok(Json(Overview {
        pv,
        uv,
        request_count,
        error_count,
        average_duration_ms,
        p95_duration_ms: percentile_95(&durations),
    }))
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

fn origin_allowed(allowed: &[String], origin: Option<&str>) -> bool {
    if allowed.is_empty() {
        return origin.is_none();
    }
    origin
        .map(|origin| origin.trim().trim_end_matches('/').to_ascii_lowercase())
        .is_some_and(|origin| allowed.iter().any(|allowed| allowed == &origin))
}

fn hash_key(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}

fn percentile_95(sorted: &[i64]) -> u64 {
    if sorted.is_empty() {
        return 0;
    }
    let index = ((sorted.len() * 95).div_ceil(100)).saturating_sub(1);
    u64::try_from(sorted[index]).unwrap_or(0)
}

fn spawn_retention(pool: SqlitePool) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;
            let cutoff = (Utc::now() - ChronoDuration::days(RETENTION_DAYS as i64)).to_rfc3339();
            match delete_events_before(&pool, &cutoff).await {
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

async fn delete_events_before(pool: &SqlitePool, cutoff: &str) -> Result<u64, sqlx::Error> {
    sqlx::query("DELETE FROM insights_events WHERE occurred_at < ?")
        .bind(cutoff)
        .execute(pool)
        .await
        .map(|result| result.rows_affected())
}

fn to_i64(value: u64) -> i64 {
    i64::try_from(value).unwrap_or(i64::MAX)
}

fn internal_error(error: impl std::fmt::Display) -> (StatusCode, String) {
    tracing::error!(%error, "Insights worker request failed");
    (StatusCode::INTERNAL_SERVER_ERROR, "insights worker error".to_string())
}

#[cfg(test)]
mod tests {
    use super::{MIGRATOR, delete_events_before, origin_allowed, percentile_95};
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn fresh_insights_database_migrates() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect");
        MIGRATOR.run(&pool).await.expect("migrate");
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM insights_projects")
            .fetch_one(&pool)
            .await
            .expect("count");
        assert_eq!(count, 0);
    }

    #[test]
    fn origin_and_percentile_contracts_are_conservative() {
        assert!(origin_allowed(&[], None));
        assert!(!origin_allowed(&[], Some("https://example.com")));
        assert!(origin_allowed(&["https://example.com".to_string()], Some("https://example.com/")));
        assert_eq!(percentile_95(&[10, 20, 30, 40, 50]), 50);
    }

    #[tokio::test]
    async fn retention_deletes_only_events_older_than_thirty_days() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect");
        MIGRATOR.run(&pool).await.expect("migrate");
        sqlx::query(
            "INSERT INTO insights_projects
             (id, name, project_key_hash, allowed_origins, created_at, updated_at)
             VALUES ('project', 'Project', 'hash', '[]',
                     '2026-07-14T00:00:00Z', '2026-07-14T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .expect("project");
        for occurred_at in ["2026-06-13T00:00:00Z", "2026-06-14T00:00:00Z"] {
            sqlx::query(
                "INSERT INTO insights_events
                 (project_id, event_type, visitor_id, path, is_error, occurred_at)
                 VALUES ('project', 'page_view', 'visitor', '/', 0, ?)",
            )
            .bind(occurred_at)
            .execute(&pool)
            .await
            .expect("event");
        }

        assert_eq!(delete_events_before(&pool, "2026-06-14T00:00:00Z").await.expect("cleanup"), 1);
        let remaining: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM insights_events")
            .fetch_one(&pool)
            .await
            .expect("remaining");
        assert_eq!(remaining, 1);
    }
}
