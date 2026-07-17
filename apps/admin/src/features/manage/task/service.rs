use std::{str::FromStr, sync::Arc, time::Duration};

use chrono::{DateTime, FixedOffset, Utc};
use croner::Cron;
use rustzen_storage::{SqliteMaintenancePlan, run_sqlite_maintenance};
use tokio::sync::{Mutex, RwLock};
use tokio::time::{sleep, timeout};

use crate::{
    common::{
        error::ServiceError,
        pagination::{Pagination, PaginationQuery},
    },
    features::manage::log::service::LogService,
    infra::config::CONFIG,
};

use super::{
    repo::{FinishTaskRunInput, InsertTaskRunInput, SyncTaskInput, TaskRepository},
    types::{
        TaskExecutionContext, TaskExecutor, TaskItem, TaskRunItem, TaskRunQuery, TaskRunStatus,
        TaskTriggerType,
    },
};

#[derive(Clone)]
pub struct TaskService {
    pool: sqlx::SqlitePool,
    repo: Arc<TaskRepository>,
    catalog: Arc<RwLock<Option<TaskCatalog>>>,
    timezone: FixedOffset,
}

#[derive(Clone)]
struct ScheduledTask {
    task_key: &'static str,
    name: &'static str,
    description: &'static str,
    expression: &'static str,
    executor: Arc<dyn TaskExecutor>,
    run_lock: Arc<Mutex<()>>,
}

struct TaskCatalog {
    tasks: Vec<ScheduledTask>,
}

#[derive(Clone, Copy)]
struct TaskSpec {
    task_key: &'static str,
    name: &'static str,
    description: &'static str,
    expression: &'static str,
    kind: TaskKind,
}

#[derive(Clone, Copy)]
enum TaskKind {
    CleanupOperationLogs,
    CleanupTaskRuns,
    SqliteMaintenance,
}

const TASK_SPECS: [TaskSpec; 3] = [
    TaskSpec {
        task_key: "cleanup-operation-logs-retention",
        name: "清理操作日志",
        description: "删除超过配置保留天数的操作日志。",
        expression: "0 20 1 * * * *",
        kind: TaskKind::CleanupOperationLogs,
    },
    TaskSpec {
        task_key: "cleanup-task-runs-retention",
        name: "清理任务记录",
        description: "删除超过配置保留天数的定时任务执行记录。",
        expression: "0 30 1 * * * *",
        kind: TaskKind::CleanupTaskRuns,
    },
    TaskSpec {
        task_key: "sqlite-storage-maintenance",
        name: "SQLite 存储维护",
        description: "执行 WAL 检查点、优化 SQLite 查询规划统计并回收可复用页面。",
        expression: "0 0 2 * * * *",
        kind: TaskKind::SqliteMaintenance,
    },
];

impl TaskService {
    pub fn new(pool: sqlx::SqlitePool) -> Result<Self, ServiceError> {
        let timezone = parse_fixed_timezone(CONFIG.timezone())?;
        Ok(Self {
            pool: pool.clone(),
            repo: Arc::new(TaskRepository::new(pool)),
            catalog: Arc::new(RwLock::new(None)),
            timezone,
        })
    }

    pub async fn bootstrap(&self) -> Result<(), ServiceError> {
        let catalog = TaskCatalog::new(self.repo.clone(), self.pool.clone());
        self.repo.fail_stale_running_task_runs(Utc::now()).await?;

        let mut sync_inputs = Vec::with_capacity(catalog.tasks.len());
        let mut task_crons = Vec::with_capacity(catalog.tasks.len());
        for task in &catalog.tasks {
            let cron = Self::cron_from_expression(task.expression)?;
            let next_run_at = Self::next_run_at_for_cron(&cron, self.timezone)?;
            sync_inputs.push(SyncTaskInput {
                task_key: task.task_key,
                name: task.name,
                description: Some(task.description),
                cron_expression: task.expression,
                next_run_at: Some(next_run_at),
            });
            task_crons.push((task.clone(), cron));
        }

        self.repo.sync_tasks(&sync_inputs).await?;

        *self.catalog.write().await = Some(catalog);
        for (task, cron) in task_crons {
            self.schedule_task(task, cron);
        }
        Ok(())
    }

