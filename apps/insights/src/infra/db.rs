use std::error::Error;

use rustzen_storage::{
    SqlitePool, connect_sqlite_with_options, database_url_from_path, test_connection,
};

use crate::config;

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

pub async fn connect() -> Result<SqlitePool, Box<dyn Error + Send + Sync>> {
    let path = config::CONFIG.database_path();
    let url = database_url_from_path(&path);
    let pool = connect_sqlite_with_options(
        &url,
        rustzen_storage::DatabaseConnectionOptions {
            max_connections: config::CONFIG.database.max_connections(),
            min_connections: config::CONFIG.database.min_connections(),
            connect_timeout: config::CONFIG.database.connect_timeout(),
            idle_timeout: config::CONFIG.database.idle_timeout(),
        },
    )
    .await?;
    migrate(&pool).await?;
    test_connection(&pool).await?;
    Ok(pool)
}

pub async fn migrate(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    MIGRATOR.run(pool).await
}
