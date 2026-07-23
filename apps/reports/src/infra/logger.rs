use rustzen_config::RETENTION_DAYS;

use crate::config::CONFIG;

const LOG_FILE_PREFIX: &str = "reports";

pub use rustzen_runtime::FileLoggingGuard as LoggingGuard;

pub fn init_logging() -> Result<LoggingGuard, Box<dyn std::error::Error>> {
    rustzen_runtime::init_file_logging(
        CONFIG.log_dir(),
        LOG_FILE_PREFIX,
        RETENTION_DAYS,
        "Failed to cleanup Reports log files",
    )
}
