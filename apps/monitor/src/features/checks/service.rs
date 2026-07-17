use std::time::{Duration, Instant};

use chrono::Utc;
use rustzen_storage::SqlitePool;
use tokio::net::TcpStream;
use uuid::Uuid;

use crate::common::error::AppError;

const MAX_CHECK_CONCURRENCY: usize = 16;

use super::{
    repo,
    types::{
        Check, CheckExecution, CheckResult, ListQuery, Page, ProbeResult, ResultQuery, SaveCheck,
        TestCheck,
    },
};

pub(crate) async fn list(pool: &SqlitePool, query: ListQuery) -> Result<Page<Check>, AppError> {
    let (current, page_size) = page(query.current, query.page_size)?;
    if let Some(status) = query.status.as_deref()
        && !matches!(status, "up" | "down")
    {
        return Err(AppError::invalid_input("status must be up or down"));
    }
    let (data, total) = repo::list(
        pool,
        (current - 1) * page_size,
        page_size,
        query.enabled,
        query.status.as_deref(),
    )
    .await?;
    Ok(Page { data, total, success: true })
}

pub(crate) async fn get(pool: &SqlitePool, id: &str) -> Result<Check, AppError> {
    repo::get(pool, id).await?.ok_or_else(|| AppError::not_found("check"))
}

pub(crate) async fn create(pool: &SqlitePool, input: SaveCheck) -> Result<Check, AppError> {
    let settings = crate::features::settings::service::get(pool).await?;
    let now = Utc::now().to_rfc3339();
    let check = Check {
        id: Uuid::new_v4().to_string(),
        name: input.name.trim().to_string(),
        host: input.host.trim().to_string(),
        port: input.port,
        interval_seconds: input.interval_seconds.unwrap_or(settings.default_check_interval_seconds),
        timeout_ms: input.timeout_ms.unwrap_or(settings.default_check_timeout_ms),
        failure_threshold: input.failure_threshold.unwrap_or(settings.failure_threshold),
        enabled: input.enabled.unwrap_or(true),
        last_status: None,
        last_checked_at: None,
        last_latency_ms: None,
        consecutive_failures: 0,
        created_at: now.clone(),
        updated_at: now,
    };
    validate(&check)?;
    repo::insert(pool, &check).await?;
    Ok(check)
}

pub(crate) async fn update(
    pool: &SqlitePool,
    id: &str,
    input: SaveCheck,
) -> Result<Check, AppError> {
    let existing = get(pool, id).await?;
    let check = Check {
        id: existing.id,
        name: input.name.trim().to_string(),
        host: input.host.trim().to_string(),
        port: input.port,
        interval_seconds: input.interval_seconds.unwrap_or(existing.interval_seconds),
        timeout_ms: input.timeout_ms.unwrap_or(existing.timeout_ms),
        failure_threshold: input.failure_threshold.unwrap_or(existing.failure_threshold),
        enabled: input.enabled.unwrap_or(existing.enabled),
        updated_at: Utc::now().to_rfc3339(),
        ..existing
    };
    validate(&check)?;
    if !repo::update(pool, &check).await? {
        return Err(AppError::not_found("check"));
    }
    Ok(check)
}

pub(crate) async fn set_enabled(
    pool: &SqlitePool,
    id: &str,
    enabled: bool,
) -> Result<Check, AppError> {
    if !repo::set_enabled(pool, id, enabled, &Utc::now().to_rfc3339()).await? {
        return Err(AppError::not_found("check"));
    }
    get(pool, id).await
}

pub(crate) async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    crate::features::incidents::service::observe(
        pool,
        "check",
        id,
        "tcp_down",
        "TCP check unavailable",
        serde_json::json!({}),
        false,
    )
    .await?;
    if !repo::delete(pool, id).await? {
        return Err(AppError::not_found("check"));
    }
    Ok(())
}

pub(crate) async fn test(input: TestCheck) -> Result<ProbeResult, AppError> {
    let host = input.host.trim();
    validate_target(host, input.port, input.timeout_ms.unwrap_or(5000))?;
    let execution = probe(host, input.port, input.timeout_ms.unwrap_or(5000)).await;
    Ok(ProbeResult {
        status: execution.status,
        latency_ms: execution.latency_ms,
        error: execution.error,
    })
}

pub(crate) async fn results(
    pool: &SqlitePool,
    id: &str,
    query: ResultQuery,
) -> Result<Page<CheckResult>, AppError> {
    get(pool, id).await?;
    let (current, page_size) = page(query.current, query.page_size)?;
    let (data, total) = repo::results(pool, id, (current - 1) * page_size, page_size).await?;
    Ok(Page { data, total, success: true })
}

pub(crate) async fn run_once(pool: &SqlitePool) -> Result<usize, AppError> {
    let due = repo::due(pool, &Utc::now().to_rfc3339()).await?;
    let count = due.len();
    let mut tasks = tokio::task::JoinSet::new();
    for check in due {
        if tasks.len() >= MAX_CHECK_CONCURRENCY {
            tasks.join_next().await;
        }
        let pool = pool.clone();
        tasks.spawn(async move {
            if let Err(error) = execute(&pool, check).await {
                tracing::error!(%error, "TCP check execution failed");
            }
        });
    }
    while tasks.join_next().await.is_some() {}
    Ok(count)
}

