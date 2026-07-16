use rustzen_storage::SqlitePool;

use super::types::*;

pub async fn systems(pool: &SqlitePool) -> Result<Vec<System>, sqlx::Error> {
    sqlx::query_as("SELECT id,name,base_url,enabled,notes,created_at,updated_at FROM automation_systems ORDER BY created_at DESC").fetch_all(pool).await
}
pub async fn system(pool: &SqlitePool, id: &str) -> Result<Option<System>, sqlx::Error> {
    sqlx::query_as("SELECT id,name,base_url,enabled,notes,created_at,updated_at FROM automation_systems WHERE id=?").bind(id).fetch_optional(pool).await
}
#[allow(clippy::too_many_arguments)]
pub async fn insert_system(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    base_url: &str,
    enabled: bool,
    notes: &str,
    now: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO automation_systems(id,name,base_url,enabled,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(id).bind(name).bind(base_url).bind(enabled).bind(notes).bind(now).bind(now).execute(pool).await?;
    Ok(())
}
pub async fn update_system(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    base_url: &str,
    enabled: bool,
    notes: &str,
    now: &str,
) -> Result<bool, sqlx::Error> {
    sqlx::query(
        "UPDATE automation_systems SET name=?,base_url=?,enabled=?,notes=?,updated_at=? WHERE id=?",
    )
    .bind(name)
    .bind(base_url)
    .bind(enabled)
    .bind(notes)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map(|r| r.rows_affected() == 1)
}
pub async fn delete_system(pool: &SqlitePool, id: &str) -> Result<bool, sqlx::Error> {
    sqlx::query("DELETE FROM automation_systems WHERE id=?")
        .bind(id)
        .execute(pool)
        .await
        .map(|r| r.rows_affected() == 1)
}

pub async fn accounts(
    pool: &SqlitePool,
    system_id: Option<&str>,
) -> Result<Vec<Account>, sqlx::Error> {
    sqlx::query_as("SELECT id,system_id,name,username,1 AS secret_configured,created_at,updated_at FROM automation_accounts WHERE (? IS NULL OR system_id=?) ORDER BY created_at DESC").bind(system_id).bind(system_id).fetch_all(pool).await
}
pub async fn account_secret(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<AccountSecret>, sqlx::Error> {
    sqlx::query_as(
        "SELECT system_id,username,secret_ciphertext,secret_nonce FROM automation_accounts WHERE id=?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}
#[allow(clippy::too_many_arguments)]
pub async fn insert_account(
    pool: &SqlitePool,
    id: &str,
    system_id: &str,
    name: &str,
    username: &str,
    ciphertext: &str,
    nonce: &str,
    now: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO automation_accounts(id,system_id,name,username,secret_ciphertext,secret_nonce,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(id).bind(system_id).bind(name).bind(username).bind(ciphertext).bind(nonce).bind(now).bind(now).execute(pool).await?;
    Ok(())
}
#[allow(clippy::too_many_arguments)]
pub async fn update_account(
    pool: &SqlitePool,
    id: &str,
    system_id: &str,
    name: &str,
    username: &str,
    secret: Option<(&str, &str)>,
    now: &str,
) -> Result<bool, sqlx::Error> {
    let result = if let Some((ciphertext, nonce)) = secret {
        sqlx::query("UPDATE automation_accounts SET system_id=?,name=?,username=?,secret_ciphertext=?,secret_nonce=?,updated_at=? WHERE id=?").bind(system_id).bind(name).bind(username).bind(ciphertext).bind(nonce).bind(now).bind(id).execute(pool).await?
    } else {
        sqlx::query(
            "UPDATE automation_accounts SET system_id=?,name=?,username=?,updated_at=? WHERE id=?",
        )
        .bind(system_id)
        .bind(name)
        .bind(username)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?
    };
    Ok(result.rows_affected() == 1)
}
pub async fn delete_account(pool: &SqlitePool, id: &str) -> Result<bool, sqlx::Error> {
    sqlx::query("DELETE FROM automation_accounts WHERE id=?")
        .bind(id)
        .execute(pool)
        .await
        .map(|r| r.rows_affected() == 1)
}

pub async fn flows(
    pool: &SqlitePool,
    system_id: Option<&str>,
) -> Result<Vec<FlowRow>, sqlx::Error> {
    sqlx::query_as("SELECT id,system_id,name,steps_json,created_at,updated_at FROM automation_flows WHERE (? IS NULL OR system_id=?) ORDER BY created_at DESC").bind(system_id).bind(system_id).fetch_all(pool).await
}
pub async fn flow(pool: &SqlitePool, id: &str) -> Result<Option<FlowRow>, sqlx::Error> {
    sqlx::query_as("SELECT id,system_id,name,steps_json,created_at,updated_at FROM automation_flows WHERE id=?").bind(id).fetch_optional(pool).await
}
pub async fn insert_flow(
    pool: &SqlitePool,
    id: &str,
    system_id: &str,
    name: &str,
    steps: &str,
    now: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO automation_flows(id,system_id,name,steps_json,created_at,updated_at) VALUES(?,?,?,?,?,?)").bind(id).bind(system_id).bind(name).bind(steps).bind(now).bind(now).execute(pool).await?;
    Ok(())
}
pub async fn update_flow(
    pool: &SqlitePool,
    id: &str,
    system_id: &str,
    name: &str,
    steps: &str,
    now: &str,
) -> Result<bool, sqlx::Error> {
    sqlx::query(
        "UPDATE automation_flows SET system_id=?,name=?,steps_json=?,updated_at=? WHERE id=?",
    )
    .bind(system_id)
    .bind(name)
    .bind(steps)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map(|r| r.rows_affected() == 1)
}
pub async fn delete_flow(pool: &SqlitePool, id: &str) -> Result<bool, sqlx::Error> {
    sqlx::query("DELETE FROM automation_flows WHERE id=?")
        .bind(id)
        .execute(pool)
        .await
        .map(|r| r.rows_affected() == 1)
}

pub async fn runs(
    pool: &SqlitePool,
    offset: i64,
    limit: i64,
    status: Option<&str>,
) -> Result<(Vec<Run>, i64), sqlx::Error> {
    let rows=sqlx::query_as("SELECT id,flow_id,account_id,schedule_id,status,input_json,error,created_at,started_at,finished_at FROM automation_runs WHERE (? IS NULL OR status=?) ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(status).bind(status).bind(limit).bind(offset).fetch_all(pool).await?;
    let total =
        sqlx::query_scalar("SELECT COUNT(*) FROM automation_runs WHERE (? IS NULL OR status=?)")
            .bind(status)
            .bind(status)
            .fetch_one(pool)
            .await?;
    Ok((rows, total))
}
pub async fn run(pool: &SqlitePool, id: &str) -> Result<Option<Run>, sqlx::Error> {
    sqlx::query_as("SELECT id,flow_id,account_id,schedule_id,status,input_json,error,created_at,started_at,finished_at FROM automation_runs WHERE id=?").bind(id).fetch_optional(pool).await
}
pub async fn insert_run(
    pool: &SqlitePool,
    id: &str,
    flow_id: &str,
    account_id: Option<&str>,
    schedule_id: Option<&str>,
    input: &str,
    now: &str,
) -> Result<bool, sqlx::Error> {
    sqlx::query("INSERT INTO automation_runs(id,flow_id,account_id,schedule_id,status,input_json,created_at) VALUES(?,?,?,?,'queued',?,?)").bind(id).bind(flow_id).bind(account_id).bind(schedule_id).bind(input).bind(now).execute(pool).await.map(|r|r.rows_affected()==1)
}
pub async fn claim_run(pool: &SqlitePool, id: &str, now: &str) -> Result<bool, sqlx::Error> {
    sqlx::query(
        "UPDATE automation_runs SET status='running',started_at=? WHERE id=? AND status='queued'",
    )
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map(|r| r.rows_affected() == 1)
}
pub async fn next_queued(pool: &SqlitePool) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT id FROM automation_runs WHERE status='queued' ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(pool)
    .await
}
pub async fn finish_run(
    pool: &SqlitePool,
    id: &str,
    status: &str,
    error: Option<&str>,
    now: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE automation_runs SET status=?,error=?,finished_at=? WHERE id=? AND status='running'",
    )
    .bind(status)
    .bind(error)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}
pub async fn cancel_run(pool: &SqlitePool, id: &str, now: &str) -> Result<bool, sqlx::Error> {
    sqlx::query("UPDATE automation_runs SET status='cancelled',finished_at=? WHERE id=? AND status IN('queued','running')").bind(now).bind(id).execute(pool).await.map(|r|r.rows_affected()==1)
}
pub async fn run_cancelled(pool: &SqlitePool, id: &str) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT status='cancelled' FROM automation_runs WHERE id=?")
        .bind(id)
        .fetch_one(pool)
        .await
}
pub async fn recover_runs(pool: &SqlitePool, now: &str) -> Result<u64, sqlx::Error> {
    sqlx::query("UPDATE automation_runs SET status='failed',error='Interrupted by service restart',finished_at=? WHERE status='running'").bind(now).execute(pool).await.map(|r|r.rows_affected())
}
#[allow(clippy::too_many_arguments)]
pub async fn insert_run_step(
    pool: &SqlitePool,
    run_id: &str,
    index: i64,
    action: &str,
    status: &str,
    duration: i64,
    message: Option<&str>,
    now: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO automation_run_steps(run_id,step_index,action,status,duration_ms,message,created_at) VALUES(?,?,?,?,?,?,?)").bind(run_id).bind(index).bind(action).bind(status).bind(duration).bind(message).bind(now).execute(pool).await?;
    Ok(())
}
pub async fn run_steps(pool: &SqlitePool, id: &str) -> Result<Vec<RunStep>, sqlx::Error> {
    sqlx::query_as("SELECT id,run_id,step_index,action,status,duration_ms,message,created_at FROM automation_run_steps WHERE run_id=? ORDER BY step_index,id").bind(id).fetch_all(pool).await
}
pub async fn insert_artifact(
    pool: &SqlitePool,
    id: &str,
    run_id: &str,
    kind: &str,
    file_name: &str,
    now: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO automation_artifacts(id,run_id,kind,file_name,created_at) VALUES(?,?,?,?,?)",
    )
    .bind(id)
    .bind(run_id)
    .bind(kind)
    .bind(file_name)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(())
}
pub async fn artifact(
    pool: &SqlitePool,
    id: &str,
    run_id: &str,
) -> Result<Option<Artifact>, sqlx::Error> {
    sqlx::query_as("SELECT id,run_id,kind,file_name,created_at FROM automation_artifacts WHERE id=? AND run_id=?").bind(id).bind(run_id).fetch_optional(pool).await
}
pub async fn artifacts(pool: &SqlitePool, run_id: &str) -> Result<Vec<Artifact>, sqlx::Error> {
    sqlx::query_as("SELECT id,run_id,kind,file_name,created_at FROM automation_artifacts WHERE run_id=? ORDER BY created_at,id")
        .bind(run_id)
        .fetch_all(pool)
        .await
}

pub async fn schedules(pool: &SqlitePool) -> Result<Vec<Schedule>, sqlx::Error> {
    sqlx::query_as("SELECT id,name,flow_id,account_id,cron,input_json,enabled,next_run_at,created_at,updated_at FROM automation_schedules ORDER BY created_at DESC").fetch_all(pool).await
}
#[allow(clippy::too_many_arguments)]
pub async fn insert_schedule(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    flow_id: &str,
    account_id: Option<&str>,
    cron: &str,
    input: &str,
    enabled: bool,
    next: &str,
    now: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO automation_schedules(id,name,flow_id,account_id,cron,input_json,enabled,next_run_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id).bind(name).bind(flow_id).bind(account_id).bind(cron).bind(input).bind(enabled).bind(next).bind(now).bind(now).execute(pool).await?;
    Ok(())
}
pub async fn delete_schedule(pool: &SqlitePool, id: &str) -> Result<bool, sqlx::Error> {
    sqlx::query("DELETE FROM automation_schedules WHERE id=?")
        .bind(id)
        .execute(pool)
        .await
        .map(|r| r.rows_affected() == 1)
}
#[allow(clippy::too_many_arguments)]
pub async fn update_schedule(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    flow_id: &str,
    account_id: Option<&str>,
    cron: &str,
    input: &str,
    enabled: bool,
    next: &str,
    now: &str,
) -> Result<bool, sqlx::Error> {
    sqlx::query("UPDATE automation_schedules SET name=?,flow_id=?,account_id=?,cron=?,input_json=?,enabled=?,next_run_at=?,updated_at=? WHERE id=?")
        .bind(name).bind(flow_id).bind(account_id).bind(cron).bind(input).bind(enabled).bind(next).bind(now).bind(id)
        .execute(pool).await.map(|result| result.rows_affected() == 1)
}
pub async fn due_schedules(pool: &SqlitePool, now: &str) -> Result<Vec<Schedule>, sqlx::Error> {
    sqlx::query_as("SELECT id,name,flow_id,account_id,cron,input_json,enabled,next_run_at,created_at,updated_at FROM automation_schedules WHERE enabled=1 AND next_run_at<=? ORDER BY next_run_at LIMIT 20").bind(now).fetch_all(pool).await
}
pub async fn schedule_tick(
    pool: &SqlitePool,
    schedule: &Schedule,
    scheduled_at: &str,
    next: &str,
    run_id: &str,
    now: &str,
) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let inserted=sqlx::query("INSERT OR IGNORE INTO automation_schedule_ticks(schedule_id,scheduled_at,run_id) VALUES(?,?,?)").bind(&schedule.id).bind(scheduled_at).bind(run_id).execute(&mut *tx).await?.rows_affected()==1;
    if inserted {
        sqlx::query("INSERT INTO automation_runs(id,flow_id,account_id,schedule_id,status,input_json,created_at) VALUES(?,?,?,?,'queued',?,?)").bind(run_id).bind(&schedule.flow_id).bind(&schedule.account_id).bind(&schedule.id).bind(&schedule.input_json).bind(now).execute(&mut *tx).await?;
    }
    sqlx::query("UPDATE automation_schedules SET next_run_at=?,updated_at=? WHERE id=?")
        .bind(next)
        .bind(now)
        .bind(&schedule.id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(inserted)
}

pub async fn settings(pool: &SqlitePool) -> Result<Settings, sqlx::Error> {
    sqlx::query_as("SELECT run_retention_days,artifact_retention_days,default_step_timeout_seconds,max_run_timeout_seconds,updated_at FROM automation_settings WHERE singleton=1").fetch_one(pool).await
}
pub async fn update_settings(
    pool: &SqlitePool,
    input: &UpdateSettings,
    now: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE automation_settings SET run_retention_days=?,artifact_retention_days=?,default_step_timeout_seconds=?,max_run_timeout_seconds=?,updated_at=? WHERE singleton=1").bind(input.run_retention_days).bind(input.artifact_retention_days).bind(input.default_step_timeout_seconds).bind(input.max_run_timeout_seconds).bind(now).execute(pool).await?;
    Ok(())
}

pub async fn expired_artifacts(
    pool: &SqlitePool,
    cutoff: &str,
) -> Result<Vec<Artifact>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id,run_id,kind,file_name,created_at FROM automation_artifacts WHERE created_at<?",
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await
}

pub async fn cleanup_retention(
    pool: &SqlitePool,
    artifact_cutoff: &str,
    run_cutoff: &str,
) -> Result<(u64, u64), sqlx::Error> {
    let artifacts = sqlx::query("DELETE FROM automation_artifacts WHERE created_at<?")
        .bind(artifact_cutoff)
        .execute(pool)
        .await?
        .rows_affected();
    let runs = sqlx::query("DELETE FROM automation_runs WHERE created_at<? AND status IN('succeeded','failed','cancelled')")
        .bind(run_cutoff)
        .execute(pool)
        .await?
        .rows_affected();
    Ok((artifacts, runs))
}
