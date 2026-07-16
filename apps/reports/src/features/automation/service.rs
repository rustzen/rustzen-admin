use std::str::FromStr;

use chrono::Utc;
use croner::Cron;
use rustzen_storage::SqlitePool;
use serde_json::Value;
use url::Url;
use uuid::Uuid;

use crate::{app::AppState, common::error::AppError};

use super::{repo, types::*};

pub async fn systems(pool: &SqlitePool) -> Result<Vec<System>, AppError> {
    Ok(repo::systems(pool).await?)
}
pub async fn create_system(pool: &SqlitePool, input: SaveSystem) -> Result<System, AppError> {
    let (id, name, url, enabled, notes, now) = validated_system(input)?;
    repo::insert_system(pool, &id, &name, &url, enabled, &notes, &now).await?;
    system(pool, &id).await
}
pub async fn update_system(
    pool: &SqlitePool,
    id: &str,
    input: SaveSystem,
) -> Result<System, AppError> {
    let (_, name, url, enabled, notes, now) = validated_system(input)?;
    if !repo::update_system(pool, id, &name, &url, enabled, &notes, &now).await? {
        return Err(AppError::NotFound("system not found".into()));
    }
    system(pool, id).await
}
pub async fn system(pool: &SqlitePool, id: &str) -> Result<System, AppError> {
    repo::system(pool, id).await?.ok_or_else(|| AppError::NotFound("system not found".into()))
}
pub async fn delete_system(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    match repo::delete_system(pool, id).await {
        Ok(true) => Ok(()),
        Ok(false) => Err(AppError::NotFound("system not found".into())),
        Err(sqlx::Error::Database(error)) if error.is_foreign_key_violation() => {
            Err(AppError::Conflict("system is still referenced".into()))
        }
        Err(error) => Err(error.into()),
    }
}

fn validated_system(
    input: SaveSystem,
) -> Result<(String, String, String, bool, String, String), AppError> {
    let name = required(input.name, "name", 100)?;
    let parsed = Url::parse(input.base_url.trim())
        .map_err(|_| AppError::InvalidInput("baseUrl must be an absolute HTTP/HTTPS URL".into()))?;
    if !matches!(parsed.scheme(), "http" | "https")
        || parsed.host_str().is_none()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err(AppError::InvalidInput("baseUrl must be an HTTP/HTTPS origin".into()));
    }
    let origin = parsed.origin().ascii_serialization();
    Ok((
        Uuid::new_v4().to_string(),
        name,
        origin,
        input.enabled.unwrap_or(true),
        input.notes.unwrap_or_default().trim().chars().take(1000).collect(),
        Utc::now().to_rfc3339(),
    ))
}

pub async fn accounts(
    pool: &SqlitePool,
    system_id: Option<&str>,
) -> Result<Vec<Account>, AppError> {
    Ok(repo::accounts(pool, system_id).await?)
}
pub async fn create_account(state: &AppState, input: SaveAccount) -> Result<Account, AppError> {
    system(&state.pool, &input.system_id).await?;
    let secret = input
        .secret
        .as_deref()
        .filter(|v| !v.is_empty())
        .ok_or_else(|| AppError::InvalidInput("secret is required".into()))?;
    let (ciphertext, nonce) = state.cipher.encrypt(secret)?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    repo::insert_account(
        &state.pool,
        &id,
        &input.system_id,
        &required(input.name, "name", 100)?,
        &required(input.username, "username", 200)?,
        &ciphertext,
        &nonce,
        &now,
    )
    .await?;
    account_public(&state.pool, &id).await
}
pub async fn update_account(
    state: &AppState,
    id: &str,
    input: SaveAccount,
) -> Result<Account, AppError> {
    system(&state.pool, &input.system_id).await?;
    let encrypted = input
        .secret
        .as_deref()
        .filter(|v| !v.is_empty())
        .map(|v| state.cipher.encrypt(v))
        .transpose()?;
    let refs = encrypted.as_ref().map(|(a, b)| (a.as_str(), b.as_str()));
    if !repo::update_account(
        &state.pool,
        id,
        &input.system_id,
        &required(input.name, "name", 100)?,
        &required(input.username, "username", 200)?,
        refs,
        &Utc::now().to_rfc3339(),
    )
    .await?
    {
        return Err(AppError::NotFound("account not found".into()));
    }
    account_public(&state.pool, id).await
}
async fn account_public(pool: &SqlitePool, id: &str) -> Result<Account, AppError> {
    repo::accounts(pool, None)
        .await?
        .into_iter()
        .find(|a| a.id == id)
        .ok_or_else(|| AppError::NotFound("account not found".into()))
}
pub async fn delete_account(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    match repo::delete_account(pool, id).await {
        Ok(true) => Ok(()),
        Ok(false) => Err(AppError::NotFound("account not found".into())),
        Err(sqlx::Error::Database(error)) if error.is_foreign_key_violation() => {
            Err(AppError::Conflict("account is still referenced".into()))
        }
        Err(error) => Err(error.into()),
    }
}

