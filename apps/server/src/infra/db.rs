use rustzen_storage::{
    migration,
    sqlite::{
        DatabaseConnectionOptions, SqlitePool, connect_sqlite_with_options, database_url_from_path,
    },
};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tracing;

use crate::infra::config::CONFIG;

/// Configuration for the database connection pool.
///
/// This struct holds all the settings required to establish a SQLite
/// connection pool.
#[derive(Debug)]
pub struct DatabaseConfig {
    /// The database connection URL.
    pub url: String,
    /// The maximum number of connections the pool is allowed to maintain.
    pub max_connections: u32,
    /// The minimum number of connections the pool should maintain.
    pub min_connections: u32,
    /// The timeout for a single connection attempt.
    pub connect_timeout: Duration,
    /// The timeout for an idle connection. `None` disables idle reaping.
    pub idle_timeout: Option<Duration>,
}

impl Default for DatabaseConfig {
    /// Creates a database configuration from `RUSTZEN_*` runtime config.
    fn default() -> Self {
        let path = CONFIG.sqlite_database_path();
        let url = database_url_from_path(path.as_path());

        Self {
            url,
            max_connections: CONFIG.db_max_conn,
            min_connections: CONFIG.db_min_conn,
            connect_timeout: Duration::from_secs(CONFIG.db_conn_timeout),
            idle_timeout: db_idle_timeout(CONFIG.db_idle_timeout),
        }
    }
}

fn db_idle_timeout(timeout_secs: u64) -> Option<Duration> {
    if timeout_secs == 0 { None } else { Some(Duration::from_secs(timeout_secs)) }
}

/// Creates a new database connection pool based on the provided configuration.
///
/// # Errors
///
/// Returns a `sqlx::Error` if connecting to the database fails.
#[tracing::instrument(name = "create_db_pool", skip_all)]
pub async fn create_pool(config: DatabaseConfig) -> Result<SqlitePool, sqlx::Error> {
    tracing::info!("Creating database connection pool...");
    tracing::debug!("Connecting to SQLite URL: {}", config.url);
    let options = DatabaseConnectionOptions {
        max_connections: config.max_connections,
        min_connections: config.min_connections,
        connect_timeout: config.connect_timeout,
        idle_timeout: config.idle_timeout,
    };
    let pool = connect_sqlite_with_options(&config.url, options).await?;
    tracing::info!("Database connection pool created successfully.");
    Ok(pool)
}

/// Creates a new database connection pool using the default configuration.
///
/// # Errors
///
/// Returns a `sqlx::Error` if connecting to the database fails.
#[tracing::instrument(name = "create_default_db_pool")]
pub async fn create_default_pool() -> Result<SqlitePool, sqlx::Error> {
    migrate_legacy_deploy_server_versions(&CONFIG.runtime_root_dir()).map_err(sqlx::Error::Io)?;
    migrate_legacy_sqlite_files(&CONFIG.sqlite_database_path()).map_err(sqlx::Error::Io)?;
    let config = DatabaseConfig::default();
    create_pool(config).await
}

pub use rustzen_storage::sqlite::test_connection;

/// Runs embedded database migrations on startup.
///
/// # Errors
///
/// Returns a migration error if applying the embedded migrations fails.
#[tracing::instrument(name = "run_db_migrations", skip(pool))]
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    tracing::info!("Running embedded database migrations...");
    migration::run_migrations(pool).await?;
    tracing::info!("Embedded database migrations completed successfully.");
    Ok(())
}

/// Runs startup data migrations that depend on the migrated SQLite schema.
///
/// # Errors
///
/// Returns a `sqlx::Error` if a startup data migration fails.
#[tracing::instrument(name = "run_startup_data_migrations", skip(pool))]
pub async fn run_startup_data_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    migrate_legacy_deploy_file_paths(pool, &CONFIG.runtime_root_dir()).await
}

