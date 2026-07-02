use std::time::Duration;

use rz_core::{
    DailyLogCleanupConfig, DailyLoggingConfig, DailyLoggingGuard, cleanup_expired_daily_logs,
    init_daily_logging,
};

use crate::infra::config::CONFIG;

pub struct LoggingGuard {
    _core_guard: DailyLoggingGuard,
}

pub fn init_logging() -> Result<LoggingGuard, Box<dyn std::error::Error>> {
    let log_dir = CONFIG.log_dir();
    let core_guard = init_daily_logging(
        DailyLoggingConfig::new(&log_dir, &CONFIG.log_file_prefix)
            .with_env_filter(log_env_filter())
            .with_stdout(true)
            .with_ansi(false)
            .with_target(false),
    )?;

    cleanup_expired_logs()?;
    spawn_log_cleanup_task();

    tracing::info!(
        log_dir = %log_dir.display(),
        log_file_prefix = %CONFIG.log_file_prefix,
        log_retention_days = CONFIG.log_retention_days,
        "Logging initialized"
    );

    Ok(LoggingGuard { _core_guard: core_guard })
}

fn log_env_filter() -> String {
    match std::env::var("RUST_LOG") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => "info".to_string(),
    }
}

fn spawn_log_cleanup_task() {
    tokio::spawn(async move {
        let interval = Duration::from_secs(24 * 60 * 60);
        tracing::debug!("Started log cleanup background task");
        loop {
            tokio::time::sleep(interval).await;

            tracing::debug!("Running expired log cleanup");
            if let Err(error) = cleanup_expired_logs() {
                tracing::error!(%error, "Failed to cleanup expired log files");
            } else {
                tracing::debug!("Expired log cleanup finished");
            }
        }
    });
}

fn cleanup_expired_logs() -> Result<(), Box<dyn std::error::Error>> {
    let log_dir = CONFIG.log_dir();
    let cleanup_config =
        DailyLogCleanupConfig::new(&log_dir, &CONFIG.log_file_prefix, CONFIG.log_retention_days);
    let report = cleanup_expired_daily_logs(&cleanup_config)?;

    tracing::info!(
        log_dir = %log_dir.display(),
        log_file_prefix = %CONFIG.log_file_prefix,
        retention_days = CONFIG.log_retention_days,
        cutoff = %report.cutoff,
        scanned = report.scanned,
        deleted = report.deleted,
        kept = report.kept(),
        "Log cleanup completed"
    );

    Ok(())
}
