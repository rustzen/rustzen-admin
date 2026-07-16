use std::time::Duration;

use chrono::Utc;
use reqwest::Client;
use rustzen_storage::SqlitePool;
use sysinfo::{Disks, System};
use uuid::Uuid;

use crate::{common::error::AppError, middleware::MONITOR_AGENT_TOKEN_HEADER};

use super::{
    repo,
    types::{HeartbeatInput, HeartbeatRecord},
};

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);

pub(super) async fn record(pool: &SqlitePool, input: HeartbeatInput) -> Result<(), AppError> {
    if input.agent_id.trim().is_empty() || input.hostname.trim().is_empty() {
        return Err(AppError::invalid_input("agentId and hostname are required"));
    }

    let now = Utc::now().to_rfc3339();
    let collected_at = input.collected_at.to_rfc3339();
    let mut transaction = pool.begin().await?;
    let node_id = repo::find_node_id(&mut transaction, &input.agent_id)
        .await?
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let record = HeartbeatRecord {
        node_id: &node_id,
        memory_used_bytes: to_i64(input.memory_used_bytes),
        memory_total_bytes: to_i64(input.memory_total_bytes),
        disk_used_bytes: to_i64(input.disk_used_bytes),
        disk_total_bytes: to_i64(input.disk_total_bytes),
        input: &input,
        collected_at: &collected_at,
        now: &now,
    };
    repo::upsert_node(&mut transaction, &record).await?;
    repo::insert_metric(&mut transaction, &record).await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn run_agent(
    endpoint: String,
    agent_token: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let hostname = System::host_name().unwrap_or_else(|| Uuid::new_v4().to_string());
    let agent_id = hostname.clone();
    let client = Client::builder().timeout(REQUEST_TIMEOUT).build()?;
    let mut system = System::new_all();
    let mut disks = Disks::new_with_refreshed_list();

    loop {
        system.refresh_all();
        disks.refresh(true);
        let disk_total_bytes = disks.iter().map(|disk| disk.total_space()).sum::<u64>();
        let disk_available_bytes = disks.iter().map(|disk| disk.available_space()).sum::<u64>();
        let payload = HeartbeatInput {
            agent_id: agent_id.clone(),
            hostname: hostname.clone(),
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
            cpu_percent: system.global_cpu_usage(),
            memory_used_bytes: system.used_memory(),
            memory_total_bytes: system.total_memory(),
            disk_used_bytes: disk_total_bytes.saturating_sub(disk_available_bytes),
            disk_total_bytes,
            collected_at: Utc::now(),
        };
        match client
            .post(&endpoint)
            .header(MONITOR_AGENT_TOKEN_HEADER, &agent_token)
            .json(&payload)
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                tracing::debug!(%agent_id, "Monitor heartbeat accepted");
            }
            Ok(response) => {
                tracing::warn!(status = %response.status(), %agent_id, "Monitor heartbeat rejected");
            }
            Err(error) => {
                tracing::warn!(%error, %agent_id, "Monitor heartbeat failed");
            }
        }
        tokio::time::sleep(HEARTBEAT_INTERVAL).await;
    }
}

fn to_i64(value: u64) -> i64 {
    i64::try_from(value).unwrap_or(i64::MAX)
}

#[cfg(test)]
mod tests {
    use chrono::Utc;

    use crate::{features::nodes, infra::db::migrated_test_pool};

    use super::{HeartbeatInput, record};

    #[tokio::test]
    async fn heartbeat_creates_one_node_and_appends_metrics_transactionally() {
        let pool = migrated_test_pool().await;
        let input = HeartbeatInput {
            agent_id: "agent-1".to_string(),
            hostname: "host-1".to_string(),
            agent_version: "0.5.0".to_string(),
            cpu_percent: 12.5,
            memory_used_bytes: 10,
            memory_total_bytes: 20,
            disk_used_bytes: 30,
            disk_total_bytes: 40,
            collected_at: Utc::now(),
        };
        record(&pool, input.clone()).await.expect("first heartbeat");
        record(&pool, input).await.expect("second heartbeat");

        let nodes = nodes::service::list(&pool).await.expect("list nodes");
        assert_eq!(nodes.len(), 1);
        let node = serde_json::to_value(&nodes[0]).expect("serialize node");
        assert_eq!(node["agentId"], "agent-1");
        assert_eq!(node["cpuPercent"], 12.5);
    }

    #[test]
    fn unsigned_integer_conversion_saturates_at_sqlite_integer_max() {
        assert_eq!(super::to_i64(u64::MAX), i64::MAX);
    }
}
