use rustzen_storage::{
    DatabaseConnectionOptions, SqlitePool, connect_sqlite_with_options, database_url_from_path,
    test_connection,
};

use crate::config;

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

pub async fn connect() -> Result<SqlitePool, rustzen_storage::CoreError> {
    let url = database_url_from_path(config::controller().database_path());
    connect_sqlite_with_options(
        &url,
        DatabaseConnectionOptions {
            max_connections: config::controller().database.max_connections(),
            min_connections: config::controller().database.min_connections(),
            connect_timeout: config::controller().database.connect_timeout(),
            idle_timeout: config::controller().database.idle_timeout(),
        },
    )
    .await
}

pub async fn migrate(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    MIGRATOR.run(pool).await
}

pub async fn verify(pool: &SqlitePool) -> Result<(), rustzen_storage::CoreError> {
    test_connection(pool).await
}

#[cfg(test)]
pub async fn migrated_test_pool() -> SqlitePool {
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("connect test database");
    migrate(&pool).await.expect("migrate test database");
    pool
}

#[cfg(test)]
mod tests {
    use super::migrated_test_pool;

    #[tokio::test]
    async fn fresh_monitor_database_migrates() {
        let pool = migrated_test_pool().await;
        pool.close().await;
    }
}