pub async fn flows(pool: &SqlitePool, system_id: Option<&str>) -> Result<Vec<Flow>, AppError> {
    repo::flows(pool, system_id)
        .await?
        .into_iter()
        .map(Flow::try_from)
        .collect::<Result<_, _>>()
        .map_err(AppError::internal)
}
pub async fn flow(pool: &SqlitePool, id: &str) -> Result<Flow, AppError> {
    repo::flow(pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound("flow not found".into()))?
        .try_into()
        .map_err(AppError::internal)
}
pub async fn create_flow(pool: &SqlitePool, input: SaveFlow) -> Result<Flow, AppError> {
    let system = system(pool, &input.system_id).await?;
    validate_flow(&system, &input.steps)?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    repo::insert_flow(
        pool,
        &id,
        &input.system_id,
        &required(input.name, "name", 100)?,
        &serde_json::to_string(&input.steps)?,
        &now,
    )
    .await?;
    flow(pool, &id).await
}
pub async fn update_flow(pool: &SqlitePool, id: &str, input: SaveFlow) -> Result<Flow, AppError> {
    let system = system(pool, &input.system_id).await?;
    validate_flow(&system, &input.steps)?;
    if !repo::update_flow(
        pool,
        id,
        &input.system_id,
        &required(input.name, "name", 100)?,
        &serde_json::to_string(&input.steps)?,
        &Utc::now().to_rfc3339(),
    )
    .await?
    {
        return Err(AppError::NotFound("flow not found".into()));
    }
    flow(pool, id).await
}
pub async fn delete_flow(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    match repo::delete_flow(pool, id).await {
        Ok(true) => Ok(()),
        Ok(false) => Err(AppError::NotFound("flow not found".into())),
        Err(sqlx::Error::Database(error)) if error.is_foreign_key_violation() => {
            Err(AppError::Conflict("flow is still referenced".into()))
        }
        Err(error) => Err(error.into()),
    }
}

fn validate_flow(system: &System, steps: &[FlowStep]) -> Result<(), AppError> {
    if steps.is_empty() || steps.len() > 100 {
        return Err(AppError::InvalidInput("flow must contain 1 to 100 steps".into()));
    }
    let base = Url::parse(&system.base_url).map_err(AppError::internal)?;
    for step in steps {
        match step {
            FlowStep::Goto { url } => {
                goto_target(&base, url)?;
            }
            FlowStep::Fill { selector, value } => {
                validate_selector(selector)?;
                if value.len() > 4000 {
                    return Err(AppError::InvalidInput("fill value is too long".into()));
                }
            }
            FlowStep::Click { selector } | FlowStep::WaitFor { selector } => {
                validate_selector(selector)?
            }
            FlowStep::AssertText { selector, text } => {
                validate_selector(selector)?;
                if text.len() > 1000 {
                    return Err(AppError::InvalidInput("asserted text is too long".into()));
                }
            }
            FlowStep::Screenshot { name } => {
                if name.as_ref().is_some_and(|v| v.len() > 100) {
                    return Err(AppError::InvalidInput("screenshot name is too long".into()));
                }
            }
        }
    }
    Ok(())
}

