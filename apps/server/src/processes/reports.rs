use std::{collections::BTreeMap, path::PathBuf, time::Duration};

use axum::{
    Json, Router,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, StatusCode, header},
    middleware,
    response::Response,
    routing::get,
};
use chrono::{Duration as ChronoDuration, Utc};
use rustzen_config::RETENTION_DAYS;
use rustzen_storage::{SqliteMaintenancePlan, run_sqlite_maintenance};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, SqlitePool};
use uuid::Uuid;

use crate::{
    infra::config::CONFIG,
    processes::common::{health, map_worker_error, require_capability, require_ipc},
};

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations/reports");

#[derive(Clone)]
struct ReportsState {
    pool: SqlitePool,
    output_dir: PathBuf,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveTemplateInput {
    id: Option<String>,
    name: String,
    content: String,
}

#[derive(Debug, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
struct TemplateRow {
    id: String,
    name: String,
    content: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateJobInput {
    template_id: String,
    #[serde(default)]
    data: BTreeMap<String, Value>,
}

#[derive(Debug, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobRow {
    id: String,
    template_id: String,
    status: String,
    input_json: String,
    output_file: Option<String>,
    error: Option<String>,
    created_at: String,
    started_at: Option<String>,
    finished_at: Option<String>,
    expires_at: String,
}

pub async fn run_worker() -> Result<(), Box<dyn std::error::Error>> {
    let pool = crate::infra::db::create_pool_for_path(&CONFIG.reports_database_path()).await?;
    MIGRATOR.run(&pool).await?;
    crate::infra::db::test_connection(&pool).await?;
    let output_dir = CONFIG.data_dir().join("reports");
    tokio::fs::create_dir_all(&output_dir).await?;
    recover_interrupted_jobs(&pool).await?;
    spawn_retention(pool.clone(), output_dir.clone());

    let protected = Router::new()
        .route("/ipc/v1/reports/templates", get(list_templates).post(save_template))
        .route("/ipc/v1/reports/jobs", get(list_jobs).post(create_job))
        .route("/ipc/v1/reports/jobs/{job_id}", get(get_job))
        .route("/ipc/v1/reports/jobs/{job_id}/download", get(download_job))
        .route_layer(middleware::from_fn(require_ipc));
    let app = Router::new()
        .route("/health", get(health))
        .merge(protected)
        .with_state(ReportsState { pool, output_dir });
    let address = format!("{}:{}", CONFIG.worker_host, CONFIG.reports_port);
    let listener = tokio::net::TcpListener::bind(&address).await?;
    tracing::info!(%address, "Reports Worker started");
    axum::serve(listener, app).await.map_err(map_worker_error)
}

async fn save_template(
    State(state): State<ReportsState>,
    headers: HeaderMap,
    Json(input): Json<SaveTemplateInput>,
) -> Result<Json<TemplateRow>, (StatusCode, String)> {
    require_capability(&headers, "reports:manage")?;
    let name = input.name.trim();
    let content = input.content.trim();
    if name.is_empty() || content.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "name and content are required".to_string()));
    }
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO report_templates (id, name, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, content = excluded.content, updated_at = excluded.updated_at",
    )
    .bind(&id)
    .bind(name)
    .bind(content)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(internal_error)?;
    get_template(&state.pool, &id).await.map(Json).map_err(internal_error)
}

