use std::{fs, time::Duration};

use chrono::{Days, Local, NaiveDate};
use rustzen_config::RETENTION_DAYS;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{EnvFilter, fmt::writer::MakeWriterExt};

use crate::infra::config::CONFIG;

const LOG_FILE_PREFIX: &str = "admin";

pub struct LoggingGuard {
    _file_guard: WorkerGuard,
}

pub fn init_logging() -> Result<LoggingGuard, Box<dyn std::error::Error>> {
    let log_dir = CONFIG.log_dir();
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

    cleanup_expired_logs()?;
    spawn_log_cleanup_task();
    Ok(LoggingGuard { _file_guard: file_guard })
}

fn log_env_filter() -> String {
    std::env::var("RUST_LOG")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "info".to_string())
}

fn spawn_log_cleanup_task() {
    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;
            if let Err(error) = cleanup_expired_logs() {
                tracing::error!(%error, "Failed to cleanup expired log files");
            }
        }
    });
}

fn cleanup_expired_logs() -> Result<(), Box<dyn std::error::Error>> {
    cleanup_logs_in_dir(&CONFIG.log_dir(), LOG_FILE_PREFIX, Local::now().date_naive())
}

fn cleanup_logs_in_dir(
    log_dir: &std::path::Path,
    file_prefix: &str,
    today: NaiveDate,
) -> Result<(), Box<dyn std::error::Error>> {
    let cutoff = today - Days::new(RETENTION_DAYS);
    for entry in fs::read_dir(log_dir)? {
        let path = entry?.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Some(date) = name
            .strip_prefix(&format!("{file_prefix}."))
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

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use super::cleanup_logs_in_dir;

    #[test]
    fn cleanup_keeps_log_files_inside_thirty_day_window() {
        let dir = std::env::temp_dir().join(format!("rz-logs-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("log dir");
        for name in ["admin.2026-06-13", "admin.2026-06-14", "unrelated.txt"] {
            std::fs::write(dir.join(name), name).expect("log file");
        }

        cleanup_logs_in_dir(&dir, "admin", NaiveDate::from_ymd_opt(2026, 7, 14).expect("date"))
            .expect("cleanup");

        assert!(!dir.join("admin.2026-06-13").exists());
        assert!(dir.join("admin.2026-06-14").exists());
        assert!(dir.join("unrelated.txt").exists());
        std::fs::remove_dir_all(dir).expect("remove log dir");
    }
}