/// Moves legacy `<runtime_root>/data/rustzen.db*` files into `data/db/` before SQLite opens.
fn migrate_legacy_sqlite_files(current_db_path: &Path) -> std::io::Result<()> {
    let Some(db_dir) = current_db_path.parent() else {
        return Ok(());
    };
    if db_dir.file_name().and_then(|value| value.to_str()) != Some("db") {
        return Ok(());
    }
    let Some(data_dir) = db_dir.parent() else {
        return Ok(());
    };
    let Some(file_name) = current_db_path.file_name() else {
        return Ok(());
    };

    std::fs::create_dir_all(db_dir)?;
    let legacy_db_path = data_dir.join(file_name);
    let file_pairs = legacy_sqlite_file_pairs(&legacy_db_path, current_db_path);
    if !legacy_db_path.exists() {
        if file_pairs.iter().skip(1).any(|(source, _)| source.exists()) {
            tracing::warn!(
                source = %legacy_db_path.display(),
                target = %current_db_path.display(),
                "Skipping legacy SQLite file migration because sidecar files exist without the main database file"
            );
        }
        return Ok(());
    }
    if file_pairs.iter().any(|(_, target)| target.exists()) {
        tracing::warn!(
            source = %legacy_db_path.display(),
            target = %current_db_path.display(),
            "Skipping legacy SQLite file migration because target SQLite file group already exists"
        );
        return Ok(());
    }

    let mut moved_pairs = Vec::new();
    for (source, target) in file_pairs {
        if !source.exists() {
            continue;
        }
        if let Err(error) = std::fs::rename(&source, &target) {
            rollback_legacy_sqlite_moves(&moved_pairs);
            return Err(error);
        }
        tracing::info!(
            source = %source.display(),
            target = %target.display(),
            "Migrated legacy SQLite runtime file"
        );
        moved_pairs.push((target, source));
    }
    Ok(())
}

fn rollback_legacy_sqlite_moves(moved_pairs: &[(PathBuf, PathBuf)]) {
    for (target, source) in moved_pairs.iter().rev() {
        if !target.exists() || source.exists() {
            continue;
        }
        if let Err(error) = std::fs::rename(target, source) {
            tracing::error!(
                source = %target.display(),
                target = %source.display(),
                error = %error,
                "Failed to roll back legacy SQLite file migration"
            );
        }
    }
}

fn legacy_sqlite_file_pairs(
    legacy_db_path: &Path,
    current_db_path: &Path,
) -> [(PathBuf, PathBuf); 3] {
    [
        (legacy_db_path.to_path_buf(), current_db_path.to_path_buf()),
        (
            PathBuf::from(format!("{}-shm", legacy_db_path.display())),
            PathBuf::from(format!("{}-shm", current_db_path.display())),
        ),
        (
            PathBuf::from(format!("{}-wal", legacy_db_path.display())),
            PathBuf::from(format!("{}-wal", current_db_path.display())),
        ),
    ]
}

/// Moves legacy `versions/server-<version>-<arch>` binaries into `bin/rustzen-admin-<version>-<arch>`.
fn migrate_legacy_deploy_server_versions(runtime_root: &Path) -> std::io::Result<()> {
    let runtime_root = resolve_runtime_path(runtime_root);
    let versions_dir = runtime_root.join("versions");
    if !versions_dir.exists() {
        return Ok(());
    }

    let bin_dir = runtime_root.join("bin");
    std::fs::create_dir_all(&bin_dir)?;

    for entry in std::fs::read_dir(&versions_dir)? {
        let entry = entry?;
        let source = entry.path();
        if !source.is_file() {
            continue;
        }

        let Some(file_name) = source.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let Some(version_suffix) = file_name.strip_prefix("server-") else {
            continue;
        };

        let target = bin_dir.join(format!("rustzen-admin-{version_suffix}"));
        if target.exists() {
            tracing::warn!(
                source = %source.display(),
                target = %target.display(),
                "Skipping legacy deploy server version migration because target already exists"
            );
            continue;
        }

        let should_rewrite_current_symlink = current_server_symlink_points_to(&bin_dir, &source)?;
        std::fs::rename(&source, &target)?;
        set_executable(&target)?;
        if should_rewrite_current_symlink {
            point_current_server_symlink_to(&bin_dir, &target)?;
        }
        tracing::info!(
            source = %source.display(),
            target = %target.display(),
            "Migrated legacy deploy server version"
        );
    }

    Ok(())
}

fn current_server_symlink_points_to(bin_dir: &Path, target: &Path) -> std::io::Result<bool> {
    #[cfg(unix)]
    {
        let symlink_path = bin_dir.join("rustzen-admin");
        let Ok(metadata) = std::fs::symlink_metadata(&symlink_path) else {
            return Ok(false);
        };
        if !metadata.file_type().is_symlink() {
            return Ok(false);
        }

        let symlink_target = std::fs::read_link(&symlink_path)?;
        let resolved_target = if symlink_target.is_absolute() {
            symlink_target
        } else {
            symlink_path.parent().unwrap_or(bin_dir).join(symlink_target)
        };

        return Ok(resolved_target.canonicalize()? == target.canonicalize()?);
    }

    #[cfg(not(unix))]
    {
        let _ = (bin_dir, target);
        Ok(false)
    }
}

