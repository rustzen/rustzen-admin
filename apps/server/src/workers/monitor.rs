use std::time::Duration;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    middleware,
    routing::{get, post},
};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use rustzen_config::RETENTION_DAYS;
use rustzen_storage::{SqliteMaintenancePlan, run_sqlite_maintenance};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use sysinfo::{Disks, System};
use uuid::Uuid;

use crate::{
    infra::config::CONFIG,
    workers::common::{
        health, ipc_client, map_worker_error, require_capability, require_ipc, sign_ipc_request,
    },
};

use super::monitor_update::{
    AgentFacts, AgentUpdateDirective, apply_update, confirm_pending_update, directive_for,
    rollback_pending_update, validate_rollout_config,
};

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations/monitor");

#[derive(Clone)]
struct MonitorState {
    pool: SqlitePool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HeartbeatInput {
    protocol_version: u8,
    agent_id: String,
    hostname: String,
    agent_version: String,
    os: String,
    arch: String,
    available_bytes: u64,
    cpu_percent: f32,
    memory_used_bytes: u64,
    memory_total_bytes: u64,
    disk_used_bytes: u64,
    disk_total_bytes: u64,
    collected_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HeartbeatOutput {
    update: Option<AgentUpdateDirective>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
struct NodeRow {
    id: String,
    agent_id: String,
    hostname: String,
    agent_version: String,
    last_seen_at: String,
    cpu_percent: Option<f32>,
    memory_used_bytes: Option<i64>,
    memory_total_bytes: Option<i64>,
    disk_used_bytes: Option<i64>,
    disk_total_bytes: Option<i64>,
    collected_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NodeView {
    #[serde(flatten)]
    row: NodeRow,
    status: &'static str,
}

pub async fn run_controller() -> Result<(), Box<dyn std::error::Error>> {
    validate_rollout_config()?;
    let pool = crate::infra::db::create_pool_for_path(&CONFIG.monitor_database_path()).await?;
    MIGRATOR.run(&pool).await?;
    crate::infra::db::test_connection(&pool).await?;
    spawn_retention(pool.clone());

    let protected = Router::new()
        .route("/ipc/v1/monitor/heartbeat", post(heartbeat))
        .route("/ipc/v1/monitor/nodes", get(list_nodes))
        .route("/ipc/v1/monitor/nodes/{node_id}", get(get_node))
        .route_layer(middleware::from_fn(require_ipc));
    let app = Router::new()
        .route("/health", get(health))
        .merge(protected)
        .with_state(MonitorState { pool });
    let address = format!("{}:{}", CONFIG.worker_host, CONFIG.monitor_port);
    let listener = tokio::net::TcpListener::bind(&address).await?;
    tracing::info!(%address, "Monitor Controller started");
    axum::serve(listener, app).await.map_err(map_worker_error)
}

pub async fn run_agent() -> Result<(), Box<dyn std::error::Error>> {
    let agent_id = std::env::var("RUSTZEN_MONITOR_AGENT_ID")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| System::host_name().unwrap_or_else(|| Uuid::new_v4().to_string()));
    let interval_seconds = std::env::var("RUSTZEN_MONITOR_AGENT_INTERVAL_SECONDS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(30)
        .max(5);
    let endpoint = format!("{}/ipc/v1/monitor/heartbeat", CONFIG.monitor_base_url());
    let client = ipc_client()?;
    let mut system = System::new_all();
    let mut disks = Disks::new_with_refreshed_list();
    let mut consecutive_failures = 0_u8;

    loop {
        system.refresh_all();
        disks.refresh(true);
        let disk_total_bytes: u64 = disks.iter().map(|disk| disk.total_space()).sum();
        let disk_available_bytes: u64 = disks.iter().map(|disk| disk.available_space()).sum();
        let payload = HeartbeatInput {
            protocol_version: 1,
            agent_id: agent_id.clone(),
            hostname: System::host_name().unwrap_or_else(|| agent_id.clone()),
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
            os: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
            available_bytes: disk_available_bytes,
            cpu_percent: system.global_cpu_usage(),
            memory_used_bytes: system.used_memory(),
            memory_total_bytes: system.total_memory(),
            disk_used_bytes: disk_total_bytes.saturating_sub(disk_available_bytes),
            disk_total_bytes,
            collected_at: Utc::now(),
        };
        let request = sign_ipc_request(
            client.post(&endpoint).json(&payload),
            "POST",
            "/ipc/v1/monitor/heartbeat",
            "monitor:heartbeat",
        )?;
        match request.send().await {
            Ok(response) if response.status().is_success() => {
                consecutive_failures = 0;
                tracing::debug!(%agent_id, "Monitor heartbeat accepted");
                confirm_pending_update()?;
                if response.status() != StatusCode::NO_CONTENT {
                    let output = response.json::<HeartbeatOutput>().await?;
                    if let Some(update) = output.update {
                        apply_update(&client, &update).await?;
                        tracing::info!(%agent_id, "Monitor Agent update staged; exiting for supervisor restart");
                        return Err(std::io::Error::other(
                            "Monitor Agent restart required after update",
                        )
                        .into());
                    }
                }
            }
            Ok(response) => {
                consecutive_failures = consecutive_failures.saturating_add(1);
                tracing::warn!(status = %response.status(), %agent_id, "Monitor heartbeat rejected");
            }
            Err(error) => {
                consecutive_failures = consecutive_failures.saturating_add(1);
                tracing::warn!(%error, %agent_id, "Monitor heartbeat failed");
            }
        }
        if consecutive_failures >= 3 && rollback_pending_update()? {
            tracing::error!(%agent_id, "Monitor Agent update rolled back after heartbeat failures");
            return Err(
                std::io::Error::other("Monitor Agent restart required after rollback").into()
            );
        }
        tokio::time::sleep(Duration::from_secs(interval_seconds)).await;
    }
}

async fn heartbeat(
    State(state): State<MonitorState>,
    headers: HeaderMap,
    Json(input): Json<HeartbeatInput>,
) -> Result<Json<HeartbeatOutput>, (StatusCode, String)> {
    require_capability(&headers, "monitor:heartbeat")?;
    if input.protocol_version != 1
        || input.agent_id.trim().is_empty()
        || input.hostname.trim().is_empty()
    {
        return Err((StatusCode::BAD_REQUEST, "agentId and hostname are required".to_string()));
    }
    let now = Utc::now().to_rfc3339();
    let mut transaction = state.pool.begin().await.map_err(internal_error)?;
    let node_id =
        sqlx::query_scalar::<_, String>("SELECT id FROM monitor_nodes WHERE agent_id = ?")
            .bind(&input.agent_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(internal_error)?
            .unwrap_or_else(|| Uuid::new_v4().to_string());
    sqlx::query(
        "INSERT INTO monitor_nodes (id, agent_id, hostname, agent_version, last_seen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(agent_id) DO UPDATE SET
           hostname = excluded.hostname,
           agent_version = excluded.agent_version,
           last_seen_at = excluded.last_seen_at,
           updated_at = excluded.updated_at",
    )
    .bind(&node_id)
    .bind(&input.agent_id)
    .bind(&input.hostname)
    .bind(&input.agent_version)
    .bind(input.collected_at.to_rfc3339())
    .bind(&now)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(internal_error)?;
    sqlx::query(
        "INSERT INTO monitor_metrics (
           node_id, cpu_percent, memory_used_bytes, memory_total_bytes,
           disk_used_bytes, disk_total_bytes, collected_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&node_id)
    .bind(input.cpu_percent)
    .bind(to_i64(input.memory_used_bytes))
    .bind(to_i64(input.memory_total_bytes))
    .bind(to_i64(input.disk_used_bytes))
    .bind(to_i64(input.disk_total_bytes))
    .bind(input.collected_at.to_rfc3339())
    .execute(&mut *transaction)
    .await
    .map_err(internal_error)?;
    transaction.commit().await.map_err(internal_error)?;
    let update = directive_for(AgentFacts {
        agent_id: &input.agent_id,
        current_version: &input.agent_version,
        os: &input.os,
        arch: &input.arch,
        available_bytes: input.available_bytes,
    })
    .map_err(internal_error)?;
    Ok(Json(HeartbeatOutput { update }))
}

async fn list_nodes(
    State(state): State<MonitorState>,
    headers: HeaderMap,
) -> Result<Json<Vec<NodeView>>, (StatusCode, String)> {
    require_capability(&headers, "monitor:view")?;
    let rows = load_nodes(&state.pool, None).await.map_err(internal_error)?;
    Ok(Json(rows.into_iter().map(node_view).collect()))
}

async fn get_node(
    State(state): State<MonitorState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<NodeView>, (StatusCode, String)> {
    require_capability(&headers, "monitor:view")?;
    let row = load_nodes(&state.pool, Some(&node_id))
        .await
        .map_err(internal_error)?
        .into_iter()
        .next()
        .ok_or_else(|| (StatusCode::NOT_FOUND, "node not found".to_string()))?;
    Ok(Json(node_view(row)))
}

async fn load_nodes(pool: &SqlitePool, node_id: Option<&str>) -> Result<Vec<NodeRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT n.id, n.agent_id, n.hostname, n.agent_version, n.last_seen_at,
                m.cpu_percent, m.memory_used_bytes, m.memory_total_bytes,
                m.disk_used_bytes, m.disk_total_bytes, m.collected_at
         FROM monitor_nodes n
         LEFT JOIN monitor_metrics m ON m.id = (
             SELECT id FROM monitor_metrics WHERE node_id = n.id ORDER BY collected_at DESC LIMIT 1
         )
         WHERE (? IS NULL OR n.id = ?)
         ORDER BY n.hostname ASC",
    )
    .bind(node_id)
    .bind(node_id)
    .fetch_all(pool)
    .await
}

fn node_view(row: NodeRow) -> NodeView {
    let last_seen = DateTime::parse_from_rfc3339(&row.last_seen_at)
        .map(|value| value.with_timezone(&Utc))
        .unwrap_or(DateTime::<Utc>::MIN_UTC);
    let status =
        if last_seen >= Utc::now() - ChronoDuration::seconds(90) { "online" } else { "offline" };
    NodeView { row, status }
}

fn spawn_retention(pool: SqlitePool) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60 * 60)).await;
            let cutoff = (Utc::now() - ChronoDuration::days(RETENTION_DAYS as i64)).to_rfc3339();
            match delete_metrics_before(&pool, &cutoff).await {
                Ok(0) => {}
                Ok(deleted) => {
                    tracing::info!(deleted, "Monitor metric retention completed");
                    if let Err(error) =
                        run_sqlite_maintenance(&pool, SqliteMaintenancePlan::reclaim()).await
                    {
                        tracing::error!(%error, "Monitor SQLite maintenance failed");
                    }
                }
                Err(error) => tracing::error!(%error, "Monitor metric retention failed"),
            }
        }
    });
}

