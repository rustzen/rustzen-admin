use rustzen_config::{MonitorAgentConfig, MonitorControllerConfig};
use std::sync::LazyLock;

static CONTROLLER_CONFIG: LazyLock<MonitorControllerConfig> = LazyLock::new(|| {
    MonitorControllerConfig::load().expect("Failed to load Monitor Controller configuration")
});
static AGENT_CONFIG: LazyLock<MonitorAgentConfig> = LazyLock::new(|| {
    MonitorAgentConfig::load().expect("Failed to load Monitor Agent configuration")
});

pub fn controller() -> &'static MonitorControllerConfig {
    &CONTROLLER_CONFIG
}

pub fn agent() -> &'static MonitorAgentConfig {
    &AGENT_CONFIG
}