fn point_current_server_symlink_to(bin_dir: &Path, target: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        let symlink_path = bin_dir.join("rustzen-admin");
        if std::fs::symlink_metadata(&symlink_path).is_ok() {
            std::fs::remove_file(&symlink_path)?;
        }
        let Some(file_name) = target.file_name() else {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "server binary target has no file name",
            ));
        };
        std::os::unix::fs::symlink(file_name, symlink_path)?;
    }

    #[cfg(not(unix))]
    {
        let _ = (bin_dir, target);
    }

    Ok(())
}

async fn migrate_legacy_deploy_file_paths(
    pool: &SqlitePool,
    runtime_root: &Path,
) -> Result<(), sqlx::Error> {
    let runtime_root = resolve_runtime_path(runtime_root);
    let bin_dir = runtime_root.join("bin");
    let rows = sqlx::query_as::<_, (i64, String)>(
        r#"
        SELECT id, file_path
        FROM deploy_versions
        WHERE component = 'server'
          AND deleted_at IS NULL
        "#,
    )
    .fetch_all(pool)
    .await?;

    for (id, old_file_path) in rows {
        let old_path = PathBuf::from(&old_file_path);
        if old_path.parent().and_then(|path| path.file_name()).and_then(|value| value.to_str())
            != Some("versions")
        {
            continue;
        }

        let Some(file_name) = old_path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let Some(version_suffix) = file_name.strip_prefix("server-") else {
            continue;
        };

        let new_path = bin_dir.join(format!("rustzen-admin-{version_suffix}"));
        if !new_path.exists() {
            tracing::warn!(
                id,
                old_file_path = %old_path.display(),
                new_file_path = %new_path.display(),
                "Skipping legacy deploy file path migration because migrated server file does not exist"
            );
            continue;
        }

        let new_file_path = new_path.to_string_lossy().into_owned();
        let result = sqlx::query(
            r#"
            UPDATE deploy_versions
            SET file_path = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND file_path = ?
            "#,
        )
        .bind(&new_file_path)
        .bind(id)
        .bind(&old_file_path)
        .execute(pool)
        .await?;

        if result.rows_affected() > 0 {
            tracing::info!(
                id,
                old_file_path = %old_path.display(),
                new_file_path = %new_path.display(),
                "Migrated legacy deploy file path"
            );
        }
    }

    Ok(())
}

fn resolve_runtime_path(path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir().map(|cwd| cwd.join(path)).unwrap_or_else(|_| path.to_path_buf())
    }
}

