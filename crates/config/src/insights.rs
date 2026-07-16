use std::path::PathBuf;

use serde::Deserialize;

use crate::shared::{
    ConfigError, DatabaseConfig, RuntimeConfig, default_ipc_token, ensure_optional_non_empty,
    ensure_production_secret, load, local,
};

const DEFAULT_INTERNAL_HOST: &str = "127.0.0.1";
const DEFAULT_INSIGHTS_PORT: u16 = 9803;
const DEFAULT_INSIGHTS_SQLITE_PATH: &str = "./data/db/insights.db";

#[derive(Debug, Clone, Deserialize)]
pub struct InsightsConfig {
    #[serde(flatten)]
    pub runtime: RuntimeConfig,
    #[serde(flatten)]
    pub database: DatabaseConfig,
    #[serde(default)]
    pub internal_host: Option<String>,
    #[serde(default)]
    pub insights_port: Option<u16>,
    #[serde(default)]
    pub insights_sqlite_path: Option<String>,
    #[serde(default = "default_ipc_token")]
    pub ipc_token: String,
}

impl InsightsConfig {
    pub fn load() -> Result<Self, ConfigError> {
        let config: Self = load()?;
        config.validate()?;
        Ok(config)
    }

    pub fn local() -> Result<Self, ConfigError> {
        let config: Self = local()?;
        config.validate()?;
        Ok(config)
    }

    pub fn internal_host(&self) -> &str {
        self.internal_host.as_deref().unwrap_or(DEFAULT_INTERNAL_HOST)
    }

    pub fn insights_port(&self) -> u16 {
        self.insights_port.unwrap_or(DEFAULT_INSIGHTS_PORT)
    }

    pub fn bind_address(&self) -> String {
        format!("{}:{}", self.internal_host(), self.insights_port())
    }

    pub fn database_path(&self) -> PathBuf {
        self.runtime.resolve_path(
            self.insights_sqlite_path.as_deref().unwrap_or(DEFAULT_INSIGHTS_SQLITE_PATH),
        )
    }

    pub fn timezone(&self) -> &str {
        self.runtime.timezone()
    }

    fn validate(&self) -> Result<(), ConfigError> {
        self.runtime.validate()?;
        ensure_optional_non_empty("RUSTZEN_INTERNAL_HOST", self.internal_host.as_deref())?;
        ensure_optional_non_empty(
            "RUSTZEN_INSIGHTS_SQLITE_PATH",
            self.insights_sqlite_path.as_deref(),
        )?;
        ensure_production_secret(
            &self.runtime,
            "RUSTZEN_IPC_TOKEN",
            &self.ipc_token,
            crate::shared::DEFAULT_IPC_TOKEN,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::InsightsConfig;

    #[test]
    fn local_insights_config_uses_its_own_endpoint_and_database() {
        let config = InsightsConfig::local().expect("local Insights config");

        assert_eq!(config.bind_address(), "127.0.0.1:9803");
        assert!(config.database_path().ends_with("data/db/insights.db"));
        assert_eq!(config.database.db_idle_timeout, None);
    }

    #[test]
    fn production_insights_requires_only_the_shared_ipc_secret() {
        let mut config = InsightsConfig::local().expect("local Insights config");
        config.runtime.environment = "production".to_string();
        config.ipc_token = "production-ipc-secret".to_string();
        config.validate().expect("focused production Insights config");
        config.ipc_token = "replace-me".to_string();
        assert!(config.validate().is_err());
    }
}
