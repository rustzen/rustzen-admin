use axum::{
    Json,
    extract::Request,
    http::{HeaderMap, StatusCode, header::HeaderName},
    middleware::Next,
    response::{IntoResponse, Response},
};
use hmac::{Hmac, Mac};
use serde::Serialize;
use sha2::Sha256;

use crate::infra::config::CONFIG;

pub const IPC_CONTRACT_VERSION: &str = "1";
pub static IPC_VERSION_HEADER: HeaderName = HeaderName::from_static("x-rustzen-contract-version");
pub static IPC_TIMESTAMP_HEADER: HeaderName = HeaderName::from_static("x-rustzen-ipc-timestamp");
pub static IPC_CAPABILITY_HEADER: HeaderName = HeaderName::from_static("x-rustzen-ipc-capability");
pub static IPC_SIGNATURE_HEADER: HeaderName = HeaderName::from_static("x-rustzen-ipc-signature");

type HmacSha256 = Hmac<Sha256>;

pub async fn require_ipc(request: Request, next: Next) -> Response {
    if verify_ipc_request(&request).is_err() {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ErrorBody { error: "invalid or expired IPC context" }),
        )
            .into_response();
    }
    next.run(request).await
}

pub fn ipc_client() -> Result<reqwest::Client, Box<dyn std::error::Error>> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(Into::into)
}

pub fn sign_ipc_request(
    request: reqwest::RequestBuilder,
    method: &str,
    path: &str,
    capability: &str,
) -> Result<reqwest::RequestBuilder, Box<dyn std::error::Error>> {
    let timestamp = chrono::Utc::now().timestamp().to_string();
    let signature = signature(method, path, &timestamp, capability)?;
    Ok(request
        .header(&IPC_VERSION_HEADER, IPC_CONTRACT_VERSION)
        .header(&IPC_TIMESTAMP_HEADER, &timestamp)
        .header(&IPC_CAPABILITY_HEADER, capability)
        .header(&IPC_SIGNATURE_HEADER, signature))
}

pub fn require_capability(headers: &HeaderMap, required: &str) -> Result<(), (StatusCode, String)> {
    let capability = header_value(headers, &IPC_CAPABILITY_HEADER)
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "missing IPC capability".to_string()))?;
    if capability != required {
        return Err((StatusCode::FORBIDDEN, "IPC capability is not allowed".to_string()));
    }
    Ok(())
}

fn verify_ipc_request(request: &Request) -> Result<(), ()> {
    let headers = request.headers();
    if header_value(headers, &IPC_VERSION_HEADER) != Some(IPC_CONTRACT_VERSION) {
        return Err(());
    }
    let timestamp = header_value(headers, &IPC_TIMESTAMP_HEADER).ok_or(())?;
    let timestamp_value = timestamp.parse::<i64>().map_err(|_| ())?;
    if (chrono::Utc::now().timestamp() - timestamp_value).abs() > 30 {
        return Err(());
    }
    let capability = header_value(headers, &IPC_CAPABILITY_HEADER).ok_or(())?;
    let provided = header_value(headers, &IPC_SIGNATURE_HEADER).ok_or(())?;
    let provided = hex::decode(provided).map_err(|_| ())?;
    let mut mac = HmacSha256::new_from_slice(CONFIG.ipc_token.as_bytes()).map_err(|_| ())?;
    mac.update(
        signing_payload(request.method().as_str(), request.uri().path(), timestamp, capability)
            .as_bytes(),
    );
    mac.verify_slice(&provided).map_err(|_| ())
}

fn signature(
    method: &str,
    path: &str,
    timestamp: &str,
    capability: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let mut mac = HmacSha256::new_from_slice(CONFIG.ipc_token.as_bytes())?;
    mac.update(signing_payload(method, path, timestamp, capability).as_bytes());
    Ok(hex::encode(mac.finalize().into_bytes()))
}

fn signing_payload(method: &str, path: &str, timestamp: &str, capability: &str) -> String {
    format!("{IPC_CONTRACT_VERSION}\n{method}\n{path}\n{timestamp}\n{capability}")
}

fn header_value<'a>(headers: &'a HeaderMap, name: &HeaderName) -> Option<&'a str> {
    headers.get(name).and_then(|value| value.to_str().ok())
}

#[derive(Serialize)]
struct ErrorBody {
    error: &'static str,
}

pub async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "contractVersion": IPC_CONTRACT_VERSION,
        "releaseVersion": env!("CARGO_PKG_VERSION")
    }))
}

pub fn map_worker_error(error: impl std::fmt::Display) -> Box<dyn std::error::Error> {
    std::io::Error::other(error.to_string()).into()
}

#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{HeaderMap, Request},
    };

    use super::{IPC_CAPABILITY_HEADER, require_capability, sign_ipc_request, verify_ipc_request};

    #[test]
    fn signed_context_is_bound_to_method_path_and_capability() {
        let client = reqwest::Client::new();
        let signed = sign_ipc_request(
            client.get("http://127.0.0.1/ipc/v1/monitor/nodes"),
            "GET",
            "/ipc/v1/monitor/nodes",
            "monitor:view",
        )
        .expect("sign")
        .build()
        .expect("request");
        let mut request = Request::builder()
            .method("GET")
            .uri("/ipc/v1/monitor/nodes")
            .body(Body::empty())
            .expect("request");
        *request.headers_mut() = signed.headers().clone();
        assert!(verify_ipc_request(&request).is_ok());

        *request.uri_mut() = "/ipc/v1/reports/jobs".parse().expect("uri");
        assert!(verify_ipc_request(&request).is_err());
    }

    #[test]
    fn worker_capability_check_denies_cross_module_access() {
        let mut headers = HeaderMap::new();
        headers.insert(&IPC_CAPABILITY_HEADER, "insights:view".parse().expect("header"));
        assert!(require_capability(&headers, "insights:view").is_ok());
        assert!(require_capability(&headers, "reports:view").is_err());
    }
}
