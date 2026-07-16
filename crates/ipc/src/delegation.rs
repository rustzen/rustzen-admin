use std::{
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use hmac::{Hmac, Mac};
use http::{HeaderMap, HeaderName, HeaderValue, Method};
use sha2::Sha256;
use thiserror::Error;

pub const CONTRACT_VERSION: u32 = 1;
pub const DELEGATION_TTL: Duration = Duration::from_secs(30);

pub static IPC_CONTRACT_VERSION_HEADER: HeaderName =
    HeaderName::from_static("x-rustzen-contract-version");
pub static IPC_TIMESTAMP_HEADER: HeaderName = HeaderName::from_static("x-rustzen-ipc-timestamp");
pub static IPC_REQUEST_ID_HEADER: HeaderName = HeaderName::from_static("x-rustzen-request-id");
pub static IPC_USER_ID_HEADER: HeaderName = HeaderName::from_static("x-rustzen-user-id");
pub static IPC_MODULE_HEADER: HeaderName = HeaderName::from_static("x-rustzen-module");
pub static IPC_ACCESS_HEADER: HeaderName = HeaderName::from_static("x-rustzen-ipc-capability");
pub static IPC_SIGNATURE_HEADER: HeaderName = HeaderName::from_static("x-rustzen-ipc-signature");

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum DelegatedAccess {
    Protected(String),
    Public,
}

impl DelegatedAccess {
    pub fn protected(capability: impl Into<String>) -> Self {
        Self::Protected(capability.into())
    }

    pub fn as_header_value(&self) -> &str {
        match self {
            Self::Protected(capability) => capability,
            Self::Public => "public",
        }
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct DelegatedContext {
    pub contract_version: u32,
    pub timestamp: i64,
    pub request_id: String,
    pub user_id: Option<i64>,
    pub module: String,
    pub method: Method,
    pub path: String,
    pub access: DelegatedAccess,
}

impl DelegatedContext {
    pub fn new(
        request_id: impl Into<String>,
        user_id: Option<i64>,
        module: impl Into<String>,
        method: Method,
        path: impl Into<String>,
        access: DelegatedAccess,
    ) -> Result<Self, DelegationError> {
        Self::at(unix_timestamp()?, request_id, user_id, module, method, path, access)
    }

    pub fn at(
        timestamp: i64,
        request_id: impl Into<String>,
        user_id: Option<i64>,
        module: impl Into<String>,
        method: Method,
        path: impl Into<String>,
        access: DelegatedAccess,
    ) -> Result<Self, DelegationError> {
        let context = Self {
            contract_version: CONTRACT_VERSION,
            timestamp,
            request_id: request_id.into(),
            user_id,
            module: module.into(),
            method,
            path: normalize_path(&path.into())?,
            access,
        };
        context.validate()?;
        Ok(context)
    }

    fn validate(&self) -> Result<(), DelegationError> {
        validate_module_id(&self.module)?;
        if self.request_id.trim().is_empty() || self.request_id.contains(['\n', '\r']) {
            return Err(DelegationError::InvalidRequestId);
        }
        match &self.access {
            DelegatedAccess::Protected(capability) => {
                if self.user_id.is_none_or(|user_id| user_id <= 0) {
                    return Err(DelegationError::InvalidIdentity);
                }
                validate_capability(&self.module, capability)?;
            }
            DelegatedAccess::Public if self.user_id.is_some() => {
                return Err(DelegationError::InvalidIdentity);
            }
            DelegatedAccess::Public => {}
        }
        Ok(())
    }
}

#[derive(Clone)]
pub struct DelegationSigner {
    secret: Arc<[u8]>,
}

impl DelegationSigner {
    pub fn new(secret: impl AsRef<[u8]>) -> Result<Self, DelegationError> {
        let secret = secret.as_ref();
        if secret.is_empty() {
            return Err(DelegationError::EmptySecret);
        }
        Ok(Self { secret: Arc::from(secret) })
    }

    pub fn sign(&self, context: &DelegatedContext) -> Result<HeaderMap, DelegationError> {
        context.validate()?;
        let mut headers = HeaderMap::new();
        insert_header(
            &mut headers,
            &IPC_CONTRACT_VERSION_HEADER,
            &context.contract_version.to_string(),
        )?;
        insert_header(&mut headers, &IPC_TIMESTAMP_HEADER, &context.timestamp.to_string())?;
        insert_header(&mut headers, &IPC_REQUEST_ID_HEADER, &context.request_id)?;
        insert_header(
            &mut headers,
            &IPC_USER_ID_HEADER,
            &context.user_id.map_or_else(|| "anonymous".to_string(), |id| id.to_string()),
        )?;
        insert_header(&mut headers, &IPC_MODULE_HEADER, &context.module)?;
        insert_header(&mut headers, &IPC_ACCESS_HEADER, context.access.as_header_value())?;
        insert_header(&mut headers, &IPC_SIGNATURE_HEADER, &self.signature(context)?)?;
        Ok(headers)
    }

    fn signature(&self, context: &DelegatedContext) -> Result<String, DelegationError> {
        let mut mac =
            HmacSha256::new_from_slice(&self.secret).map_err(|_| DelegationError::InvalidSecret)?;
        mac.update(signing_payload(context).as_bytes());
        Ok(hex::encode(mac.finalize().into_bytes()))
    }
}

#[derive(Clone)]
pub struct DelegationVerifier {
    secret: Arc<[u8]>,
    ttl: Duration,
}

impl DelegationVerifier {
    pub fn new(secret: impl AsRef<[u8]>) -> Result<Self, DelegationError> {
        let signer = DelegationSigner::new(secret)?;
        Ok(Self { secret: signer.secret, ttl: DELEGATION_TTL })
    }

    #[cfg(test)]
    fn with_ttl(secret: impl AsRef<[u8]>, ttl: Duration) -> Result<Self, DelegationError> {
        let signer = DelegationSigner::new(secret)?;
        Ok(Self { secret: signer.secret, ttl })
    }

    pub fn verify(
        &self,
        headers: &HeaderMap,
        actual_method: &Method,
        actual_path: &str,
    ) -> Result<DelegatedContext, DelegationError> {
        self.verify_at(headers, actual_method, actual_path, unix_timestamp()?)
    }

    pub fn verify_for_route(
        &self,
        headers: &HeaderMap,
        actual_method: &Method,
        actual_path: &str,
        expected_module: &str,
        expected_access: &DelegatedAccess,
    ) -> Result<DelegatedContext, DelegationError> {
        let context = self.verify(headers, actual_method, actual_path)?;
        if context.module != expected_module {
            return Err(DelegationError::ModuleMismatch);
        }
        if &context.access != expected_access {
            return Err(DelegationError::CapabilityMismatch);
        }
        Ok(context)
    }

    fn verify_at(
        &self,
        headers: &HeaderMap,
        actual_method: &Method,
        actual_path: &str,
        now: i64,
    ) -> Result<DelegatedContext, DelegationError> {
        let version = header(headers, &IPC_CONTRACT_VERSION_HEADER)?
            .parse::<u32>()
            .map_err(|_| DelegationError::InvalidContractVersion)?;
        if version != CONTRACT_VERSION {
            return Err(DelegationError::InvalidContractVersion);
        }
        let timestamp = header(headers, &IPC_TIMESTAMP_HEADER)?
            .parse::<i64>()
            .map_err(|_| DelegationError::InvalidTimestamp)?;
        if now.abs_diff(timestamp) > self.ttl.as_secs() {
            return Err(DelegationError::Expired);
        }
        let request_id = header(headers, &IPC_REQUEST_ID_HEADER)?.to_string();
        let user_id = match header(headers, &IPC_USER_ID_HEADER)? {
            "anonymous" => None,
            value => Some(value.parse::<i64>().map_err(|_| DelegationError::InvalidUserId)?),
        };
        let module = header(headers, &IPC_MODULE_HEADER)?.to_string();
        let access = match header(headers, &IPC_ACCESS_HEADER)? {
            "public" => DelegatedAccess::Public,
            capability => DelegatedAccess::Protected(capability.to_string()),
        };
        let context = DelegatedContext::at(
            timestamp,
            request_id,
            user_id,
            module,
            actual_method.clone(),
            actual_path,
            access,
        )?;
        let provided = hex::decode(header(headers, &IPC_SIGNATURE_HEADER)?)
            .map_err(|_| DelegationError::InvalidSignature)?;
        let mut mac =
            HmacSha256::new_from_slice(&self.secret).map_err(|_| DelegationError::InvalidSecret)?;
        mac.update(signing_payload(&context).as_bytes());
        mac.verify_slice(&provided).map_err(|_| DelegationError::InvalidSignature)?;
        Ok(context)
    }
}

fn signing_payload(context: &DelegatedContext) -> String {
    format!(
        "{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}",
        context.contract_version,
        context.timestamp,
        context.request_id,
        context.user_id.map_or_else(|| "anonymous".to_string(), |id| id.to_string()),
        context.module,
        context.method.as_str(),
        context.path,
        context.access.as_header_value(),
    )
}

fn insert_header(
    headers: &mut HeaderMap,
    name: &HeaderName,
    value: &str,
) -> Result<(), DelegationError> {
    let value = HeaderValue::from_str(value).map_err(|_| DelegationError::InvalidHeader)?;
    headers.insert(name, value);
    Ok(())
}

fn header<'a>(headers: &'a HeaderMap, name: &HeaderName) -> Result<&'a str, DelegationError> {
    headers
        .get(name)
        .ok_or_else(|| DelegationError::MissingHeader(name.as_str().to_string()))?
        .to_str()
        .map_err(|_| DelegationError::InvalidHeader)
}

pub(crate) fn validate_module_id(module: &str) -> Result<(), DelegationError> {
    if module.is_empty()
        || !module
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return Err(DelegationError::InvalidModule);
    }
    Ok(())
}

