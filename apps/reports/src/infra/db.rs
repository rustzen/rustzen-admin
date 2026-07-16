use std::path::Path;

use rustzen_storage::sqlite::{
    DatabaseConnectionOptions, SqlitePool, connect_sqlite_with_options, database_url_from_path,
};

use crate::config;

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

pub async fn create_pool() -> Result<SqlitePool, rustzen_storage::CoreError> {
    create_pool_for_path(&config::CONFIG.database_path()).await
}

pub async fn create_pool_for_path(path: &Path) -> Result<SqlitePool, rustzen_storage::CoreError> {
    let options = DatabaseConnectionOptions {
        max_connections: config::CONFIG.database.max_connections(),
        min_connections: config::CONFIG.database.min_connections(),
        connect_timeout: config::CONFIG.database.connect_timeout(),
        idle_timeout: config::CONFIG.database.idle_timeout(),
    };
    connect_sqlite_with_options(&database_url_from_path(path), options).await
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    MIGRATOR.run(pool).await
}

pub use rustzen_storage::sqlite::test_connection;

#[cfg(test)]
mod tests {
    use sqlx::sqlite::SqlitePoolOptions;

    use super::MIGRATOR;

    #[tokio::test]
    async fn fresh_reports_database_migrates() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect");
        MIGRATOR.run(&pool).await.expect("migrate");
    }
}
