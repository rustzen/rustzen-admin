use chrono::Utc;
use rustzen_storage::SqlitePool;
use uuid::Uuid;

use crate::{
    common::error::AppError,
    features::{checks::types::Page, nodes::types::NodeView},
};

use super::{
    repo,
    types::{Incident, IncidentQuery},
};

pub(crate) async fn list(
    pool: &SqlitePool,
    query: IncidentQuery,
) -> Result<Page<Incident>, AppError> {
    if let Some(status) = query.status.as_deref()
        && !matches!(status, "active" | "open" | "acknowledged" | "resolved")
    {
        return Err(AppError::invalid_input(
            "status must be active, open, acknowledged, or resolved",
        ));
    }
    if let Some(source_type) = query.source_type.as_deref()
        && !matches!(source_type, "node" | "check" | "resource")
    {
        return Err(AppError::invalid_input("sourceType must be node, check, or resource"));
    }
    let current = query.current.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20);
    if current < 1 || !(1..=100).contains(&page_size) {
        return Err(AppError::invalid_input(
            "current must be positive and pageSize must be between 1 and 100",
        ));
    }
    let (rows, total) = repo::list(
        pool,
        (current - 1) * page_size,
        page_size,
        query.status.as_deref(),
        query.source_type.as_deref(),
    )
    .await?;
    Ok(Page { data: rows.into_iter().map(Incident::from).collect(), total, success: true })
}

pub(crate) async fn get(pool: &SqlitePool, id: &str) -> Result<Incident, AppError> {
    repo::get(pool, id).await?.map(Incident::from).ok_or_else(|| AppError::not_found("incident"))
}

pub(crate) async fn acknowledge(pool: &SqlitePool, id: &str) -> Result<Incident, AppError> {
    if !repo::acknowledge(pool, id, &Utc::now().to_rfc3339()).await? {
        return Err(AppError::invalid_input("only open incidents can be acknowledged"));
    }
    get(pool, id).await
}

pub(crate) async fn observe(
    pool: &SqlitePool,
    source_type: &str,
    source_id: &str,
    kind: &str,
    title: &str,
    details: serde_json::Value,
    active: bool,
) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    if active {
        let id = Uuid::new_v4().to_string();
        let details = details.to_string();
        repo::upsert_active(
            pool,
            repo::ActiveIncident {
                id: &id,
                source_type,
                source_id,
                kind,
                title,
                details: &details,
                observed_at: &now,
            },
        )
        .await?;
    } else {
        repo::resolve_active(pool, source_type, source_id, kind, &now).await?;
    }
    Ok(())
}

pub(crate) async fn evaluate_once(pool: &SqlitePool) -> Result<(), AppError> {
    let settings = crate::features::settings::service::get(pool).await?;
    let nodes = crate::features::nodes::service::list(pool).await?;
    for node in &nodes {
        evaluate_node(pool, node).await?;
        let samples =
            repo::resource_samples(pool, &node.row.id, settings.failure_threshold).await?;
        for (kind, title, threshold, values) in [
            (
                "cpu_high",
                format!("High CPU usage on {}", node.row.hostname),
                settings.cpu_threshold_percent,
                samples.iter().map(|sample| sample.cpu_percent).collect::<Vec<_>>(),
            ),
            (
                "memory_high",
                format!("High memory usage on {}", node.row.hostname),
                settings.memory_threshold_percent,
                samples.iter().map(|sample| sample.memory_percent).collect::<Vec<_>>(),
            ),
            (
                "disk_high",
                format!("High disk usage on {}", node.row.hostname),
                settings.disk_threshold_percent,
                samples.iter().map(|sample| sample.disk_percent).collect::<Vec<_>>(),
            ),
        ] {
            let active = values.len() == settings.failure_threshold as usize
                && values.iter().all(|value| *value >= threshold);
            observe(
                pool,
                "resource",
                &node.row.id,
                kind,
                &title,
                serde_json::json!({ "threshold": threshold, "samples": values }),
                active,
            )
            .await?;
        }
    }
    Ok(())
}

async fn evaluate_node(pool: &SqlitePool, node: &NodeView) -> Result<(), AppError> {
    observe(
        pool,
        "node",
        &node.row.id,
        "node_offline",
        &format!("Node {} is offline", node.row.hostname),
        serde_json::json!({ "lastSeenAt": node.row.last_seen_at }),
        node.status == "offline",
    )
    .await
}

pub(crate) async fn active_count(pool: &SqlitePool) -> Result<i64, AppError> {
    Ok(repo::active_count(pool).await?)
}

#[cfg(test)]
mod tests {
    use crate::infra::db::migrated_test_pool;

    use super::{IncidentQuery, acknowledge, list, observe};

    #[tokio::test]
    async fn incident_lifecycle_deduplicates_acknowledges_and_resolves() {
        let pool = migrated_test_pool().await;
        for _ in 0..2 {
            observe(&pool, "check", "check-1", "tcp_down", "TCP down", serde_json::json!({}), true)
                .await
                .expect("observe active");
        }
        let page = list(
            &pool,
            IncidentQuery { current: None, page_size: None, status: None, source_type: None },
        )
        .await
        .expect("list");
        assert_eq!(page.total, 1);
        let incident = acknowledge(&pool, &page.data[0].id).await.expect("acknowledge");
        assert_eq!(incident.status, "acknowledged");
        observe(&pool, "check", "check-1", "tcp_down", "TCP down", serde_json::json!({}), false)
            .await
            .expect("resolve");
        let resolved = list(
            &pool,
            IncidentQuery {
                current: None,
                page_size: None,
                status: Some("resolved".to_string()),
                source_type: None,
            },
        )
        .await
        .expect("resolved list");
        assert_eq!(resolved.total, 1);
    }
}