async fn list_templates(
    State(state): State<ReportsState>,
    headers: HeaderMap,
) -> Result<Json<Vec<TemplateRow>>, (StatusCode, String)> {
    require_capability(&headers, "reports:view")?;
    sqlx::query_as("SELECT id, name, content, created_at, updated_at FROM report_templates ORDER BY updated_at DESC")
        .fetch_all(&state.pool)
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn create_job(
    State(state): State<ReportsState>,
    headers: HeaderMap,
    Json(input): Json<CreateJobInput>,
) -> Result<(StatusCode, Json<JobRow>), (StatusCode, String)> {
    require_capability(&headers, "reports:manage")?;
    let template =
        get_template(&state.pool, &input.template_id).await.map_err(|error| match error {
            sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "template not found".to_string()),
            other => internal_error(other),
        })?;
    let id = Uuid::new_v4().to_string();
    let output_file = format!("{id}.html");
    let now = Utc::now();
    let input_json = serde_json::to_string(&input.data).map_err(internal_error)?;
    sqlx::query(
        "INSERT INTO report_jobs
         (id, template_id, status, input_json, created_at, expires_at)
         VALUES (?, ?, 'queued', ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.template_id)
    .bind(&input_json)
    .bind(now.to_rfc3339())
    .bind((now + ChronoDuration::days(RETENTION_DAYS as i64)).to_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(internal_error)?;

    let started_at = Utc::now().to_rfc3339();
    sqlx::query("UPDATE report_jobs SET status = 'running', started_at = ? WHERE id = ?")
        .bind(&started_at)
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(internal_error)?;
    let rendered = render_template(&template.content, &input.data);
    let output_path = state.output_dir.join(&output_file);
    let finished_at = Utc::now().to_rfc3339();
    match tokio::fs::write(&output_path, rendered).await {
        Ok(()) => {
            sqlx::query(
                "UPDATE report_jobs SET status = 'succeeded', output_file = ?, finished_at = ? WHERE id = ?",
            )
            .bind(&output_file)
            .bind(&finished_at)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(internal_error)?;
        }
        Err(error) => {
            sqlx::query(
                "UPDATE report_jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?",
            )
            .bind(error.to_string())
            .bind(&finished_at)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(internal_error)?;
        }
    }
    let job = get_job_row(&state.pool, &id).await.map_err(internal_error)?;
    Ok((StatusCode::CREATED, Json(job)))
}

async fn list_jobs(
    State(state): State<ReportsState>,
    headers: HeaderMap,
) -> Result<Json<Vec<JobRow>>, (StatusCode, String)> {
    require_capability(&headers, "reports:view")?;
    sqlx::query_as(
        "SELECT id, template_id, status, input_json, output_file, error,
                created_at, started_at, finished_at, expires_at
         FROM report_jobs ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map(Json)
    .map_err(internal_error)
}

async fn get_job(
    State(state): State<ReportsState>,
    Path(job_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<JobRow>, (StatusCode, String)> {
    require_capability(&headers, "reports:view")?;
    get_job_row(&state.pool, &job_id).await.map(Json).map_err(not_found_or_internal)
}

async fn download_job(
    State(state): State<ReportsState>,
    Path(job_id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, (StatusCode, String)> {
    require_capability(&headers, "reports:view")?;
    let job = get_job_row(&state.pool, &job_id).await.map_err(not_found_or_internal)?;
    if job.status != "succeeded" {
        return Err((StatusCode::CONFLICT, "report is not ready".to_string()));
    }
    let file_name = job
        .output_file
        .filter(|value| is_safe_file_name(value))
        .ok_or_else(|| (StatusCode::NOT_FOUND, "report output not found".to_string()))?;
    let bytes = tokio::fs::read(state.output_dir.join(&file_name)).await.map_err(|error| {
        tracing::error!(%error, %job_id, "Report output read failed");
        (StatusCode::NOT_FOUND, "report output not found".to_string())
    })?;
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{file_name}\""))
        .body(Body::from(bytes))
        .map_err(internal_error)
}

async fn get_template(pool: &SqlitePool, id: &str) -> Result<TemplateRow, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, name, content, created_at, updated_at FROM report_templates WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
}

async fn get_job_row(pool: &SqlitePool, id: &str) -> Result<JobRow, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, template_id, status, input_json, output_file, error,
                created_at, started_at, finished_at, expires_at
         FROM report_jobs WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
}

fn render_template(content: &str, data: &BTreeMap<String, Value>) -> String {
    data.iter().fold(content.to_string(), |rendered, (key, value)| {
        let replacement =
            value.as_str().map(ToOwned::to_owned).unwrap_or_else(|| value.to_string());
        rendered.replace(&format!("{{{{{key}}}}}"), &escape_html(&replacement))
    })
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn is_safe_file_name(value: &str) -> bool {
    !value.is_empty()
        && !value.contains('/')
        && !value.contains('\\')
        && value != "."
        && value != ".."
}

async fn recover_interrupted_jobs(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE report_jobs
         SET status = 'failed', error = 'reports worker restarted', finished_at = ?
         WHERE status IN ('queued', 'running')",
    )
    .bind(Utc::now().to_rfc3339())
    .execute(pool)
    .await?;
    Ok(())
}

fn spawn_retention(pool: SqlitePool, output_dir: PathBuf) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;
            let now = Utc::now().to_rfc3339();
            match cleanup_expired_reports(&pool, &output_dir, &now).await {
                Ok(0) => {}
                Ok(deleted) => {
                    tracing::info!(deleted, "Report retention cleanup completed");
                    if let Err(error) =
                        run_sqlite_maintenance(&pool, SqliteMaintenancePlan::reclaim()).await
                    {
                        tracing::error!(%error, "Reports SQLite maintenance failed");
                    }
                }
                Err(error) => tracing::error!(%error, "Report retention cleanup failed"),
            }
        }
    });
}