pub(crate) fn validate_capability(module: &str, capability: &str) -> Result<(), DelegationError> {
    let Some(suffix) = capability.strip_prefix(module).and_then(|value| value.strip_prefix(':'))
    else {
        return Err(DelegationError::InvalidCapability);
    };
    if suffix.split(':').any(|segment| {
        segment.is_empty()
            || !segment.bytes().all(|byte| {
                byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'_' | b'-')
            })
    }) {
        return Err(DelegationError::InvalidCapability);
    }
    Ok(())
}

pub(crate) fn normalize_path(path: &str) -> Result<String, DelegationError> {
    if !path.starts_with('/')
        || path.contains(['?', '#', '\n', '\r'])
        || path.contains("//")
        || path.split('/').any(|segment| matches!(segment, "." | ".."))
    {
        return Err(DelegationError::InvalidPath);
    }
    Ok(path.to_string())
}

fn unix_timestamp() -> Result<i64, DelegationError> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| DelegationError::InvalidTimestamp)?;
    i64::try_from(duration.as_secs()).map_err(|_| DelegationError::InvalidTimestamp)
}

#[derive(Debug, Error, Clone, Eq, PartialEq)]
pub enum DelegationError {
    #[error("delegation secret must not be empty")]
    EmptySecret,
    #[error("delegation secret is invalid")]
    InvalidSecret,
    #[error("missing delegated request header {0}")]
    MissingHeader(String),
    #[error("delegated request header is invalid")]
    InvalidHeader,
    #[error("delegated request contract version is invalid")]
    InvalidContractVersion,
    #[error("delegated request timestamp is invalid")]
    InvalidTimestamp,
    #[error("delegated request has expired")]
    Expired,
    #[error("delegated request ID is invalid")]
    InvalidRequestId,
    #[error("delegated user ID is invalid")]
    InvalidUserId,
    #[error("delegated identity does not match protected or public access")]
    InvalidIdentity,
    #[error("delegated module is invalid")]
    InvalidModule,
    #[error("delegated path is invalid")]
    InvalidPath,
    #[error("delegated capability is invalid")]
    InvalidCapability,
    #[error("delegated request signature is invalid")]
    InvalidSignature,
    #[error("delegated module does not match the local route")]
    ModuleMismatch,
    #[error("delegated capability does not match the local route")]
    CapabilityMismatch,
}

