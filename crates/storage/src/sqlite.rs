use std::time::Duration;

pub use rz_core::{CoreError, SqlitePool, database_url_from_path, test_connection};
use rz_core::{SqlitePoolConfig, connect_sqlite_with_config};

/// Default-sized SQLite connection options for local service startup.
#[derive(Debug, Clone)]
pub struct DatabaseConnectionOptions {
    /// Maximum number of pooled connections.
    pub max_connections: u32,
    /// Minimum number of pooled connections.
    pub min_connections: u32,
    /// Connection acquisition timeout.
    pub connect_timeout: Duration,
    /// Optional idle timeout. `None` disables idle reaping.
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

/// Create an SQLite pool with explicit options.
pub async fn connect_sqlite_with_options(
    database_url: &str,
    options: DatabaseConnectionOptions,
) -> Result<SqlitePool, CoreError> {
    connect_sqlite_with_config(database_url, options.into_pool_config()).await
}

/// Create an SQLite pool with default options.
pub async fn connect_sqlite(database_url: &str) -> Result<SqlitePool, CoreError> {
    connect_sqlite_with_options(database_url, DatabaseConnectionOptions::default()).await
}

impl DatabaseConnectionOptions {
    fn into_pool_config(self) -> SqlitePoolConfig {
        SqlitePoolConfig {
            max_connections: self.max_connections,
            min_connections: self.min_connections,
            acquire_timeout: self.connect_timeout,
            idle_timeout: self.idle_timeout,
            ..SqlitePoolConfig::service()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::database_url_from_path;
    use rz_core::ensure_database_directory;
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn database_url_keeps_explicit_sqlite_memory() {
        assert_eq!(database_url_from_path(Path::new(":memory:")), ":memory:");
    }

    #[test]
    fn database_url_formats_file_path() {
        assert_eq!(database_url_from_path(Path::new("/tmp/data.db")), "sqlite:////tmp/data.db");
    }

    #[test]
    fn ensure_database_directory_keeps_file_creation_outside_connect() {
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos();
        let db_path = std::env::temp_dir().join(format!("rustzen-storage-{}.db", nanos));
        if db_path.exists() {
            fs::remove_file(&db_path).ok();
        }
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).expect("create temp dir");
        }

        let database_url = format!("sqlite:///{}", db_path.display());
        let result = ensure_database_directory(&database_url);

        assert!(result.is_ok(), "ensure_database_directory failed: {result:?}");
        assert!(
            !db_path.exists(),
            "ensure_database_directory should not create file; sqlite connection handles creation"
        );
    }

    #[test]
    fn ensure_database_directory_rejects_empty_path() {
        let result = ensure_database_directory("");
        assert!(result.is_err());
    }
}
