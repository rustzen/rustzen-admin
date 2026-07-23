use std::path::PathBuf;

use rustzen_config::RETENTION_DAYS;

const LOG_FILE_PREFIX: &str = "monitor";

pub use rustzen_runtime::FileLoggingGuard as LoggingGuard;

pub fn init_logging(log_dir: PathBuf) -> Result<LoggingGuard, Box<dyn std::error::Error>> {
    rustzen_runtime::init_file_logging(
        log_dir,
        LOG_FILE_PREFIX,
        RETENTION_DAYS,
        "Failed to clean up expired Monitor log files",
    )
}