#[cfg(test)]
mod tests {
    use http::Method;

    use super::{
        DelegatedAccess, DelegatedContext, DelegationError, DelegationSigner, DelegationVerifier,
        unix_timestamp,
    };

    fn signed_context(timestamp: i64) -> (DelegatedContext, http::HeaderMap) {
        let context = DelegatedContext::at(
            timestamp,
            "request-1",
            Some(7),
            "reports",
            Method::GET,
            "/api/reports/jobs/42",
            DelegatedAccess::protected("reports:view"),
        )
        .expect("context");
        let headers =
            DelegationSigner::new("secret").expect("signer").sign(&context).expect("sign");
        (context, headers)
    }

    #[test]
    fn signature_is_bound_to_method_path_module_and_capability() {
        let now = unix_timestamp().expect("timestamp");
        let (context, headers) = signed_context(now);
        let verifier = DelegationVerifier::with_ttl("secret", std::time::Duration::from_secs(30))
            .expect("verifier");

        assert_eq!(
            verifier.verify_at(&headers, &Method::GET, &context.path, now + 10).expect("verify"),
            context
        );
        assert!(matches!(
            verifier.verify_at(&headers, &Method::POST, &context.path, now + 10),
            Err(DelegationError::InvalidSignature)
        ));
        assert!(matches!(
            verifier.verify_at(&headers, &Method::GET, "/api/reports/jobs/43", now + 10),
            Err(DelegationError::InvalidSignature)
        ));
        assert!(matches!(
            verifier.verify_for_route(
                &headers,
                &Method::GET,
                &context.path,
                "insights",
                &DelegatedAccess::protected("insights:view"),
            ),
            Err(DelegationError::ModuleMismatch | DelegationError::CapabilityMismatch)
        ));
    }

