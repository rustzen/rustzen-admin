use serde::{Deserialize, Serialize};

use crate::CONTRACT_VERSION;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub contract_version: u32,
    pub release_version: String,
    pub status: String,
}

impl HealthResponse {
    pub fn ok(release_version: impl Into<String>) -> Self {
        Self {
            contract_version: CONTRACT_VERSION,
            release_version: release_version.into(),
            status: "ok".to_owned(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::HealthResponse;

    #[test]
    fn ok_serializes_and_deserializes_the_health_contract() {
        let response = HealthResponse::ok("0.5.0");
        let body = serde_json::to_string(&response).expect("serialize health response");

        assert_eq!(body, r#"{"contractVersion":1,"releaseVersion":"0.5.0","status":"ok"}"#);
        assert_eq!(
            serde_json::from_str::<HealthResponse>(&body).expect("deserialize health response"),
            response
        );
    }
}
