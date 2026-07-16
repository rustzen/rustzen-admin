//! Shared SQLite storage helpers for local-first runtime storage.

pub mod maintenance;
pub mod sqlite;

pub use maintenance::{SqliteMaintenancePlan, SqliteMaintenanceReport, run_sqlite_maintenance};
pub use sqlite::{
    CoreError, DatabaseConnectionOptions, SqlitePool, connect_sqlite, connect_sqlite_with_options,
    database_url_from_path, test_connection,
};