async fn execute(pool: &SqlitePool, check: Check) -> Result<(), AppError> {
    let execution = probe(&check.host, check.port, check.timeout_ms).await;
    let checked_at = Utc::now().to_rfc3339();
    let mut transaction = pool.begin().await?;
    let consecutive_failures =
        repo::record_execution(&mut transaction, &check, &execution, &checked_at).await?;
    transaction.commit().await?;
    crate::features::incidents::service::observe(
        pool,
        "check",
        &check.id,
        "tcp_down",
        &format!("TCP check {} is down", check.name),
        serde_json::json!({
            "host": check.host,
            "port": check.port,
            "consecutiveFailures": consecutive_failures,
            "failureThreshold": check.failure_threshold,
            "error": execution.error.clone(),
        }),
        execution.status == "down" && consecutive_failures >= check.failure_threshold,
    )
    .await?;
    Ok(())
}

async fn probe(host: &str, port: i64, timeout_ms: i64) -> CheckExecution {
    let started = Instant::now();
    let result = tokio::time::timeout(
        Duration::from_millis(timeout_ms as u64),
        TcpStream::connect((host, port as u16)),
    )
    .await;
    match result {
        Ok(Ok(_)) => CheckExecution {
            status: "up",
            latency_ms: Some(started.elapsed().as_millis().min(i64::MAX as u128) as i64),
            error: None,
        },
        Ok(Err(error)) => {
            CheckExecution { status: "down", latency_ms: None, error: Some(error.to_string()) }
        }
        Err(_) => CheckExecution {
            status: "down",
            latency_ms: None,
            error: Some("connection timed out".to_string()),
        },
    }
}

fn validate(check: &Check) -> Result<(), AppError> {
    if check.name.is_empty() || check.name.chars().count() > 100 {
        return Err(AppError::invalid_input("name must contain 1 to 100 characters"));
    }
    validate_target(&check.host, check.port, check.timeout_ms)?;
    if !(30..=86400).contains(&check.interval_seconds) {
        return Err(AppError::invalid_input("intervalSeconds must be between 30 and 86400"));
    }
    if !(1..=20).contains(&check.failure_threshold) {
        return Err(AppError::invalid_input("failureThreshold must be between 1 and 20"));
    }
    Ok(())
}

fn validate_target(host: &str, port: i64, timeout_ms: i64) -> Result<(), AppError> {
    if host.is_empty()
        || host.chars().count() > 253
        || host.chars().any(char::is_whitespace)
        || host.contains('/')
    {
        return Err(AppError::invalid_input("host must be a DNS name or IP address"));
    }
    if !(1..=65535).contains(&port) {
        return Err(AppError::invalid_input("port must be between 1 and 65535"));
    }
    if !(100..=30000).contains(&timeout_ms) {
        return Err(AppError::invalid_input("timeoutMs must be between 100 and 30000"));
    }
    Ok(())
}

fn page(current: Option<i64>, page_size: Option<i64>) -> Result<(i64, i64), AppError> {
    let current = current.unwrap_or(1);
    let page_size = page_size.unwrap_or(20);
    if current < 1 || !(1..=100).contains(&page_size) {
        return Err(AppError::invalid_input(
            "current must be positive and pageSize must be between 1 and 100",
        ));
    }
    Ok((current, page_size))
}

pub(crate) async fn cleanup(pool: &SqlitePool) -> Result<u64, AppError> {
    let settings = crate::features::settings::service::get(pool).await?;
    let cutoff =
        (Utc::now() - chrono::Duration::days(settings.check_result_retention_days)).to_rfc3339();
    Ok(repo::delete_results_before(pool, &cutoff).await?)
}

pub(crate) async fn unhealthy_count(pool: &SqlitePool) -> Result<i64, AppError> {
    Ok(repo::unhealthy_count(pool).await?)
}

#[cfg(test)]
mod tests {
    use tokio::net::TcpListener;

    use crate::{features::incidents, infra::db::migrated_test_pool};

    use super::{
        MAX_CHECK_CONCURRENCY, ResultQuery, SaveCheck, TestCheck, create, results, run_once, test,
    };

    #[tokio::test]
    async fn tcp_probe_and_scheduler_drive_results_and_incident_lifecycle() {
        assert_eq!(MAX_CHECK_CONCURRENCY, 16);
        let pool = migrated_test_pool().await;
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind fixture");
        let port = i64::from(listener.local_addr().expect("fixture address").port());
        assert_eq!(
            test(TestCheck { host: "127.0.0.1".to_string(), port, timeout_ms: Some(500) })
                .await
                .expect("successful probe")
                .status,
            "up"
        );

        let check = create(
            &pool,
            SaveCheck {
                name: "fixture".to_string(),
                host: "127.0.0.1".to_string(),
                port,
                interval_seconds: Some(30),
                timeout_ms: Some(500),
                failure_threshold: Some(2),
                enabled: Some(true),
            },
        )
        .await
        .expect("create check");
        assert_eq!(run_once(&pool).await.expect("up run"), 1);
        drop(listener);

        for _ in 0..2 {
            make_due(&pool, &check.id).await;
            assert_eq!(run_once(&pool).await.expect("down run"), 1);
        }
        assert_eq!(incidents::service::active_count(&pool).await.expect("active incidents"), 1);

        let listener = TcpListener::bind(("127.0.0.1", port as u16)).await.expect("rebind fixture");
        make_due(&pool, &check.id).await;
        assert_eq!(run_once(&pool).await.expect("recovery run"), 1);
        drop(listener);
        assert_eq!(incidents::service::active_count(&pool).await.expect("resolved incidents"), 0);
        assert_eq!(
            results(&pool, &check.id, ResultQuery { current: None, page_size: None },)
                .await
                .expect("results")
                .total,
            4
        );
    }

    async fn make_due(pool: &rustzen_storage::SqlitePool, id: &str) {
        sqlx::query(
            "UPDATE monitor_checks
             SET last_checked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-31 seconds')
             WHERE id = ?",
        )
        .bind(id)
        .execute(pool)
        .await
        .expect("make check due");
    }
}