async fn delete_metrics_before(pool: &SqlitePool, cutoff: &str) -> Result<u64, sqlx::Error> {
    sqlx::query("DELETE FROM monitor_metrics WHERE collected_at < ?")
        .bind(cutoff)
        .execute(pool)
        .await
        .map(|result| result.rows_affected())
}

fn to_i64(value: u64) -> i64 {
    i64::try_from(value).unwrap_or(i64::MAX)
}

fn internal_error(error: impl std::fmt::Display) -> (StatusCode, String) {
    tracing::error!(%error, "Monitor worker request failed");
    (StatusCode::INTERNAL_SERVER_ERROR, "monitor worker error".to_string())
}

#[cfg(test)]
mod tests {
    use super::{MIGRATOR, MonitorState, delete_metrics_before, load_nodes};
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn fresh_monitor_database_migrates_and_starts_empty() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect");
        MIGRATOR.run(&pool).await.expect("migrate");
        let state = MonitorState { pool };
        assert!(load_nodes(&state.pool, None).await.expect("nodes").is_empty());
    }

    #[tokio::test]
    async fn retention_deletes_only_metrics_older_than_thirty_days() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect");
        MIGRATOR.run(&pool).await.expect("migrate");
        sqlx::query(
            "INSERT INTO monitor_nodes
             (id, agent_id, hostname, agent_version, last_seen_at, created_at, updated_at)
             VALUES ('node', 'agent', 'host', '1', '2026-07-14T00:00:00Z',
                     '2026-07-14T00:00:00Z', '2026-07-14T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .expect("node");
        for collected_at in ["2026-06-13T00:00:00Z", "2026-06-14T00:00:00Z"] {
            sqlx::query(
                "INSERT INTO monitor_metrics
                 (node_id, cpu_percent, memory_used_bytes, memory_total_bytes,
                  disk_used_bytes, disk_total_bytes, collected_at)
                 VALUES ('node', 1, 1, 2, 1, 2, ?)",
            )
            .bind(collected_at)
            .execute(&pool)
            .await
            .expect("metric");
        }

        assert_eq!(delete_metrics_before(&pool, "2026-06-14T00:00:00Z").await.expect("cleanup"), 1);
        let remaining: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM monitor_metrics")
            .fetch_one(&pool)
            .await
            .expect("remaining");
        assert_eq!(remaining, 1);
    }
}