    #[test]
    fn signature_expires_after_thirty_seconds() {
        let (context, headers) = signed_context(100);
        let verifier = DelegationVerifier::with_ttl("secret", std::time::Duration::from_secs(30))
            .expect("verifier");

        assert!(matches!(
            verifier.verify_at(&headers, &Method::GET, &context.path, 131),
            Err(DelegationError::Expired)
        ));
    }

    #[test]
    fn cross_module_and_wildcard_capabilities_are_rejected() {
        for capability in [
            "insights:view",
            "*",
            "reports:*",
            "reports:*:manage",
            "reports:foo*",
            "reports:View",
            "reports:view ",
        ] {
            assert!(matches!(
                DelegatedContext::at(
                    100,
                    "request-1",
                    Some(7),
                    "reports",
                    Method::GET,
                    "/api/reports/jobs",
                    DelegatedAccess::protected(capability),
                ),
                Err(DelegationError::InvalidCapability)
            ));
        }
    }

    #[test]
    fn protected_requires_a_user_and_public_requires_anonymous() {
        assert!(matches!(
            DelegatedContext::at(
                100,
                "request-1",
                None,
                "reports",
                Method::GET,
                "/api/reports/jobs",
                DelegatedAccess::protected("reports:view"),
            ),
            Err(DelegationError::InvalidIdentity)
        ));
        assert!(matches!(
            DelegatedContext::at(
                100,
                "request-1",
                Some(7),
                "insights",
                Method::POST,
                "/api/insights/track",
                DelegatedAccess::Public,
            ),
            Err(DelegationError::InvalidIdentity)
        ));
    }
}