    fn schedule_task(&self, task: ScheduledTask, cron: Cron) {
        let service = self.clone();
        let timezone = self.timezone;

        tokio::spawn(async move {
            loop {
                let scheduled_for = match Self::next_run_at_for_cron(&cron, timezone) {
                    Ok(value) => value,
                    Err(err) => {
                        tracing::error!(
                            task_key = task.task_key,
                            task_name = task.name,
                            "Failed to calculate next run time"
                        );
                        tracing::debug!("Scheduling retry detail: {}", err);
                        sleep(Duration::from_secs(10)).await;
                        continue;
                    }
                };

                let wait = (scheduled_for - Utc::now())
                    .to_std()
                    .unwrap_or_else(|_| Duration::from_millis(10));
                sleep(wait).await;

                let next_run_at =
                    match Self::next_run_after_for_cron(&cron, timezone, scheduled_for) {
                        Ok(value) => Some(value),
                        Err(err) => {
                            tracing::error!(
                                task_key = task.task_key,
                                task_name = task.name,
                                "Failed to calculate following run time"
                            );
                            tracing::debug!("Following run calculation detail: {}", err);
                            None
                        }
                    };

                if let Err(err) = service.start_scheduled_task(task.task_key, next_run_at).await {
                    tracing::error!("Scheduled task {} failed: {}", task.task_key, err);
                }
            }
        });
    }

    fn cron_from_expression(expression: &str) -> Result<Cron, ServiceError> {
        Cron::from_str(expression).map_err(|err| {
            ServiceError::InvalidOperation(format!("Invalid cron expression: {err}"))
        })
    }

    fn next_run_at_for_cron(
        cron: &Cron,
        timezone: FixedOffset,
    ) -> Result<DateTime<Utc>, ServiceError> {
        let now = Utc::now().with_timezone(&timezone);
        let next_run_at = cron.find_next_occurrence(&now, false).map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to calculate next task run time: {err}"))
        })?;
        Ok(next_run_at.with_timezone(&Utc))
    }

    pub async fn list_tasks(&self) -> Result<Vec<TaskItem>, ServiceError> {
        self.repo.list_tasks().await
    }

    pub async fn list_task_runs(
        &self,
        task_key: &str,
        query: TaskRunQuery,
    ) -> Result<(Vec<TaskRunItem>, i64), ServiceError> {
        let pagination = Pagination::from_query(PaginationQuery {
            current: query.current,
            page_size: query.page_size,
        });
        self.repo.list_task_runs(task_key, pagination.offset.into(), pagination.limit.into()).await
    }

    pub async fn run_task(&self, task_key: &str) -> Result<TaskRunItem, ServiceError> {
        self.start_task_by_key(task_key, TaskTriggerType::Manual, None).await
    }

    async fn start_scheduled_task(
        &self,
        task_key: &str,
        next_run_at: Option<DateTime<Utc>>,
    ) -> Result<TaskRunItem, ServiceError> {
        self.repo.update_task_next_run_at(task_key, next_run_at).await?;
        self.start_task_by_key(task_key, TaskTriggerType::Scheduled, Some(Utc::now())).await
    }

    async fn start_task_by_key(
        &self,
        task_key: &str,
        trigger_type: TaskTriggerType,
        scheduled_for: Option<DateTime<Utc>>,
    ) -> Result<TaskRunItem, ServiceError> {
        let task = self
            .catalog
            .read()
            .await
            .as_ref()
            .ok_or_else(|| {
                ServiceError::InvalidOperation("Task scheduler is not initialized".to_string())
            })?
            .get(task_key)
            .ok_or_else(|| ServiceError::NotFound(format!("Task {task_key}")))?;

        self.start_task_run(task, trigger_type, scheduled_for).await
    }

    async fn start_task_run(
        &self,
        task: ScheduledTask,
        trigger_type: TaskTriggerType,
        scheduled_for: Option<DateTime<Utc>>,
    ) -> Result<TaskRunItem, ServiceError> {
        let started_at = Utc::now();
        let guard = match task.run_lock.clone().try_lock_owned() {
            Ok(guard) => guard,
            Err(_) => {
                if trigger_type == TaskTriggerType::Manual {
                    return Err(ServiceError::InvalidOperation(format!(
                        "Task {} is already running",
                        task.task_key
                    )));
                }
                return self
                    .repo
                    .insert_skipped_task_run(InsertTaskRunInput {
                        task_key: task.task_key,
                        trigger_type: &trigger_type,
                        status: TaskRunStatus::Skipped,
                        scheduled_for,
                        started_at,
                        finished_at: Some(started_at),
                        error_message: Some("Task is already running"),
                    })
                    .await;
            }
        };

        let run = self
            .repo
            .insert_task_run(InsertTaskRunInput {
                task_key: task.task_key,
                trigger_type: &trigger_type,
                status: TaskRunStatus::Running,
                scheduled_for,
                started_at,
                finished_at: None,
                error_message: None,
            })
            .await?;

        let repo = self.repo.clone();
        let task_key = task.task_key.to_string();
        let task_name = task.name.to_string();
        let executor = task.executor.clone();
        let run_id = run.id;
        let timeout_duration = task_run_timeout_duration(CONFIG.task_run_timeout_seconds());

        tokio::spawn(async move {
            let ctx = TaskExecutionContext {
                task_key: task_key.clone(),
                task_name,
                trigger_type,
                scheduled_for,
            };
            let result = match timeout(timeout_duration, executor.execute(ctx)).await {
                Ok(result) => result,
                Err(_) => Err(ServiceError::InvalidOperation(format!(
                    "Task exceeded timeout of {} seconds",
                    timeout_duration.as_secs()
                ))),
            };
            let finished_at = Utc::now();
            let (status, message) = match result {
                Ok(()) => (TaskRunStatus::Success, None),
                Err(err) => (TaskRunStatus::Failed, Some(err.to_string())),
            };

            if let Err(err) = repo
                .finish_task_run(FinishTaskRunInput {
                    run_id,
                    task_key: &task_key,
                    trigger_type,
                    status,
                    started_at,
                    finished_at,
                    error_message: message.as_deref(),
                })
                .await
            {
                tracing::error!("Failed to finish task run {}: {}", run_id, err);
            }

            drop(guard);
        });

        Ok(run)
    }

    fn next_run_after_for_cron(
        cron: &Cron,
        timezone: FixedOffset,
        after: DateTime<Utc>,
    ) -> Result<DateTime<Utc>, ServiceError> {
        let after = after.with_timezone(&timezone);
        let next_run_at = cron.find_next_occurrence(&after, false).map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to calculate next task run time: {err}"))
        })?;
        Ok(next_run_at.with_timezone(&Utc))
    }
}

