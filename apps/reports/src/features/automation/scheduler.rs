use std::{str::FromStr, sync::Arc, time::Duration};

use chrono::{DateTime, TimeDelta, Utc};
use croner::Cron;
use tokio::sync::Semaphore;
use uuid::Uuid;

use crate::{app::AppState, common::error::AppError};

use super::{browser, repo, service};

pub async fn initialize(state: &AppState) -> Result<(), AppError> {
    let recovered = repo::recover_runs(&state.pool, &Utc::now().to_rfc3339()).await?;
    if recovered > 0 {
        tracing::warn!(recovered, "Recovered interrupted Automation runs");
    }
    Ok(())
}

pub fn spawn(state: AppState) {
    let state = Arc::new(state);
    spawn_runs(Arc::clone(&state));
    spawn_schedules(state);
}

fn spawn_runs(state: Arc<AppState>) {
    let semaphore = Arc::new(Semaphore::new(state.max_concurrency));
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_millis(250)).await;
            let Ok(Some(id)) = repo::next_queued(&state.pool).await else { continue };
            let Ok(permit) = Arc::clone(&semaphore).try_acquire_owned() else { continue };
            if !repo::claim_run(&state.pool, &id, &Utc::now().to_rfc3339()).await.unwrap_or(false) {
                continue;
            }
            let state = Arc::clone(&state);
            tokio::spawn(async move {
                let _permit = permit;
                if let Err(error) = execute_run(&state, &id).await {
                    tracing::error!(run_id=%id,%error,"Automation run failed");
                }
            });
        }
    });
}

async fn execute_run(state: &AppState, id: &str) -> Result<(), AppError> {
    let run = service::run(&state.pool, id).await?;
    let flow = service::flow(&state.pool, &run.flow_id).await?;
    let system = service::system(&state.pool, &flow.system_id).await?;
    if !system.enabled {
        repo::finish_run(
            &state.pool,
            id,
            "failed",
            Some("target system is disabled"),
            &Utc::now().to_rfc3339(),
        )
        .await?;
        return Ok(());
    }
    let account = if let Some(account_id) = run.account_id.as_deref() {
        Some(
            repo::account_secret(&state.pool, account_id)
                .await?
                .ok_or_else(|| AppError::NotFound("account not found".into()))?,
        )
    } else {
        None
    };
    let settings = repo::settings(&state.pool).await?;
    let result = tokio::time::timeout(
        Duration::from_secs(settings.max_run_timeout_seconds as u64),
        browser::execute(state, &run, &flow, &system, account.as_ref()),
    )
    .await;
    let (status, error) = match result {
        Ok(Ok(())) => ("succeeded", None),
        Ok(Err(error)) => ("failed", Some(error.to_string())),
        Err(_) => ("failed", Some("run timed out".into())),
    };
    if !repo::run_cancelled(&state.pool, id).await? {
        repo::finish_run(&state.pool, id, status, error.as_deref(), &Utc::now().to_rfc3339())
            .await?;
    }
    Ok(())
}

fn spawn_schedules(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut cleanup_tick = 0_u32;
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            if let Err(error) = schedule_once(&state).await {
                tracing::error!(%error,"Automation scheduler failed");
            }
            cleanup_tick += 1;
            if cleanup_tick >= 3600 {
                cleanup_tick = 0;
                if let Err(error) = cleanup_once(&state).await {
                    tracing::error!(%error,"Automation retention cleanup failed");
                }
            }
        }
    });
}

pub async fn cleanup_once(state: &AppState) -> Result<(u64, u64), AppError> {
    let settings = repo::settings(&state.pool).await?;
    let now = Utc::now();
    let artifact_cutoff = (now - TimeDelta::days(settings.artifact_retention_days)).to_rfc3339();
    let run_cutoff = (now - TimeDelta::days(settings.run_retention_days)).to_rfc3339();
    let expired = repo::expired_artifacts(&state.pool, &artifact_cutoff).await?;
    for artifact in &expired {
        let _ = tokio::fs::remove_file(
            state.output_dir.join(&artifact.run_id).join(&artifact.file_name),
        )
        .await;
    }
    Ok(repo::cleanup_retention(&state.pool, &artifact_cutoff, &run_cutoff).await?)
}

pub async fn schedule_once(state: &AppState) -> Result<usize, AppError> {
    let now = Utc::now();
    let schedules = repo::due_schedules(&state.pool, &now.to_rfc3339()).await?;
    let mut created = 0;
    for schedule in schedules {
        let scheduled_at = schedule.next_run_at.clone().unwrap_or_else(|| now.to_rfc3339());
        let base = DateTime::parse_from_rfc3339(&scheduled_at)
            .map_err(AppError::internal)?
            .with_timezone(&Utc);
        let cron = Cron::from_str(&schedule.cron).map_err(AppError::internal)?;
        let next =
            cron.find_next_occurrence(&base, false).map_err(AppError::internal)?.to_rfc3339();
        if repo::schedule_tick(
            &state.pool,
            &schedule,
            &scheduled_at,
            &next,
            &Uuid::new_v4().to_string(),
            &now.to_rfc3339(),
        )
        .await?
        {
            created += 1;
        }
    }
    Ok(created)
}
