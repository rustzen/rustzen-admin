use std::{path::Path, str::FromStr, time::Duration};

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};

pub use sqlx::SqlitePool;

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("sqlite error: {0}")]
    Sqlite(#[from] sqlx::Error),
}

/// Default-sized SQLite connection options for local service startup.
#[derive(Debug, Clone)]
pub struct DatabaseConnectionOptions {
    pub max_connections: u32,
    pub min_connections: u32,
    pub connect_timeout: Duration,
    pub idle_timeout: Option<Duration>,
}

impl Default for DatabaseConnectionOptions {
    fn default() -> Self {
        Self {
            max_connections: 4,
            min_connections: 1,
            connect_timeout: Duration::from_secs(10),
            idle_timeout: Some(Duration::from_secs(600)),
        }
    }
}

pub fn database_url_from_path(path: impl AsRef<Path>) -> String {
    let path = path.as_ref();
    if let Some(raw) = path.to_str()
        && (raw == ":memory:" || raw.starts_with("sqlite:"))
    {
        return raw.to_string();
    }
    format!("sqlite:///{}", path.display())
}

pub async fn connect_sqlite_with_options(
    database_url: &str,
    options: DatabaseConnectionOptions,
) -> Result<SqlitePool, CoreError> {
    ensure_database_directory(database_url)?;
    let connect_options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(5))
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .pragma("auto_vacuum", "INCREMENTAL");

    Ok(SqlitePoolOptions::new()
        .max_connections(options.max_connections)
        .min_connections(options.min_connections)
        .acquire_timeout(options.connect_timeout)
        .idle_timeout(options.idle_timeout)
        .connect_with(connect_options)
        .await?)
}

pub async fn connect_sqlite(database_url: &str) -> Result<SqlitePool, CoreError> {
    connect_sqlite_with_options(database_url, DatabaseConnectionOptions::default()).await
}

pub async fn test_connection(pool: &SqlitePool) -> Result<(), CoreError> {
    sqlx::query("SELECT 1").execute(pool).await?;
    Ok(())
}

fn ensure_database_directory(database_url: &str) -> Result<(), CoreError> {
    let value = database_url.trim();
    if value.is_empty() {
        return Err(CoreError::InvalidInput("SQLite database path cannot be empty".to_string()));
    }
    if value == ":memory:" || value == "sqlite::memory:" {
        return Ok(());
    }
    let path = value.strip_prefix("sqlite://").or_else(|| value.strip_prefix("sqlite:"));
    let path = Path::new(path.unwrap_or(value));
    if path.is_dir() {
        return Err(CoreError::InvalidInput(
            "SQLite database path must be a file path, not a directory".to_string(),
        ));
    }
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        std::fs::create_dir_all(parent)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::database_url_from_path;
    use std::path::Path;

    #[test]
    fn database_urls_preserve_memory_and_format_files() {
        assert_eq!(database_url_from_path(Path::new(":memory:")), ":memory:");
        assert_eq!(database_url_from_path(Path::new("/tmp/data.db")), "sqlite:////tmp/data.db");
    }
}