fn parse_fixed_timezone(value: &str) -> Result<FixedOffset, ServiceError> {
    let trimmed = value.trim();
    let seconds = match trimmed {
        "UTC" | "Etc/UTC" | "Z" | "+00:00" | "-00:00" => 0,
        "Asia/Shanghai" | "Asia/Chongqing" | "Asia/Harbin" | "Asia/Urumqi" | "CST" => 8 * 3600,
        _ => parse_timezone_offset_seconds(trimmed).ok_or_else(|| {
            ServiceError::InvalidOperation(format!(
                "Invalid RUSTZEN_TIMEZONE: {trimmed}; use UTC, Asia/Shanghai, or offsets like +08:00"
            ))
        })?,
    };

    FixedOffset::east_opt(seconds).ok_or_else(|| {
        ServiceError::InvalidOperation(format!("Invalid RUSTZEN_TIMEZONE offset: {trimmed}"))
    })
}

fn parse_timezone_offset_seconds(value: &str) -> Option<i32> {
    let sign = match value.as_bytes().first()? {
        b'+' => 1,
        b'-' => -1,
        _ => return None,
    };
    let rest = &value[1..];
    let (hours, minutes) = if let Some((hours, minutes)) = rest.split_once(':') {
        (hours.parse::<i32>().ok()?, minutes.parse::<i32>().ok()?)
    } else {
        (rest.parse::<i32>().ok()?, 0)
    };

    if !(0..=23).contains(&hours) || !(0..=59).contains(&minutes) {
        return None;
    }
    Some(sign * ((hours * 3600) + (minutes * 60)))
}

fn task_run_timeout_duration(timeout_secs: u64) -> Duration {
    Duration::from_secs(timeout_secs.max(1))
}

impl TaskCatalog {
    fn new(repo: Arc<TaskRepository>, pool: sqlx::SqlitePool) -> Self {
        let tasks = TASK_SPECS
            .iter()
            .map(|spec| ScheduledTask {
                task_key: spec.task_key,
                name: spec.name,
                description: spec.description,
                expression: spec.expression,
                executor: spec.kind.executor(repo.clone(), pool.clone()),
                run_lock: Arc::new(Mutex::new(())),
            })
            .collect();
        Self { tasks }
    }

    fn get(&self, task_key: &str) -> Option<ScheduledTask> {
        self.tasks.iter().find(|task| task.task_key == task_key).cloned()
    }
}

