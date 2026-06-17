use chrono::{DateTime, Duration, Utc};
use sqlx::{Sqlite, SqlitePool};

use crate::common::error::ServiceError;

use super::types::{
    TaskItem, TaskRow, TaskRunItem, TaskRunRow, TaskRunStatus, TaskSchedule, TaskTriggerType,
};

pub struct TaskRepository {
    pool: SqlitePool,
}

pub struct SyncTaskInput<'a> {
    pub task_key: &'a str,
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub cron_expression: &'a str,
    pub next_run_at: Option<DateTime<Utc>>,
}

pub struct InsertTaskRunInput<'a> {
    pub task_key: &'a str,
    pub trigger_type: &'a TaskTriggerType,
    pub status: TaskRunStatus,
    pub scheduled_for: Option<DateTime<Utc>>,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub error_message: Option<&'a str>,
}

pub struct FinishTaskRunInput<'a> {
    pub run_id: i64,
    pub task_key: &'a str,
    pub trigger_type: TaskTriggerType,
    pub status: TaskRunStatus,
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
    pub error_message: Option<&'a str>,
}

struct TaskRunSummaryUpdate<'a> {
    task_key: &'a str,
    run_id: i64,
    trigger_type: &'a str,
    status: &'a str,
    started_at: DateTime<Utc>,
    finished_at: Option<DateTime<Utc>>,
    error_message: Option<&'a str>,
}

