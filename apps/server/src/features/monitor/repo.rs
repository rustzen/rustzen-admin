use reqwest::Method;
use rustzen_auth::capability::monitor;

use crate::{
    common::error::AppError, features::process_proxy::request_json, infra::config::CONFIG,
};

use super::types::MonitorPayload;

pub struct MonitorRepository;

impl MonitorRepository {
    pub async fn get(path: &str) -> Result<MonitorPayload, AppError> {
        request_json(
            "monitor",
            Method::GET,
            format!("{}{path}", CONFIG.monitor_base_url()),
            path,
            monitor::VIEW,
            None,
            None,
        )
        .await
        .map(MonitorPayload)
    }
}