pub(crate) fn goto_target(base: &Url, value: &str) -> Result<Url, AppError> {
    let target = base.join(value).map_err(|_| AppError::InvalidInput("invalid goto URL".into()))?;
    if target.origin() != base.origin() {
        return Err(AppError::InvalidInput("goto must remain on the system origin".into()));
    }
    Ok(target)
}

fn validate_selector(selector: &str) -> Result<(), AppError> {
    if selector.trim().is_empty() || selector.len() > 500 {
        return Err(AppError::InvalidInput("selector must contain 1 to 500 characters".into()));
    }
    Ok(())
}

pub async fn create_run(pool: &SqlitePool, input: CreateRun) -> Result<Run, AppError> {
    let flow = flow(pool, &input.flow_id).await?;
    if !input.input.is_object() {
        return Err(AppError::InvalidInput("input must be an object".into()));
    }
    if let Some(id) = input.account_id.as_deref() {
        let account = repo::account_secret(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound("account not found".into()))?;
        if account.system_id != flow.system_id {
            return Err(AppError::InvalidInput("account must belong to the flow's system".into()));
        }
    }
    let id = Uuid::new_v4().to_string();
    repo::insert_run(
        pool,
        &id,
        &input.flow_id,
        input.account_id.as_deref(),
        None,
        &serde_json::to_string(&input.input)?,
        &Utc::now().to_rfc3339(),
    )
    .await?;
    run(pool, &id).await
}
pub async fn runs(pool: &SqlitePool, query: ListQuery) -> Result<Page<Run>, AppError> {
    let (current, size) = pagination(query.current, query.page_size)?;
    let (data, total) =
        repo::runs(pool, (current - 1) * size, size, query.status.as_deref()).await?;
    Ok(Page { data, total, success: true })
}
pub async fn run(pool: &SqlitePool, id: &str) -> Result<Run, AppError> {
    repo::run(pool, id).await?.ok_or_else(|| AppError::NotFound("run not found".into()))
}
pub async fn cancel_run(pool: &SqlitePool, id: &str) -> Result<Run, AppError> {
    if !repo::cancel_run(pool, id, &Utc::now().to_rfc3339()).await? {
        return Err(AppError::Conflict("only queued or running runs can be cancelled".into()));
    }
    run(pool, id).await
}

pub async fn schedules(pool: &SqlitePool) -> Result<Vec<Schedule>, AppError> {
    Ok(repo::schedules(pool).await?)
}
pub async fn create_schedule(pool: &SqlitePool, input: SaveSchedule) -> Result<Schedule, AppError> {
    save_schedule(pool, None, input).await
}
pub async fn update_schedule(
    pool: &SqlitePool,
    id: &str,
    input: SaveSchedule,
) -> Result<Schedule, AppError> {
    save_schedule(pool, Some(id), input).await
}
async fn save_schedule(
    pool: &SqlitePool,
    id: Option<&str>,
    input: SaveSchedule,
) -> Result<Schedule, AppError> {
    let flow = flow(pool, &input.flow_id).await?;
    if !input.input.is_object() {
        return Err(AppError::InvalidInput("input must be an object".into()));
    }
    if let Some(account_id) = input.account_id.as_deref() {
        let account = repo::account_secret(pool, account_id)
            .await?
            .ok_or_else(|| AppError::NotFound("account not found".into()))?;
        if account.system_id != flow.system_id {
            return Err(AppError::InvalidInput("account must belong to the flow's system".into()));
        }
    }
    let cron = Cron::from_str(input.cron.trim())
        .map_err(|_| AppError::InvalidInput("invalid cron expression".into()))?;
    let next =
        cron.find_next_occurrence(&Utc::now(), false).map_err(AppError::internal)?.to_rfc3339();
    let new_id = Uuid::new_v4().to_string();
    let id = id.unwrap_or(&new_id);
    let now = Utc::now().to_rfc3339();
    let name = required(input.name, "name", 100)?;
    let input_json = serde_json::to_string(&input.input)?;
    let enabled = input.enabled.unwrap_or(true);
    if id == new_id {
        repo::insert_schedule(
            pool,
            id,
            &name,
            &input.flow_id,
            input.account_id.as_deref(),
            input.cron.trim(),
            &input_json,
            enabled,
            &next,
            &now,
        )
        .await?;
    } else if !repo::update_schedule(
        pool,
        id,
        &name,
        &input.flow_id,
        input.account_id.as_deref(),
        input.cron.trim(),
        &input_json,
        enabled,
        &next,
        &now,
    )
    .await?
    {
        return Err(AppError::NotFound("schedule not found".into()));
    }
    repo::schedules(pool)
        .await?
        .into_iter()
        .find(|schedule| schedule.id == id)
        .ok_or_else(|| AppError::NotFound("schedule not found".into()))
}
pub async fn delete_schedule(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    if !repo::delete_schedule(pool, id).await? {
        return Err(AppError::NotFound("schedule not found".into()));
    }
    Ok(())
}