impl TaskRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn fail_stale_running_task_runs(
        &self,
        finished_at: DateTime<Utc>,
    ) -> Result<(), ServiceError> {
        let mut tx = self.pool.begin().await.map_err(map_db_error)?;
        let rows: Vec<(i64, String, String, DateTime<Utc>)> = sqlx::query_as(
            r#"
            SELECT id, task_key, trigger_type, started_at
            FROM system_task_runs
            WHERE status = 'running'
            ORDER BY started_at, id
            "#,
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(map_db_error)?;

        for (run_id, task_key, trigger_type, started_at) in rows {
            sqlx::query(
                r#"
                UPDATE system_task_runs
                SET status = 'failed',
                    finished_at = ?,
                    error_message = 'Task process stopped before completion',
                    updated_at = ?
                WHERE id = ?
                "#,
            )
            .bind(finished_at)
            .bind(finished_at)
            .bind(run_id)
            .execute(&mut *tx)
            .await
            .map_err(map_db_error)?;

            update_task_summary_raw(
                &mut tx,
                TaskRunSummaryUpdate {
                    task_key: &task_key,
                    run_id,
                    trigger_type: &trigger_type,
                    status: "failed",
                    started_at,
                    finished_at: Some(finished_at),
                    error_message: Some("Task process stopped before completion"),
                },
            )
            .await?;
        }

        sqlx::query(
            r#"
            UPDATE system_tasks
            SET running = 0,
                last_status = CASE
                    WHEN last_status = 'running' THEN 'failed'
                    ELSE last_status
                END,
                last_finished_at = CASE
                    WHEN last_status = 'running' THEN ?
                    ELSE last_finished_at
                END,
                last_error_message = CASE
                    WHEN last_status = 'running' THEN 'Task process stopped before completion'
                    ELSE last_error_message
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE running = 1
            "#,
        )
        .bind(finished_at)
        .execute(&mut *tx)
        .await
        .map_err(map_db_error)?;

        tx.commit().await.map_err(map_db_error)?;
        Ok(())
    }

    pub async fn sync_tasks(&self, tasks: &[SyncTaskInput<'_>]) -> Result<(), ServiceError> {
        let mut tx = self.pool.begin().await.map_err(map_db_error)?;

        for task in tasks {
            sqlx::query(
                r#"
                INSERT INTO system_tasks (
                    task_key, name, description, schedule_type, schedule_json,
                    enabled, next_run_at, created_at, updated_at
                ) VALUES (?, ?, ?, 'cron', ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(task_key) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    schedule_type = excluded.schedule_type,
                    schedule_json = excluded.schedule_json,
                    enabled = 1,
                    next_run_at = excluded.next_run_at,
                    updated_at = CURRENT_TIMESTAMP
                "#,
            )
            .bind(task.task_key)
            .bind(task.name)
            .bind(task.description)
            .bind(task.cron_expression)
            .bind(task.next_run_at)
            .execute(&mut *tx)
            .await
            .map_err(map_db_error)?;
        }

        tx.commit().await.map_err(map_db_error)?;
        Ok(())
    }

    pub async fn list_tasks(&self) -> Result<Vec<TaskItem>, ServiceError> {
        let rows: Vec<TaskRow> = sqlx::query_as(
            r#"
            SELECT task_key, name, description, enabled, running,
                   last_run_id, last_trigger_type, last_status,
                   last_started_at, last_finished_at, last_error_message,
                   next_run_at, schedule_json, created_at, updated_at
            FROM system_tasks
            ORDER BY id
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_error)?;

        rows.into_iter().map(row_to_task_item).collect()
    }

    pub async fn list_task_runs(
        &self,
        task_key: &str,
        offset: i64,
        limit: i64,
    ) -> Result<(Vec<TaskRunItem>, i64), ServiceError> {
        let total = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM system_task_runs WHERE task_key = ?",
        )
        .bind(task_key)
        .fetch_one(&self.pool)
        .await
        .map_err(map_db_error)?;

        let rows: Vec<TaskRunRow> = sqlx::query_as(
            r#"
            SELECT id, task_key, trigger_type, status, scheduled_for, started_at,
                   finished_at, error_message, created_at, updated_at
            FROM system_task_runs
            WHERE task_key = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            "#,
        )
        .bind(task_key)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_error)?;

        let items = rows.into_iter().map(row_to_task_run_item).collect::<Result<Vec<_>, _>>()?;
        Ok((items, total))
    }

    pub async fn update_task_next_run_at(
        &self,
        task_key: &str,
        next_run_at: Option<DateTime<Utc>>,
    ) -> Result<(), ServiceError> {
        sqlx::query(
            "UPDATE system_tasks SET next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE task_key = ?",
        )
        .bind(next_run_at)
        .bind(task_key)
        .execute(&self.pool)
        .await
        .map_err(map_db_error)?;
        Ok(())
    }

    pub async fn insert_task_run(
        &self,
        input: InsertTaskRunInput<'_>,
    ) -> Result<TaskRunItem, ServiceError> {
        let mut tx = self.pool.begin().await.map_err(map_db_error)?;
        let row: TaskRunRow = sqlx::query_as(
            r#"
            INSERT INTO system_task_runs (
                task_key, trigger_type, status, scheduled_for, started_at,
                finished_at, error_message, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id, task_key, trigger_type, status, scheduled_for, started_at,
                      finished_at, error_message, created_at, updated_at
            "#,
        )
        .bind(input.task_key)
        .bind(trigger_type_to_str(input.trigger_type))
        .bind(task_status_to_str(input.status))
        .bind(input.scheduled_for)
        .bind(input.started_at)
        .bind(input.finished_at)
        .bind(input.error_message)
        .bind(input.started_at)
        .bind(input.started_at)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_db_error)?;

        update_task_summary(
            &mut tx,
            TaskRunSummaryUpdate {
                task_key: input.task_key,
                run_id: row.id,
                trigger_type: trigger_type_to_str(input.trigger_type),
                status: task_status_to_str(input.status),
                started_at: input.started_at,
                finished_at: input.finished_at,
                error_message: input.error_message,
            },
        )
        .await?;

        tx.commit().await.map_err(map_db_error)?;
        row_to_task_run_item(row)
    }

    pub async fn insert_skipped_task_run(
        &self,
        input: InsertTaskRunInput<'_>,
    ) -> Result<TaskRunItem, ServiceError> {
        let row: TaskRunRow = sqlx::query_as(
            r#"
            INSERT INTO system_task_runs (
                task_key, trigger_type, status, scheduled_for, started_at,
                finished_at, error_message, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id, task_key, trigger_type, status, scheduled_for, started_at,
                      finished_at, error_message, created_at, updated_at
            "#,
        )
        .bind(input.task_key)
        .bind(trigger_type_to_str(input.trigger_type))
        .bind(task_status_to_str(input.status))
        .bind(input.scheduled_for)
        .bind(input.started_at)
        .bind(input.finished_at)
        .bind(input.error_message)
        .bind(input.started_at)
        .bind(input.started_at)
        .fetch_one(&self.pool)
        .await
        .map_err(map_db_error)?;

        row_to_task_run_item(row)
    }

    pub async fn finish_task_run(
        &self,
        input: FinishTaskRunInput<'_>,
    ) -> Result<TaskRunItem, ServiceError> {
        let mut tx = self.pool.begin().await.map_err(map_db_error)?;
        let row: TaskRunRow = sqlx::query_as(
            r#"
            UPDATE system_task_runs
            SET status = ?, finished_at = ?, error_message = ?, updated_at = ?
            WHERE id = ?
            RETURNING id, task_key, trigger_type, status, scheduled_for, started_at,
                      finished_at, error_message, created_at, updated_at
            "#,
        )
        .bind(task_status_to_str(input.status))
        .bind(input.finished_at)
        .bind(input.error_message)
        .bind(input.finished_at)
        .bind(input.run_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_db_error)?;

        update_task_summary(
            &mut tx,
            TaskRunSummaryUpdate {
                task_key: input.task_key,
                run_id: input.run_id,
                trigger_type: trigger_type_to_str(&input.trigger_type),
                status: task_status_to_str(input.status),
                started_at: input.started_at,
                finished_at: Some(input.finished_at),
                error_message: input.error_message,
            },
        )
        .await?;

        tx.commit().await.map_err(map_db_error)?;
        row_to_task_run_item(row)
    }

    pub async fn cleanup_old_task_runs(&self, retention_days: i64) -> Result<u64, ServiceError> {
        let cutoff = Utc::now() - Duration::days(retention_days.max(1));
        let result = sqlx::query("DELETE FROM system_task_runs WHERE created_at < ?")
            .bind(cutoff)
            .execute(&self.pool)
            .await
            .map_err(map_db_error)?;
        Ok(result.rows_affected())
    }
}

async fn update_task_summary(
    tx: &mut sqlx::Transaction<'_, Sqlite>,
    input: TaskRunSummaryUpdate<'_>,
) -> Result<(), ServiceError> {
    update_task_summary_raw(tx, input).await
}

async fn update_task_summary_raw(
    tx: &mut sqlx::Transaction<'_, Sqlite>,
    input: TaskRunSummaryUpdate<'_>,
) -> Result<(), ServiceError> {
    let running = if input.status == "running" { 1 } else { 0 };
    sqlx::query(
        r#"
        UPDATE system_tasks
        SET running = ?,
            last_run_id = ?,
            last_trigger_type = ?,
            last_status = ?,
            last_started_at = ?,
            last_finished_at = ?,
            last_error_message = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE task_key = ?
        "#,
    )
    .bind(running)
    .bind(input.run_id)
    .bind(input.trigger_type)
    .bind(input.status)
    .bind(input.started_at)
    .bind(input.finished_at)
    .bind(input.error_message)
    .bind(input.task_key)
    .execute(&mut **tx)
    .await
    .map_err(map_db_error)?;
    Ok(())
}

fn row_to_task_item(row: TaskRow) -> Result<TaskItem, ServiceError> {
    Ok(TaskItem {
        task_key: row.task_key,
        name: row.name,
        description: row.description,
        enabled: row.enabled != 0,
        schedule: TaskSchedule::Cron { expression: row.schedule_json },
        running: row.running != 0,
        last_run_id: row.last_run_id,
        last_trigger_type: row
            .last_trigger_type
            .as_deref()
            .map(trigger_type_from_str)
            .transpose()?,
        last_status: row.last_status.as_deref().map(task_status_from_str).transpose()?,
        last_started_at: row.last_started_at,
        last_finished_at: row.last_finished_at,
        last_error_message: row.last_error_message,
        next_run_at: row.next_run_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

fn row_to_task_run_item(row: TaskRunRow) -> Result<TaskRunItem, ServiceError> {
    Ok(TaskRunItem {
        id: row.id,
        task_key: row.task_key,
        trigger_type: trigger_type_from_str(&row.trigger_type)?,
        status: task_status_from_str(&row.status)?,
        scheduled_for: row.scheduled_for,
        started_at: row.started_at,
        finished_at: row.finished_at,
        error_message: row.error_message,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

fn trigger_type_to_str(trigger_type: &TaskTriggerType) -> &'static str {
    match trigger_type {
        TaskTriggerType::Scheduled => "scheduled",
        TaskTriggerType::Manual => "manual",
    }
}

fn trigger_type_from_str(raw: &str) -> Result<TaskTriggerType, ServiceError> {
    match raw {
        "scheduled" => Ok(TaskTriggerType::Scheduled),
        "manual" => Ok(TaskTriggerType::Manual),
        other => Err(ServiceError::InvalidOperation(format!("Invalid task trigger type: {other}"))),
    }
}

fn task_status_to_str(status: TaskRunStatus) -> &'static str {
    match status {
        TaskRunStatus::Running => "running",
        TaskRunStatus::Success => "success",
        TaskRunStatus::Failed => "failed",
        TaskRunStatus::Skipped => "skipped",
    }
}

fn task_status_from_str(raw: &str) -> Result<TaskRunStatus, ServiceError> {
    match raw {
        "running" => Ok(TaskRunStatus::Running),
        "success" => Ok(TaskRunStatus::Success),
        "failed" => Ok(TaskRunStatus::Failed),
        "skipped" => Ok(TaskRunStatus::Skipped),
        other => Err(ServiceError::InvalidOperation(format!("Invalid task status: {other}"))),
    }
}

fn map_db_error(err: sqlx::Error) -> ServiceError {
    tracing::error!("Task database error: {:?}", err);
    ServiceError::DatabaseQueryFailed
}
