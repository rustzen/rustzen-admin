use rustzen_config::AdminConfig;
use std::sync::LazyLock;

pub static CONFIG: LazyLock<AdminConfig> =
    LazyLock::new(|| AdminConfig::load().expect("Failed to load Admin configuration"));