impl TaskKind {
    fn executor(&self, repo: Arc<TaskRepository>, pool: sqlx::SqlitePool) -> Arc<dyn TaskExecutor> {
        match self {
            TaskKind::CleanupOperationLogs => Arc::new(CleanupOperationLogsExecutor { pool }),
            TaskKind::CleanupTaskRuns => Arc::new(CleanupTaskRunsExecutor { repo }),
            TaskKind::SqliteMaintenance => Arc::new(SqliteMaintenanceExecutor { pool }),
        }
    }
}

struct CleanupOperationLogsExecutor {
    pool: sqlx::SqlitePool,
}

#[async_trait::async_trait]
impl TaskExecutor for CleanupOperationLogsExecutor {
    async fn execute(&self, ctx: TaskExecutionContext) -> Result<(), ServiceError> {
        tracing::info!(
            task_key = %ctx.task_key,
            task_name = %ctx.task_name,
            trigger_type = ?ctx.trigger_type,
            scheduled_for = ?ctx.scheduled_for,
            "Cleaning operation logs"
        );
        let deleted = LogService::cleanup_old_logs(&self.pool).await?;
        tracing::info!(deleted, "Operation log cleanup completed");
        Ok(())
    }
}

struct CleanupTaskRunsExecutor {
    repo: Arc<TaskRepository>,
}

#[async_trait::async_trait]
impl TaskExecutor for CleanupTaskRunsExecutor {
    async fn execute(&self, ctx: TaskExecutionContext) -> Result<(), ServiceError> {
        tracing::info!(
            task_key = %ctx.task_key,
            task_name = %ctx.task_name,
            trigger_type = ?ctx.trigger_type,
            scheduled_for = ?ctx.scheduled_for,
            "Cleaning task runs"
        );
        let deleted = self.repo.cleanup_old_task_runs().await?;
        tracing::info!(deleted, "Task run cleanup completed");
        Ok(())
    }
}

struct SqliteMaintenanceExecutor {
    pool: sqlx::SqlitePool,
}

#[async_trait::async_trait]
impl TaskExecutor for SqliteMaintenanceExecutor {
    async fn execute(&self, ctx: TaskExecutionContext) -> Result<(), ServiceError> {
        tracing::info!(
            task_key = %ctx.task_key,
            task_name = %ctx.task_name,
            trigger_type = ?ctx.trigger_type,
            scheduled_for = ?ctx.scheduled_for,
            "Running SQLite storage maintenance"
        );

        let report = run_sqlite_maintenance(&self.pool, SqliteMaintenancePlan::reclaim())
            .await
            .map_err(|err| {
                tracing::error!(%err, "SQLite storage maintenance failed");
                ServiceError::DatabaseQueryFailed
            })?;
        if let Some(checkpoint) = report.checkpoint {
            tracing::info!(
                busy = checkpoint.busy,
                log_frames = checkpoint.log_frames,
                checkpointed_frames = checkpoint.checkpointed_frames,
                "SQLite WAL checkpoint completed"
            );
        }
        tracing::info!(
            before_pages = report.before.page_count,
            before_freelist = report.before.freelist_count,
            before_freelist_bytes = report.before.freelist_bytes,
            after_pages = report.after.page_count,
            after_freelist = report.after.freelist_count,
            after_freelist_bytes = report.after.freelist_bytes,
            optimized = report.optimized,
            vacuumed = report.vacuumed,
            "SQLite storage maintenance completed"
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_supported_fixed_timezones() {
        assert_eq!(parse_fixed_timezone("UTC").unwrap().local_minus_utc(), 0);
        assert_eq!(parse_fixed_timezone("Asia/Shanghai").unwrap().local_minus_utc(), 8 * 3600);
        assert_eq!(parse_fixed_timezone("+08:00").unwrap().local_minus_utc(), 8 * 3600);
        assert_eq!(parse_fixed_timezone("-05:30").unwrap().local_minus_utc(), -((5 * 3600) + 1800));
    }

    #[test]
    fn rejects_named_timezone_database_entries() {
        let err = parse_fixed_timezone("America/New_York").expect_err("timezone is unsupported");

        assert!(err.to_string().contains("Invalid RUSTZEN_TIMEZONE"));
    }

    #[test]
    fn task_run_timeout_duration_has_one_second_floor() {
        assert_eq!(task_run_timeout_duration(0), Duration::from_secs(1));
        assert_eq!(task_run_timeout_duration(30), Duration::from_secs(30));
    }
}
