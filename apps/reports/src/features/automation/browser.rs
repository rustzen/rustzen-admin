use std::time::{Duration, Instant};

use chromiumoxide::{
    browser::{Browser, BrowserConfig},
    cdp::browser_protocol::page::CaptureScreenshotFormat,
    page::{Page, ScreenshotParams},
};
use chrono::Utc;
use futures::StreamExt;
use serde_json::Value;
use uuid::Uuid;

use crate::{app::AppState, common::error::AppError};

use super::{
    repo, service,
    types::{Flow, FlowStep, Run, System},
};

struct ExecutionContext<'a> {
    state: &'a AppState,
    run: &'a Run,
    system: &'a System,
    page: &'a Page,
    input: &'a Value,
}

pub async fn execute(
    state: &AppState,
    run: &Run,
    flow: &Flow,
    system: &System,
) -> Result<(), AppError> {
    let mut builder = BrowserConfig::builder();
    if let Some(path) = state.browser_path.as_deref() {
        builder = builder.chrome_executable(path);
    }
    if !state.headless {
        builder = builder.with_head();
    }
    let config = builder.build().map_err(AppError::internal)?;
    let (mut browser, mut handler) = Browser::launch(config).await.map_err(AppError::internal)?;
    let handle = tokio::spawn(async move {
        while let Some(result) = handler.next().await {
            if result.is_err() {
                break;
            }
        }
    });
    let page = browser.new_page(&system.base_url).await.map_err(AppError::internal)?;
    let input: Value = serde_json::from_str(&run.input_json)?;
    let context = ExecutionContext { state, run, system, page: &page, input: &input };
    if let Err(error) = save_live_frame(state, &page, &run.id).await {
        tracing::warn!(run_id = %run.id, %error, "Initial live frame capture failed");
    }
    let result = execute_steps(&context, flow).await;
    if result.is_err() {
        let _ = save_screenshot(state, &page, &run.id, "failure").await;
    }
    let _ = browser.close().await;
    let _ = handle.await;
    result
}

async fn execute_steps(context: &ExecutionContext<'_>, flow: &Flow) -> Result<(), AppError> {
    let settings = repo::settings(&context.state.pool).await?;
    for (index, step) in flow.steps.iter().enumerate() {
        if repo::run_cancelled(&context.state.pool, &context.run.id).await? {
            return Err(AppError::Conflict("run cancelled".into()));
        }
        let started = Instant::now();
        let result = tokio::time::timeout(
            Duration::from_secs(settings.default_step_timeout_seconds as u64),
            execute_step(context, step),
        )
        .await;
        let duration = i64::try_from(started.elapsed().as_millis()).unwrap_or(i64::MAX);
        let outcome = match result {
            Ok(result) => result,
            Err(_) => Err(AppError::Internal),
        };
        let (message, status) = match &outcome {
            Ok(()) => (None, "succeeded"),
            Err(error) => (Some(error.to_string()), "failed"),
        };
        repo::insert_run_step(
            &context.state.pool,
            &context.run.id,
            index as i64,
            step.action(),
            status,
            duration,
            message.as_deref(),
            &Utc::now().to_rfc3339(),
        )
        .await?;
        if let Err(error) = save_live_frame(context.state, context.page, &context.run.id).await {
            tracing::warn!(run_id = %context.run.id, %error, "Live frame capture failed");
        }
        outcome?;
    }
    Ok(())
}

async fn save_live_frame(state: &AppState, page: &Page, run_id: &str) -> Result<(), AppError> {
    let artifact_id = format!("{run_id}-live");
    let file_name = "live.png";
    let dir = state.output_dir.join(run_id);
    tokio::fs::create_dir_all(&dir).await?;
    let bytes = page
        .screenshot(ScreenshotParams::builder().format(CaptureScreenshotFormat::Png).build())
        .await
        .map_err(AppError::internal)?;
    let temporary = dir.join(format!("live-{}.tmp", Uuid::new_v4()));
    tokio::fs::write(&temporary, bytes).await?;
    if let Err(error) = tokio::fs::rename(&temporary, dir.join(file_name)).await {
        let _ = tokio::fs::remove_file(&temporary).await;
        return Err(error.into());
    }
    repo::upsert_live_artifact(
        &state.pool,
        &artifact_id,
        run_id,
        file_name,
        &Utc::now().to_rfc3339(),
    )
    .await?;
    Ok(())
}

async fn execute_step(context: &ExecutionContext<'_>, step: &FlowStep) -> Result<(), AppError> {
    match step {
        FlowStep::Goto { url } => {
            let value = service::substitute(url, context.input)?;
            let base = url::Url::parse(&context.system.base_url).map_err(AppError::internal)?;
            let target = service::goto_target(&base, &value)?;
            context.page.goto(target.as_str()).await.map_err(AppError::internal)?;
        }
        FlowStep::Fill { selector, value } => {
            let element = context.page.find_element(selector).await.map_err(AppError::internal)?;
            let value = service::substitute(value, context.input)?;
            let encoded = serde_json::to_string(&value)?;
            element
                .call_js_fn(
                    format!(
                        "function() {{ this.value = {encoded}; this.dispatchEvent(new Event('input', {{ bubbles: true }})); this.dispatchEvent(new Event('change', {{ bubbles: true }})); }}"
                    ),
                    false,
                )
                .await
                .map_err(AppError::internal)?;
        }
        FlowStep::Click { selector } => {
            context
                .page
                .find_element(selector)
                .await
                .map_err(AppError::internal)?
                .click()
                .await
                .map_err(AppError::internal)?;
        }
        FlowStep::WaitFor { selector } => wait_for(context.page, selector).await?,
        FlowStep::AssertText { selector, text } => {
            let actual = context
                .page
                .find_element(selector)
                .await
                .map_err(AppError::internal)?
                .inner_text()
                .await
                .map_err(AppError::internal)?;
            let expected = service::substitute(text, context.input)?;
            if !actual.is_some_and(|actual| actual.contains(&expected)) {
                return Err(AppError::Conflict("assertText did not match".into()));
            }
        }
        FlowStep::Screenshot { name } => {
            save_screenshot(
                context.state,
                context.page,
                &context.run.id,
                name.as_deref().unwrap_or("screenshot"),
            )
            .await?;
        }
    }
    Ok(())
}

async fn wait_for(page: &Page, selector: &str) -> Result<(), AppError> {
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        if page.find_element(selector).await.is_ok() {
            return Ok(());
        }
        if Instant::now() >= deadline {
            return Err(AppError::Conflict("waitFor selector timed out".into()));
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

async fn save_screenshot(
    state: &AppState,
    page: &Page,
    run_id: &str,
    name: &str,
) -> Result<(), AppError> {
    let id = Uuid::new_v4().to_string();
    let safe: String = name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(60)
        .collect();
    let file_name = format!("{}-{}.png", if safe.is_empty() { "screenshot" } else { &safe }, id);
    let dir = state.output_dir.join(run_id);
    tokio::fs::create_dir_all(&dir).await?;
    let bytes = page
        .screenshot(
            ScreenshotParams::builder()
                .format(CaptureScreenshotFormat::Png)
                .full_page(true)
                .build(),
        )
        .await
        .map_err(AppError::internal)?;
    tokio::fs::write(dir.join(&file_name), bytes).await?;
    repo::insert_artifact(
        &state.pool,
        &id,
        run_id,
        "screenshot",
        &file_name,
        &Utc::now().to_rfc3339(),
    )
    .await?;
    Ok(())
}
