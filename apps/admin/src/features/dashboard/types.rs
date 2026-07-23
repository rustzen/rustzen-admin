use serde::Serialize;

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsResp {
    pub total_users: i64,
    pub active_users: i64,
    pub today_logins: i64,
    pub pending_users: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleHealthResp {
    pub module: &'static str,
    pub available: bool,
    pub release_version: Option<String>,
}