async fn cleanup_expired_reports(
    pool: &SqlitePool,
    output_dir: &std::path::Path,
    now: &str,
) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    let files: Vec<Option<String>> =
        sqlx::query_scalar("SELECT output_file FROM report_jobs WHERE expires_at < ?")
            .bind(now)
            .fetch_all(pool)
            .await?;
    for file_name in files.into_iter().flatten().filter(|name| is_safe_file_name(name)) {
        if let Err(error) = tokio::fs::remove_file(output_dir.join(file_name)).await
            && error.kind() != std::io::ErrorKind::NotFound
        {
            return Err(error.into());
        }
    }
    Ok(sqlx::query("DELETE FROM report_jobs WHERE expires_at < ?")
        .bind(now)
        .execute(pool)
        .await?
        .rows_affected())
}

fn not_found_or_internal(error: sqlx::Error) -> (StatusCode, String) {
    match error {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "report job not found".to_string()),
        other => internal_error(other),
    }
}

fn internal_error(error: impl std::fmt::Display) -> (StatusCode, String) {
    tracing::error!(%error, "Reports worker request failed");
    (StatusCode::INTERNAL_SERVER_ERROR, "reports worker error".to_string())
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use serde_json::json;
    use sqlx::sqlite::SqlitePoolOptions;

    use super::{MIGRATOR, cleanup_expired_reports, escape_html, render_template};

    #[tokio::test]
    async fn fresh_reports_database_migrates() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect");
        MIGRATOR.run(&pool).await.expect("migrate");
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM report_templates")
            .fetch_one(&pool)
            .await
            .expect("count");
        assert_eq!(count, 0);
    }

    #[test]
    fn template_values_are_html_escaped() {
        let data = BTreeMap::from([("name".to_string(), json!("<RustZen>"))]);
        assert_eq!(render_template("<h1>{{name}}</h1>", &data), "<h1>&lt;RustZen&gt;</h1>");
        assert_eq!(escape_html("'&\""), "&#39;&amp;&quot;");
    }

    #[tokio::test]
    async fn retention_deletes_only_expired_jobs_and_outputs() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect");
        MIGRATOR.run(&pool).await.expect("migrate");
        sqlx::query(
            "INSERT INTO report_templates (id, name, content, created_at, updated_at)
             VALUES ('template', 'Template', '<h1/>',
                     '2026-07-14T00:00:00Z', '2026-07-14T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .expect("template");
        for (id, output, expires_at) in [
            ("expired", "expired.html", "2026-06-13T00:00:00Z"),
            ("retained", "retained.html", "2026-06-14T00:00:00Z"),
        ] {
            sqlx::query(
                "INSERT INTO report_jobs
                 (id, template_id, status, input_json, output_file, created_at, expires_at)
                 VALUES (?, 'template', 'succeeded', '{}', ?,
                         '2026-05-01T00:00:00Z', ?)",
            )
            .bind(id)
            .bind(output)
            .bind(expires_at)
            .execute(&pool)
            .await
            .expect("job");
        }
        let output_dir = std::env::temp_dir().join(format!("rz-reports-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&output_dir).await.expect("output dir");
        tokio::fs::write(output_dir.join("expired.html"), "expired").await.expect("expired output");
        tokio::fs::write(output_dir.join("retained.html"), "retained")
            .await
            .expect("retained output");

        assert_eq!(
            cleanup_expired_reports(&pool, &output_dir, "2026-06-14T00:00:00Z")
                .await
                .expect("cleanup"),
            1
        );
        assert!(!output_dir.join("expired.html").exists());
        assert!(output_dir.join("retained.html").exists());
        let remaining: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM report_jobs")
            .fetch_one(&pool)
            .await
            .expect("remaining");
        assert_eq!(remaining, 1);
        tokio::fs::remove_dir_all(output_dir).await.expect("cleanup output dir");
    }
}
