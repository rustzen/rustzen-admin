use rustzen_config::InsightsConfig;
use std::sync::LazyLock;

pub static CONFIG: LazyLock<InsightsConfig> =
    LazyLock::new(|| InsightsConfig::load().expect("Failed to load Insights configuration"));
