use rustzen_config::ReportsConfig;
use std::sync::LazyLock;

pub static CONFIG: LazyLock<ReportsConfig> =
    LazyLock::new(|| ReportsConfig::load().expect("Failed to load Reports configuration"));
