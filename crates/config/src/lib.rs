//! Shared runtime configuration helpers for sqlite-first runtime startup.

use figment::{Figment, providers::Env};
use once_cell::sync::Lazy;
use rustzen_runtime::{DEFAULT_FILES_PREFIX, DEFAULT_RUNTIME_ROOT, RuntimeLayout};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Default path to the local SQLite database file.
const DEFAULT_SQLITE_PATH: &str = "./data/db/admin.db";

/// Default host for the HTTP service.
const DEFAULT_APP_HOST: &str = "0.0.0.0";

/// Default port for the HTTP service.
const DEFAULT_APP_PORT: u16 = 9801;

const DEFAULT_MONITOR_PORT: u16 = 9802;
const DEFAULT_INSIGHTS_PORT: u16 = 9803;
const DEFAULT_REPORTS_PORT: u16 = 9804;
const DEFAULT_WORKER_HOST: &str = "127.0.0.1";
const DEFAULT_MONITOR_SQLITE_PATH: &str = "./data/db/monitor.db";
const DEFAULT_INSIGHTS_SQLITE_PATH: &str = "./data/db/insights.db";
const DEFAULT_REPORTS_SQLITE_PATH: &str = "./data/db/reports.db";
const DEFAULT_IPC_TOKEN: &str = "rustzen-dev-ipc-token-change-in-production";

/// Default maximum database pool size.
const DEFAULT_DB_MAX_CONN: u32 = 4;

/// Default minimum database pool size.
const DEFAULT_DB_MIN_CONN: u32 = 1;

/// Default database acquire timeout in seconds.
const DEFAULT_DB_CONN_TIMEOUT: u64 = 10;

/// Default database idle timeout in seconds.
const DEFAULT_DB_IDLE_TIMEOUT: u64 = 600;

/// Default JWT lifetime in seconds (2 hours).
const DEFAULT_JWT_EXPIRATION: i64 = 7200;

/// Development-only fallback JWT secret.
const DEFAULT_DEV_JWT_SECRET: &str = "rustzen-dev-jwt-secret-change-in-production";

/// Placeholder used by generated production configuration.
const RELEASE_SECRET_PLACEHOLDER: &str = "replace-me";

/// Release-package placeholder JWT secret.
const RELEASE_JWT_SECRET_PLACEHOLDER: &str = "rustzen-admin-release-{version}";

/// Release-package generated JWT secret prefix.
const RELEASE_JWT_SECRET_PREFIX: &str = "rustzen-admin-release-";

/// Default logging file prefix.
const DEFAULT_LOG_FILE_PREFIX: &str = "server";

/// Fixed retention period for Admin logs, task runs, metrics, events, and reports.
pub const RETENTION_DAYS: u64 = 30;

/// Default process and business timezone.
const DEFAULT_TIMEZONE: &str = "UTC";

/// Default task executor timeout in seconds.
const DEFAULT_TASK_RUN_TIMEOUT_SECONDS: u64 = 1800;