pub async fn settings(state: &AppState) -> Result<RuntimeSettings, AppError> {
    Ok(RuntimeSettings {
        settings: repo::settings(&state.pool).await?,
        max_concurrency: state.max_concurrency,
        headless: state.headless,
        browser_configured: state.browser_path.is_some(),
    })
}
pub async fn update_settings(
    state: &AppState,
    input: UpdateSettings,
) -> Result<RuntimeSettings, AppError> {
    if !(1..=3650).contains(&input.run_retention_days)
        || !(1..=3650).contains(&input.artifact_retention_days)
        || !(1..=300).contains(&input.default_step_timeout_seconds)
        || !(1..=3600).contains(&input.max_run_timeout_seconds)
        || input.default_step_timeout_seconds > input.max_run_timeout_seconds
    {
        return Err(AppError::InvalidInput("invalid Automation settings".into()));
    }
    repo::update_settings(&state.pool, &input, &Utc::now().to_rfc3339()).await?;
    settings(state).await
}

pub fn substitute(
    value: &str,
    input: &Value,
    username: Option<&str>,
    password: Option<&str>,
) -> Result<String, AppError> {
    let mut out = value.to_string();
    if out.contains("{{account.username}}") {
        out = out.replace(
            "{{account.username}}",
            username
                .ok_or_else(|| AppError::InvalidInput("run requires an account username".into()))?,
        );
    }
    if out.contains("{{account.password}}") {
        out = out.replace(
            "{{account.password}}",
            password
                .ok_or_else(|| AppError::InvalidInput("run requires an account password".into()))?,
        );
    }
    while let Some(start) = out.find("{{input.") {
        let tail = &out[start + 8..];
        let end = tail
            .find("}}")
            .ok_or_else(|| AppError::InvalidInput("invalid input variable".into()))?;
        let key = &tail[..end];
        let replacement = input
            .get(key)
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::InvalidInput(format!("missing string input: {key}")))?;
        out.replace_range(start..start + 8 + end + 2, replacement);
    }
    Ok(out)
}
fn required(value: String, name: &str, max: usize) -> Result<String, AppError> {
    let value = value.trim().to_string();
    if value.is_empty() || value.len() > max {
        Err(AppError::InvalidInput(format!("{name} must contain 1 to {max} characters")))
    } else {
        Ok(value)
    }
}
fn pagination(current: Option<i64>, size: Option<i64>) -> Result<(i64, i64), AppError> {
    let current = current.unwrap_or(1);
    let size = size.unwrap_or(20);
    if current < 1 || !(1..=100).contains(&size) {
        Err(AppError::InvalidInput("invalid pagination".into()))
    } else {
        Ok((current, size))
    }
}

#[cfg(test)]
mod tests {
    use url::Url;

    use super::goto_target;

    #[test]
    fn substituted_goto_target_must_remain_on_the_system_origin() {
        let base = Url::parse("https://fixture.local").expect("base URL");
        assert!(goto_target(&base, "/relative").is_ok());
        assert!(goto_target(&base, "https://other.local/from-input").is_err());
    }
}
