use std::{fs, path::PathBuf, time::Duration};

use chrono::{Days, Local, NaiveDate};
use rustzen_config::RETENTION_DAYS;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{EnvFilter, fmt::writer::MakeWriterExt};

const LOG_FILE_PREFIX: &str = "monitor";

pub struct LoggingGuard {
    _file_guard: WorkerGuard,
}

pub fn init_logging(log_dir: PathBuf) -> Result<LoggingGuard, Box<dyn std::error::Error>> {
    fs::create_dir_all(&log_dir)?;
    let appender = tracing_appender::rolling::daily(&log_dir, LOG_FILE_PREFIX);
    let (file_writer, file_guard) = tracing_appender::non_blocking(appender);
    let filter = EnvFilter::try_new(log_env_filter())?;
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_ansi(false)
        .with_target(false)
        .compact()
        .with_writer(std::io::stdout.and(file_writer))
        .try_init()
        .map_err(|error| std::io::Error::other(error.to_string()))?;

    cleanup_expired_logs(&log_dir)?;
    spawn_log_cleanup_task(log_dir);
    Ok(LoggingGuard { _file_guard: file_guard })
}

fn log_env_filter() -> String {
    std::env::var("RUST_LOG")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "info".to_string())
}

fn spawn_log_cleanup_task(log_dir: PathBuf) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;
            if let Err(error) = cleanup_expired_logs(&log_dir) {
                tracing::error!(%error, "Failed to clean up expired Monitor log files");
            }
        }
    });
}

fn cleanup_expired_logs(log_dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    let cutoff = Local::now().date_naive() - Days::new(RETENTION_DAYS);
    cleanup_logs_in_dir(log_dir, cutoff)
}

fn cleanup_logs_in_dir(
    log_dir: &std::path::Path,
    cutoff: NaiveDate,
) -> Result<(), Box<dyn std::error::Error>> {
    for entry in fs::read_dir(log_dir)? {
        let path = entry?.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Some(date) = name
            .strip_prefix(&format!("{LOG_FILE_PREFIX}."))
            .and_then(|date| NaiveDate::parse_from_str(date, "%Y-%m-%d").ok())
        else {
            continue;
        };
        if date < cutoff {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}
