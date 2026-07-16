use chrono::{DateTime, Duration, Utc};
use rustzen_storage::SqlitePool;

use crate::common::error::AppError;

use super::{
    repo,
    types::{NodeRow, NodeView},
};

const ONLINE_WINDOW_SECONDS: i64 = 90;

pub(crate) async fn list(pool: &SqlitePool) -> Result<Vec<NodeView>, AppError> {
    Ok(repo::load(pool, None).await?.into_iter().map(node_view).collect())
}

pub(crate) async fn get(pool: &SqlitePool, node_id: &str) -> Result<NodeView, AppError> {
    let row = repo::load(pool, Some(node_id))
        .await?
        .into_iter()
        .next()
        .ok_or_else(|| AppError::not_found("node"))?;
    Ok(node_view(row))
}

fn node_view(row: NodeRow) -> NodeView {
    node_view_at(row, Utc::now())
}

fn node_view_at(row: NodeRow, now: DateTime<Utc>) -> NodeView {
    let last_seen = DateTime::parse_from_rfc3339(&row.last_seen_at)
        .map(|value| value.with_timezone(&Utc))
        .unwrap_or(DateTime::<Utc>::MIN_UTC);
    let status = if last_seen >= now - Duration::seconds(ONLINE_WINDOW_SECONDS) {
        "online"
    } else {
        "offline"
    };
    NodeView { row, status }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, TimeZone, Utc};

    use super::{NodeRow, node_view_at};

    fn row(last_seen_at: String) -> NodeRow {
        NodeRow {
            id: "node-1".to_string(),
            agent_id: "agent-1".to_string(),
            hostname: "host-1".to_string(),
            agent_version: "0.5.0".to_string(),
            last_seen_at,
            cpu_percent: None,
            memory_used_bytes: None,
            memory_total_bytes: None,
            disk_used_bytes: None,
            disk_total_bytes: None,
            collected_at: None,
        }
    }

    #[test]
    fn online_state_uses_the_existing_ninety_second_boundary() {
        let now = Utc.with_ymd_and_hms(2026, 7, 15, 12, 0, 0).unwrap();
        let online = node_view_at(row((now - Duration::seconds(90)).to_rfc3339()), now);
        let offline = node_view_at(row((now - Duration::seconds(91)).to_rfc3339()), now);
        assert_eq!(online.status, "online");
        assert_eq!(offline.status, "offline");
    }
}