fn set_executable(path: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let mut permissions = std::fs::metadata(path)?.permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(path, permissions)?;
    }

    #[cfg(not(unix))]
    {
        let _ = path;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        db_idle_timeout, migrate_legacy_deploy_file_paths, migrate_legacy_deploy_server_versions,
        migrate_legacy_sqlite_files,
    };
    use rustzen_storage::sqlite::{
        DatabaseConnectionOptions, SqlitePool, connect_sqlite_with_options,
    };
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    fn temp_root(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "rustzen-admin-{name}-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos()
        ))
    }

    async fn deploy_versions_pool() -> SqlitePool {
        let pool = connect_sqlite_with_options(":memory:", DatabaseConnectionOptions::default())
            .await
            .expect("connect in-memory sqlite");
        sqlx::query(
            r#"
            CREATE TABLE deploy_versions (
                id INTEGER PRIMARY KEY,
                component TEXT NOT NULL,
                file_path TEXT NOT NULL,
                deleted_at DATETIME,
                updated_at DATETIME
            )
            "#,
        )
        .execute(&pool)
        .await
        .expect("create deploy_versions table");
        pool
    }

    #[test]
    fn db_idle_timeout_disables_reaping_for_zero() {
        assert_eq!(db_idle_timeout(0), None);
    }

    #[test]
    fn db_idle_timeout_uses_seconds_for_positive_values() {
        assert_eq!(db_idle_timeout(600), Some(Duration::from_secs(600)));
    }

    #[test]
    fn migrate_legacy_sqlite_files_moves_db_and_wal_files_to_data_db() {
        let root = std::env::temp_dir().join(format!(
            "rustzen-admin-db-migration-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos()
        ));
        let data_dir = root.join("data");
        std::fs::create_dir_all(&data_dir).expect("create data dir");
        std::fs::write(data_dir.join("rustzen.db"), b"db").expect("write db");
        std::fs::write(data_dir.join("rustzen.db-shm"), b"shm").expect("write shm");
        std::fs::write(data_dir.join("rustzen.db-wal"), b"wal").expect("write wal");

        let current = data_dir.join("db").join("rustzen.db");
        migrate_legacy_sqlite_files(&current).expect("migrate legacy sqlite files");

        assert!(!data_dir.join("rustzen.db").exists());
        assert!(!data_dir.join("rustzen.db-shm").exists());
        assert!(!data_dir.join("rustzen.db-wal").exists());
        assert_eq!(std::fs::read(current).expect("read db"), b"db");
        assert_eq!(std::fs::read(data_dir.join("db/rustzen.db-shm")).expect("read shm"), b"shm");
        assert_eq!(std::fs::read(data_dir.join("db/rustzen.db-wal")).expect("read wal"), b"wal");

        std::fs::remove_dir_all(root).expect("remove temp root");
    }

    #[test]
    fn migrate_legacy_sqlite_files_skips_whole_group_when_target_exists() {
        let root = std::env::temp_dir().join(format!(
            "rustzen-admin-db-migration-skip-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos()
        ));
        let data_dir = root.join("data");
        let current_dir = data_dir.join("db");
        std::fs::create_dir_all(&data_dir).expect("create data dir");
        std::fs::create_dir_all(&current_dir).expect("create current dir");
        std::fs::write(data_dir.join("rustzen.db"), b"legacy").expect("write legacy db");
        std::fs::write(data_dir.join("rustzen.db-wal"), b"legacy wal").expect("write legacy wal");
        std::fs::write(current_dir.join("rustzen.db"), b"current").expect("write current db");

        let current = current_dir.join("rustzen.db");
        migrate_legacy_sqlite_files(&current).expect("migrate legacy sqlite files");

        assert_eq!(std::fs::read(&current).expect("read current db"), b"current");
        assert_eq!(std::fs::read(data_dir.join("rustzen.db")).expect("read legacy db"), b"legacy");
        assert_eq!(
            std::fs::read(data_dir.join("rustzen.db-wal")).expect("read legacy wal"),
            b"legacy wal"
        );
        assert!(!current_dir.join("rustzen.db-wal").exists());

        std::fs::remove_dir_all(root).expect("remove temp root");
    }

    #[test]
    fn migrate_legacy_sqlite_files_leaves_orphan_sidecars_when_main_file_is_missing() {
        let root = std::env::temp_dir().join(format!(
            "rustzen-admin-db-migration-sidecars-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos()
        ));
        let data_dir = root.join("data");
        std::fs::create_dir_all(&data_dir).expect("create data dir");
        std::fs::write(data_dir.join("rustzen.db-shm"), b"shm").expect("write shm");
        std::fs::write(data_dir.join("rustzen.db-wal"), b"wal").expect("write wal");

        let current = data_dir.join("db").join("rustzen.db");
        migrate_legacy_sqlite_files(&current).expect("migrate legacy sqlite files");

        assert!(data_dir.join("rustzen.db-shm").exists());
        assert!(data_dir.join("rustzen.db-wal").exists());
        assert!(!current.exists());
        assert!(!data_dir.join("db/rustzen.db-shm").exists());
        assert!(!data_dir.join("db/rustzen.db-wal").exists());

        std::fs::remove_dir_all(root).expect("remove temp root");
    }

    #[test]
    fn migrate_legacy_deploy_server_versions_moves_server_files_to_bin() {
        let root = std::env::temp_dir().join(format!(
            "rustzen-admin-deploy-migration-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos()
        ));
        let versions_dir = root.join("versions");
        std::fs::create_dir_all(&versions_dir).expect("create versions dir");
        std::fs::write(versions_dir.join("server-0.4.0-x86_64"), b"server")
            .expect("write server version");
        std::fs::write(versions_dir.join("web-0.4.0.zip"), b"web").expect("write web version");

        migrate_legacy_deploy_server_versions(&root).expect("migrate legacy deploy versions");

        assert!(!versions_dir.join("server-0.4.0-x86_64").exists());
        assert_eq!(
            std::fs::read(root.join("bin/rustzen-admin-0.4.0-x86_64"))
                .expect("read migrated server"),
            b"server"
        );
        assert_eq!(
            std::fs::read(versions_dir.join("web-0.4.0.zip")).expect("read web version"),
            b"web"
        );

        std::fs::remove_dir_all(root).expect("remove temp root");
    }

    #[cfg(unix)]
    #[test]
    fn migrate_legacy_deploy_server_versions_rewrites_current_symlink() {
        let root = std::env::temp_dir().join(format!(
            "rustzen-admin-deploy-migration-symlink-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos()
        ));
        let versions_dir = root.join("versions");
        let bin_dir = root.join("bin");
        std::fs::create_dir_all(&versions_dir).expect("create versions dir");
        std::fs::create_dir_all(&bin_dir).expect("create bin dir");
        std::fs::write(versions_dir.join("server-0.4.0-x86_64"), b"server")
            .expect("write server version");
        std::os::unix::fs::symlink(
            "../versions/server-0.4.0-x86_64",
            bin_dir.join("rustzen-admin"),
        )
        .expect("create current symlink");

        migrate_legacy_deploy_server_versions(&root).expect("migrate legacy deploy versions");

        assert_eq!(
            std::fs::read_link(bin_dir.join("rustzen-admin")).expect("read current symlink"),
            std::path::PathBuf::from("rustzen-admin-0.4.0-x86_64")
        );
        assert_eq!(
            std::fs::read(bin_dir.join("rustzen-admin")).expect("read current server symlink"),
            b"server"
        );

        std::fs::remove_dir_all(root).expect("remove temp root");
    }

    #[test]
    fn migrate_legacy_deploy_server_versions_keeps_source_when_target_exists() {
        let root = std::env::temp_dir().join(format!(
            "rustzen-admin-deploy-migration-skip-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos()
        ));
        let versions_dir = root.join("versions");
        let bin_dir = root.join("bin");
        std::fs::create_dir_all(&versions_dir).expect("create versions dir");
        std::fs::create_dir_all(&bin_dir).expect("create bin dir");
        std::fs::write(versions_dir.join("server-0.4.0-x86_64"), b"legacy")
            .expect("write legacy server");
        std::fs::write(bin_dir.join("rustzen-admin-0.4.0-x86_64"), b"current")
            .expect("write current server");

        migrate_legacy_deploy_server_versions(&root).expect("migrate legacy deploy versions");

        assert_eq!(
            std::fs::read(versions_dir.join("server-0.4.0-x86_64")).expect("read legacy server"),
            b"legacy"
        );
        assert_eq!(
            std::fs::read(bin_dir.join("rustzen-admin-0.4.0-x86_64")).expect("read current server"),
            b"current"
        );

        std::fs::remove_dir_all(root).expect("remove temp root");
    }

    #[tokio::test]
    async fn migrate_legacy_deploy_file_paths_updates_rows_when_migrated_file_exists() {
        let root = temp_root("deploy-path-migration");
        let versions_dir = root.join("versions");
        let bin_dir = root.join("bin");
        std::fs::create_dir_all(&versions_dir).expect("create versions dir");
        std::fs::create_dir_all(&bin_dir).expect("create bin dir");
        let old_path = versions_dir.join("server-0.4.0-x86_64");
        let new_path = bin_dir.join("rustzen-admin-0.4.0-x86_64");
        std::fs::write(&new_path, b"server").expect("write migrated server");

        let pool = deploy_versions_pool().await;
        sqlx::query(
            r#"
            INSERT INTO deploy_versions (id, component, file_path)
            VALUES (1, 'server', ?)
            "#,
        )
        .bind(old_path.to_string_lossy().as_ref())
        .execute(&pool)
        .await
        .expect("insert deploy version");

        migrate_legacy_deploy_file_paths(&pool, &root).await.expect("migrate deploy file paths");

        let stored_path: String = sqlx::query_scalar(
            r#"
            SELECT file_path
            FROM deploy_versions
            WHERE id = 1
            "#,
        )
        .fetch_one(&pool)
        .await
        .expect("select deploy file path");
        assert_eq!(stored_path, new_path.to_string_lossy());

        std::fs::remove_dir_all(root).expect("remove temp root");
    }

    #[tokio::test]
    async fn migrate_legacy_deploy_file_paths_keeps_rows_when_migrated_file_is_missing() {
        let root = temp_root("deploy-path-migration-missing");
        let versions_dir = root.join("versions");
        std::fs::create_dir_all(&versions_dir).expect("create versions dir");
        let old_path = versions_dir.join("server-0.4.0-x86_64");

        let pool = deploy_versions_pool().await;
        sqlx::query(
            r#"
            INSERT INTO deploy_versions (id, component, file_path)
            VALUES (1, 'server', ?)
            "#,
        )
        .bind(old_path.to_string_lossy().as_ref())
        .execute(&pool)
        .await
        .expect("insert deploy version");

        migrate_legacy_deploy_file_paths(&pool, &root).await.expect("migrate deploy file paths");

        let stored_path: String = sqlx::query_scalar(
            r#"
            SELECT file_path
            FROM deploy_versions
            WHERE id = 1
            "#,
        )
        .fetch_one(&pool)
        .await
        .expect("select deploy file path");
        assert_eq!(stored_path, old_path.to_string_lossy());

        std::fs::remove_dir_all(root).expect("remove temp root");
    }
}
