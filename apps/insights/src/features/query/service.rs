use chrono::{DateTime, Duration, Utc};
use rustzen_storage::SqlitePool;

use crate::common::{api::Page, error::AppError};

use super::{
    repo::{self, Window},
    types::*,
};

pub async fn pages(pool: &SqlitePool, query: PageQuery) -> Result<Page<PageStat>, AppError> {
    let (from, to) = time_range(pool, query.from, query.to).await?;
    let (offset, limit) = pagination(query.current, query.page_size)?;
    let (data, total) = repo::pages(
        pool,
        &Window {
            project_id: required_project(&query.project_id)?,
            from: &from,
            to: &to,
            offset,
            limit,
        },
        clean_filter(query.path).as_deref(),
    )
    .await?;
    Ok(Page { data, total, success: true })
}

pub async fn apis(pool: &SqlitePool, query: ApiQuery) -> Result<Page<ApiStat>, AppError> {
    let (from, to) = time_range(pool, query.from, query.to).await?;
    let (offset, limit) = pagination(query.current, query.page_size)?;
    let window = Window {
        project_id: required_project(&query.project_id)?,
        from: &from,
        to: &to,
        offset,
        limit,
    };
    let (rows, total) = repo::apis(pool, &window, clean_filter(query.path).as_deref()).await?;
    let data = rows
        .into_iter()
        .map(|row| ApiStat {
            error_rate: if row.request_count == 0 {
                0.0
            } else {
                row.error_count as f64 / row.request_count as f64
            },
            p95_duration_ms: u64::try_from(row.p95_duration_ms).unwrap_or(0),
            api_path: row.api_path,
            api_method: row.api_method,
            request_count: row.request_count,
            error_count: row.error_count,
            average_duration_ms: row.average_duration_ms,
            last_seen_at: row.last_seen_at,
        })
        .collect();
    Ok(Page { data, total, success: true })
}

pub async fn events(pool: &SqlitePool, query: EventQuery) -> Result<Page<Event>, AppError> {
    let (from, to) = time_range(pool, query.from, query.to).await?;
    let (offset, limit) = pagination(query.current, query.page_size)?;
    let (rows, total) = repo::events(
        pool,
        &Window {
            project_id: required_project(&query.project_id)?,
            from: &from,
            to: &to,
            offset,
            limit,
        },
        clean_filter(query.event_name).as_deref(),
        clean_filter(query.visitor_id).as_deref(),
        clean_filter(query.platform).as_deref(),
    )
    .await?;
    let data = rows.into_iter().map(Event::try_from).collect::<Result<Vec<_>, _>>()?;
    Ok(Page { data, total, success: true })
}

pub async fn users(pool: &SqlitePool, query: UserQuery) -> Result<Page<UserStat>, AppError> {
    let (from, to) = time_range(pool, query.from, query.to).await?;
    let (offset, limit) = pagination(query.current, query.page_size)?;
    let (data, total) = repo::users(
        pool,
        &Window {
            project_id: required_project(&query.project_id)?,
            from: &from,
            to: &to,
            offset,
            limit,
        },
        clean_filter(query.keyword).as_deref(),
    )
    .await?;
    Ok(Page { data, total, success: true })
}

pub async fn user_events(
    pool: &SqlitePool,
    visitor_id: String,
    query: UserEventQuery,
) -> Result<Page<Event>, AppError> {
    events(
        pool,
        EventQuery {
            project_id: query.project_id,
            from: query.from,
            to: query.to,
            event_name: None,
            visitor_id: Some(visitor_id),
            platform: None,
            current: query.current,
            page_size: query.page_size,
        },
    )
    .await
}

async fn time_range(
    pool: &SqlitePool,
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
) -> Result<(String, String), AppError> {
    let settings = crate::features::settings::service::get(pool).await?;
    let to = to.unwrap_or_else(Utc::now);
    let from = from.unwrap_or_else(|| to - Duration::days(settings.default_query_days));
    if from > to || to - from > Duration::days(settings.max_query_days) {
        return Err(AppError::bad_request(format!(
            "query range must not exceed {} days",
            settings.max_query_days
        )));
    }
    Ok((from.to_rfc3339(), to.to_rfc3339()))
}

fn required_project(value: &str) -> Result<&str, AppError> {
    if value.trim().is_empty() {
        Err(AppError::bad_request("projectId is required"))
    } else {
        Ok(value)
    }
}

fn pagination(current: Option<i64>, page_size: Option<i64>) -> Result<(i64, i64), AppError> {
    let current = current.unwrap_or(1);
    let page_size = page_size.unwrap_or(20);
    if current < 1 || !(1..=100).contains(&page_size) {
        return Err(AppError::bad_request("invalid pagination"));
    }
    Ok(((current - 1) * page_size, page_size))
}

fn clean_filter(value: Option<String>) -> Option<String> {
    value.map(|value| value.trim().to_string()).filter(|value| !value.is_empty())
}