fn default_deploy_signature_required() -> bool {
    false
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Config {
    #[serde(default = "default_sqlite_path")]
    pub sqlite_path: String,
    #[serde(default = "default_app_port")]
    pub app_port: u16,
    #[serde(default = "default_app_host")]
    pub app_host: String,
    #[serde(default = "default_worker_host")]
    pub worker_host: String,
    #[serde(default = "default_monitor_port")]
    pub monitor_port: u16,
    #[serde(default = "default_insights_port")]
    pub insights_port: u16,
    #[serde(default = "default_reports_port")]
    pub reports_port: u16,
    #[serde(default = "default_monitor_sqlite_path")]
    pub monitor_sqlite_path: String,
    #[serde(default = "default_insights_sqlite_path")]
    pub insights_sqlite_path: String,
    #[serde(default = "default_reports_sqlite_path")]
    pub reports_sqlite_path: String,
    #[serde(default = "default_ipc_token")]
    pub ipc_token: String,
    #[serde(default = "default_db_max_conn")]
    pub db_max_conn: u32,
    #[serde(default = "default_db_min_conn")]
    pub db_min_conn: u32,
    #[serde(default = "default_db_conn_timeout")]
    pub db_conn_timeout: u64,
    #[serde(default = "default_db_idle_timeout")]
    pub db_idle_timeout: u64,
    #[serde(default = "default_jwt_secret")]
    pub jwt_secret: String,
    #[serde(default = "default_jwt_expiration")]
    pub jwt_expiration: i64,
    #[serde(default = "default_runtime_root")]
    pub runtime_root: String,
    #[serde(default = "default_files_prefix")]
    pub files_prefix: String,
    #[serde(default = "default_log_file_prefix")]
    pub log_file_prefix: String,
    #[serde(default = "default_timezone")]
    pub timezone: String,
    #[serde(default = "default_task_run_timeout_seconds")]
    pub task_run_timeout_seconds: u64,
    #[serde(default = "default_deploy_signature_required")]
    pub deploy_signature_required: bool,
    pub deploy_verify_key: Option<String>,
}

/// Global process configuration loaded from `RUSTZEN_*` env.
pub static CONFIG: Lazy<Config> = Lazy::new(|| {
    let config: Config = Figment::new()
        .merge(Env::prefixed("RUSTZEN_"))
        .extract()
        .expect("Failed to load configuration");
    ensure_production_config(&config);
    config
});

impl Config {
    pub fn runtime_layout(&self) -> RuntimeLayout {
        RuntimeLayout::new(&self.runtime_root, &self.files_prefix)
    }

    pub fn runtime_root_dir(&self) -> PathBuf {
        self.runtime_layout().runtime_root_dir()
    }

    pub fn web_dist_dir(&self) -> PathBuf {
        self.runtime_layout().web_dist_dir()
    }

    pub fn data_dir(&self) -> PathBuf {
        self.runtime_layout().data_dir()
    }

    pub fn log_dir(&self) -> PathBuf {
        self.runtime_layout().log_dir()
    }

    pub fn uploads_dir(&self) -> PathBuf {
        self.runtime_layout().uploads_dir()
    }

    pub fn avatars_dir(&self) -> PathBuf {
        self.runtime_layout().avatars_dir()
    }

    pub fn avatars_prefix(&self) -> String {
        self.runtime_layout().avatars_prefix()
    }

    pub fn sqlite_database_path(&self) -> PathBuf {
        self.runtime_layout().resolve_runtime_path(&self.sqlite_path)
    }

    pub fn monitor_database_path(&self) -> PathBuf {
        self.runtime_layout().resolve_runtime_path(&self.monitor_sqlite_path)
    }

    pub fn insights_database_path(&self) -> PathBuf {
        self.runtime_layout().resolve_runtime_path(&self.insights_sqlite_path)
    }

    pub fn reports_database_path(&self) -> PathBuf {
        self.runtime_layout().resolve_runtime_path(&self.reports_sqlite_path)
    }

    pub fn monitor_base_url(&self) -> String {
        format!("http://{}:{}", self.worker_host, self.monitor_port)
    }

    pub fn insights_base_url(&self) -> String {
        format!("http://{}:{}", self.worker_host, self.insights_port)
    }

    pub fn reports_base_url(&self) -> String {
        format!("http://{}:{}", self.worker_host, self.reports_port)
    }
}

fn default_sqlite_path() -> String {
    DEFAULT_SQLITE_PATH.to_string()
}

fn default_log_file_prefix() -> String {
    DEFAULT_LOG_FILE_PREFIX.to_string()
}

fn default_timezone() -> String {
    DEFAULT_TIMEZONE.to_string()
}

fn default_task_run_timeout_seconds() -> u64 {
    DEFAULT_TASK_RUN_TIMEOUT_SECONDS
}

fn default_app_port() -> u16 {
    DEFAULT_APP_PORT
}

fn default_app_host() -> String {
    DEFAULT_APP_HOST.to_string()
}

fn default_worker_host() -> String {
    DEFAULT_WORKER_HOST.to_string()
}

fn default_monitor_port() -> u16 {
    DEFAULT_MONITOR_PORT
}

fn default_insights_port() -> u16 {
    DEFAULT_INSIGHTS_PORT
}

fn default_reports_port() -> u16 {
    DEFAULT_REPORTS_PORT
}

fn default_monitor_sqlite_path() -> String {
    DEFAULT_MONITOR_SQLITE_PATH.to_string()
}

fn default_insights_sqlite_path() -> String {
    DEFAULT_INSIGHTS_SQLITE_PATH.to_string()
}

fn default_reports_sqlite_path() -> String {
    DEFAULT_REPORTS_SQLITE_PATH.to_string()
}

fn default_ipc_token() -> String {
    DEFAULT_IPC_TOKEN.to_string()
}

fn default_db_max_conn() -> u32 {
    DEFAULT_DB_MAX_CONN
}

fn default_db_min_conn() -> u32 {
    DEFAULT_DB_MIN_CONN
}

fn default_db_conn_timeout() -> u64 {
    DEFAULT_DB_CONN_TIMEOUT
}

fn default_db_idle_timeout() -> u64 {
    DEFAULT_DB_IDLE_TIMEOUT
}

fn default_jwt_expiration() -> i64 {
    DEFAULT_JWT_EXPIRATION
}

fn default_jwt_secret() -> String {
    DEFAULT_DEV_JWT_SECRET.to_string()
}

fn default_files_prefix() -> String {
    DEFAULT_FILES_PREFIX.to_string()
}

fn default_runtime_root() -> String {
    DEFAULT_RUNTIME_ROOT.to_string()
}

fn ensure_production_config(config: &Config) {
    let env = std::env::var("RUSTZEN_ENV").unwrap_or_else(|_| "development".to_string());
    let env = env.to_ascii_lowercase();
    let is_production = env == "production" || env == "prod";
    let is_release_layout = config.runtime_root.trim() == ".";
    let uses_dev_default = config.jwt_secret == DEFAULT_DEV_JWT_SECRET;
    let uses_placeholder = config.jwt_secret == RELEASE_SECRET_PLACEHOLDER
        || config.jwt_secret == RELEASE_JWT_SECRET_PLACEHOLDER
        || config.jwt_secret.starts_with(RELEASE_JWT_SECRET_PREFIX);
    let is_empty = config.jwt_secret.trim().is_empty();
    let uses_dev_ipc_token = config.ipc_token == DEFAULT_IPC_TOKEN;
    let uses_ipc_placeholder = config.ipc_token == RELEASE_SECRET_PLACEHOLDER;
    let ipc_token_is_empty = config.ipc_token.trim().is_empty();

    assert!(
        !((is_production || is_release_layout)
            && (uses_dev_default || uses_placeholder || is_empty)),
        "RUSTZEN_JWT_SECRET must be explicitly set for release/production and cannot use default or placeholder values"
    );
    assert!(
        !((is_production || is_release_layout)
            && (uses_dev_ipc_token || uses_ipc_placeholder || ipc_token_is_empty)),
        "RUSTZEN_IPC_TOKEN must be explicitly set for release/production and cannot use the development default"
    );
    assert!(
        !((is_production || is_release_layout) && !config.deploy_signature_required),
        "RUSTZEN_DEPLOY_SIGNATURE_REQUIRED must be enabled for release/production"
    );
    assert!(
        !((is_production || is_release_layout)
            && !is_valid_deploy_verify_key(config.deploy_verify_key.as_deref())),
        "RUSTZEN_DEPLOY_VERIFY_KEY must be a 32-byte hex public key for release/production"
    );
}

fn is_valid_deploy_verify_key(value: Option<&str>) -> bool {
    value.is_some_and(|value| {
        let value = value.trim();
        value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
    })
}

#[cfg(test)]
mod tests {
    use super::{
        Config, DEFAULT_DEV_JWT_SECRET, DEFAULT_IPC_TOKEN, default_runtime_root,
        ensure_production_config,
    };
    use figment::Figment;
    use rustzen_runtime::resolve_path_with_runtime_root;
    use std::env;
    use std::path::PathBuf;

    fn test_config(jwt_secret: &str, runtime_root: &str) -> Config {
        Config {
            sqlite_path: "./data/db/admin.db".to_string(),
            app_port: 9801,
            app_host: "0.0.0.0".to_string(),
            worker_host: "127.0.0.1".to_string(),
            monitor_port: 9802,
            insights_port: 9803,
            reports_port: 9804,
            monitor_sqlite_path: "./data/db/monitor.db".to_string(),
            insights_sqlite_path: "./data/db/insights.db".to_string(),
            reports_sqlite_path: "./data/db/reports.db".to_string(),
            ipc_token: "test-ipc-token".to_string(),
            db_max_conn: 4,
            db_min_conn: 1,
            db_conn_timeout: 10,
            db_idle_timeout: 600,
            jwt_secret: jwt_secret.to_string(),
            jwt_expiration: 3600,
            runtime_root: runtime_root.to_string(),
            files_prefix: "/resources".to_string(),
            log_file_prefix: "server".to_string(),
            timezone: "UTC".to_string(),
            task_run_timeout_seconds: 1800,
            deploy_signature_required: false,
            deploy_verify_key: None,
        }
    }

    #[test]
    fn runtime_root_default_uses_hidden_dev_dir() {
        assert_eq!(default_runtime_root(), ".rustzen-admin");
    }

    #[test]
    fn empty_environment_uses_built_in_runtime_defaults() {
        let config: Config = Figment::new().extract().expect("built-in config defaults");

        assert_eq!(config.sqlite_path, "./data/db/admin.db");
        assert_eq!(config.app_host, "0.0.0.0");
        assert_eq!(config.app_port, 9801);
        assert_eq!(config.worker_host, "127.0.0.1");
        assert_eq!(config.monitor_port, 9802);
        assert_eq!(config.insights_port, 9803);
        assert_eq!(config.reports_port, 9804);
        assert_eq!(config.runtime_root, ".rustzen-admin");
        assert_eq!(config.jwt_secret, DEFAULT_DEV_JWT_SECRET);
        assert_eq!(config.ipc_token, DEFAULT_IPC_TOKEN);
        assert_eq!(config.timezone, "UTC");
        assert_eq!(config.task_run_timeout_seconds, 1800);
        assert!(!config.deploy_signature_required);
        assert!(config.deploy_verify_key.is_none());
    }

    #[test]
    fn runtime_root_derives_standard_runtime_paths() {
        let config = test_config("secret", ".rustzen-admin");

        assert_eq!(config.web_dist_dir(), PathBuf::from(".rustzen-admin/web/dist"));
        assert_eq!(config.data_dir(), PathBuf::from(".rustzen-admin/data"));
        assert_eq!(config.log_dir(), PathBuf::from(".rustzen-admin/logs"));
        assert_eq!(config.uploads_dir(), PathBuf::from(".rustzen-admin/data/uploads"));
        assert_eq!(config.avatars_dir(), PathBuf::from(".rustzen-admin/data/avatars"));
    }

    #[test]
    fn sqlite_path_is_relative_to_runtime_root_when_not_absolute() {
        let cwd = env::current_dir().expect("cwd");
        let config = test_config("secret", ".rustzen-admin");

        let expected = resolve_path_with_runtime_root(".rustzen-admin", "./data/db/admin.db");
        assert_eq!(config.sqlite_database_path(), expected);
        assert!(config.sqlite_database_path().is_absolute());
        assert_eq!(config.sqlite_database_path(), cwd.join(".rustzen-admin/data/db/admin.db"));
    }

    #[test]
    fn release_layout_rejects_release_jwt_placeholder() {
        let config = test_config("rustzen-admin-release-{version}", ".");

        assert!(std::panic::catch_unwind(|| ensure_production_config(&config)).is_err());
    }

    #[test]
    fn release_layout_rejects_generated_release_jwt_placeholder() {
        let config = test_config("rustzen-admin-release-v0.2.3", ".");

        assert!(std::panic::catch_unwind(|| ensure_production_config(&config)).is_err());
    }

    #[test]
    fn release_layout_rejects_legacy_jwt_placeholder() {
        let config = test_config("replace-me", ".");

        assert!(std::panic::catch_unwind(|| ensure_production_config(&config)).is_err());
    }

    #[test]
    fn release_layout_rejects_ipc_placeholder() {
        let mut config = test_config("production-jwt-secret", ".");
        config.ipc_token = "replace-me".to_string();

        assert!(std::panic::catch_unwind(|| ensure_production_config(&config)).is_err());
    }

    #[test]
    fn release_layout_rejects_disabled_signature_verification() {
        let config = test_config("production-jwt-secret", ".");

        assert!(std::panic::catch_unwind(|| ensure_production_config(&config)).is_err());
    }

    #[test]
    fn release_layout_rejects_missing_verify_key() {
        let mut config = test_config("production-jwt-secret", ".");
        config.deploy_signature_required = true;

        assert!(std::panic::catch_unwind(|| ensure_production_config(&config)).is_err());
    }

    #[test]
    fn release_layout_accepts_hardened_production_config() {
        let mut config = test_config("production-jwt-secret", ".");
        config.deploy_signature_required = true;
        config.deploy_verify_key = Some("ab".repeat(32));

        ensure_production_config(&config);
    }
}
