use std::{
    fs,
    io::{Cursor, Read},
    path::{Path, PathBuf},
    sync::Arc,
};

use axum::extract::Multipart;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tokio::process::Command;
use zip::ZipArchive;

use crate::{
    common::{
        error::ServiceError,
        pagination::{Pagination, PaginationQuery},
    },
    features::manage::deploy::types::{
        DeployComponent, DeployVersionRequest, DeploymentItem, DeploymentPayload,
        ExpireVersionRequest, ListDeploymentsQuery,
    },
    infra::config::CONFIG,
};

use super::repo::DeployRepository;

pub const DEPLOY_FILE_MAX_SIZE: usize = 64 * 1024 * 1024;
const DEPLOY_BODY_LIMIT: usize = DEPLOY_FILE_MAX_SIZE + 1024 * 1024;
const SERVER_BINARY_NAME: &str = "rustzen-admin";
const SERVER_SYSTEMD_UNIT: &str = "rustzen-admin.service";
const WEB_MARKER_FILE: &str = "dist/__rustzen_admin_marker__.json";
const SERVER_MARKER_PREFIX: &[u8] = b"RUSTZEN_ADMIN_MARKER\ncomponent=server\n";
const SIGNED_MARKER_BEGIN: &[u8] = b"\nRUSTZEN_ADMIN_SIGNED_MARKER_BEGIN\n";
const SIGNED_MARKER_END: &[u8] = b"\nRUSTZEN_ADMIN_SIGNED_MARKER_END\n";
const DEPLOY_SIGNATURE_SCHEMA_VERSION: u8 = 1;
const DEPLOY_SIGNATURE_PAYLOAD_VERSION: &str = "rustzen-admin-deploy-v1";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeploySignatureMarker {
    schema_version: u8,
    component: String,
    version: String,
    arch: String,
    content_sha256: String,
    signature: String,
}

#[derive(Clone)]
pub struct DeployService {
    repo: Arc<DeployRepository>,
}

impl DeployService {
    pub fn new(pool: sqlx::SqlitePool) -> Self {
        Self { repo: Arc::new(DeployRepository::new(pool)) }
    }

    pub fn upload_body_limit() -> usize {
        DEPLOY_BODY_LIMIT
    }

    pub async fn list(
        &self,
        query: ListDeploymentsQuery,
    ) -> Result<(Vec<DeploymentItem>, i64), ServiceError> {
        let pagination = Pagination::from_query(PaginationQuery {
            current: query.current,
            page_size: query.page_size,
        });
        self.repo.list(&query, pagination.offset.into(), pagination.limit.into()).await
    }

    pub async fn upload(&self, mut multipart: Multipart) -> Result<DeploymentItem, ServiceError> {
        let mut component = None;
        let mut version = None;
        let mut arch = None;
        let mut notes = None;
        let mut file_data = None;

        while let Some(field) = multipart
            .next_field()
            .await
            .map_err(|_| ServiceError::InvalidOperation("Invalid multipart data".to_string()))?
        {
            let Some(name) = field.name().map(str::to_string) else {
                continue;
            };

            match name.as_str() {
                "component" => {
                    component = Some(parse_component(field.text().await.map_err(|_| {
                        ServiceError::InvalidOperation("Invalid component field".to_string())
                    })?)?);
                }
                "version" => {
                    version = Some(validate_version(field.text().await.map_err(|_| {
                        ServiceError::InvalidOperation("Invalid version field".to_string())
                    })?)?);
                }
                "arch" => {
                    arch = normalize_optional(field.text().await.map_err(|_| {
                        ServiceError::InvalidOperation("Invalid arch field".to_string())
                    })?);
                }
                "notes" => {
                    notes = normalize_optional(field.text().await.unwrap_or_default());
                }
                "file" => {
                    let data = field.bytes().await.map_err(|_| {
                        ServiceError::InvalidOperation("Failed to read uploaded file".to_string())
                    })?;
                    file_data = Some(data.to_vec());
                }
                _ => {}
            }
        }

        let component = component
            .ok_or_else(|| ServiceError::InvalidOperation("component is required".into()))?;
        let version =
            version.ok_or_else(|| ServiceError::InvalidOperation("version is required".into()))?;
        let file_data =
            file_data.ok_or_else(|| ServiceError::InvalidOperation("file is required".into()))?;
        validate_upload_size(&file_data)?;

        let arch = match component {
            DeployComponent::Server => {
                let arch = resolve_server_arch(arch.as_deref(), &file_data)?;
                validate_server_file(&file_data, &version, &arch)?;
                arch
            }
            DeployComponent::Web => {
                validate_web_file(&file_data, &version)?;
                "x86_64".to_string()
            }
        };

        if self.repo.version_exists(&component, &version, &arch).await? {
            return Err(ServiceError::InvalidOperation(
                "Deploy version has already been uploaded for this component and arch; use a new version.".to_string(),
            ));
        }

        let file_hash = sha256_hex(&file_data);
        let file_path = save_version_file(&component, &version, &arch, &file_data).await?;

        match self
            .repo
            .insert(&DeploymentPayload {
                component,
                version,
                arch,
                file_path: file_path.to_string_lossy().to_string(),
                file_size: file_data.len() as i64,
                file_hash,
                notes,
            })
            .await
        {
            Ok(item) => Ok(item),
            Err(err) => {
                if let Err(remove_err) = remove_deploy_file_path(&file_path) {
                    tracing::warn!(
                        "Failed to remove deploy file after database insert error file={}: {}",
                        file_path.display(),
                        remove_err
                    );
                }
                Err(err)
            }
        }
    }

    pub async fn find_by_id(&self, id: i64) -> Result<DeploymentItem, ServiceError> {
        self.repo.find_by_id(id).await
    }

    pub async fn deploy(
        &self,
        id: i64,
        request: DeployVersionRequest,
    ) -> Result<bool, ServiceError> {
        let version = self.repo.find_by_id(id).await?;
        ensure_version_is_deployable(&version)?;
        validate_stored_file(&version)?;

        match version.component {
            DeployComponent::Server => self.deploy_server(&version, &request).await?,
            DeployComponent::Web => self.deploy_web(&version, &request).await?,
        }

        Ok(true)
    }

    pub async fn expire(
        &self,
        id: i64,
        request: ExpireVersionRequest,
    ) -> Result<DeploymentItem, ServiceError> {
        self.repo.mark_expired(id, request.notes.as_deref()).await
    }

    pub async fn delete(&self, id: i64) -> Result<DeploymentItem, ServiceError> {
        let version = self.repo.find_by_id(id).await?;
        if version.is_current {
            return Err(ServiceError::InvalidOperation(
                "Cannot delete the current deploy version".to_string(),
            ));
        }
        let deleted = self.repo.delete_by_id(id).await?;
        if let Err(err) = remove_deploy_file(&deleted) {
            tracing::warn!(
                "Deploy version id={} was deleted from database but file cleanup failed file={}: {}",
                deleted.id,
                deleted.file_path,
                err
            );
        }
        Ok(deleted)
    }

    pub async fn cleanup_expired(
        &self,
        component: Option<DeployComponent>,
    ) -> Result<usize, ServiceError> {
        let versions = self.repo.expired_non_current(component.as_ref()).await?;
        let mut deleted = 0;

        for version in versions {
            let deleted_version = self.repo.delete_by_id(version.id).await?;
            if let Err(err) = remove_deploy_file(&deleted_version) {
                tracing::warn!(
                    "Deploy version id={} was expired in database but file cleanup failed file={}: {}",
                    deleted_version.id,
                    deleted_version.file_path,
                    err
                );
            }
            deleted += 1;
        }

        Ok(deleted)
    }

    async fn deploy_server(
        &self,
        version: &DeploymentItem,
        request: &DeployVersionRequest,
    ) -> Result<(), ServiceError> {
        let target_bin = runtime_root_dir().join("bin").join(SERVER_BINARY_NAME);
        fs::create_dir_all(parent_dir(&target_bin)?).map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to create bin directory: {err}"))
        })?;

        if let Some(current) = self.repo.find_current(&version.component, &version.arch).await?
            && current.id == version.id
            && fs::read_link(&target_bin)
                .map(|target| target == Path::new(&version.file_path))
                .unwrap_or(false)
        {
            return Ok(());
        }

        prepare_server_restart().await?;

        let old_target =
            swap_symlink(&target_bin, Path::new(&version.file_path)).map_err(|err| {
                ServiceError::InvalidOperation(format!("Failed to switch server binary: {err}"))
            })?;

        if let Err(err) = restart_server().await {
            if let Err(restore_err) = restore_symlink(&target_bin, old_target.as_deref()) {
                tracing::error!("Failed to restore server symlink: {}", restore_err);
            }
            return Err(err);
        }

        if let Err(err) = self
            .repo
            .set_current(
                &version.component,
                &version.arch,
                version.id,
                request.deployed_by.as_deref(),
            )
            .await
        {
            if let Err(restore_err) = restore_symlink(&target_bin, old_target.as_deref()) {
                tracing::error!("Failed to restore server symlink: {}", restore_err);
            } else if let Err(restart_err) = restart_server().await {
                tracing::error!(
                    "Failed to restart server after restoring previous symlink: {}",
                    restart_err
                );
            }
            return Err(err);
        }

        Ok(())
    }

    async fn deploy_web(
        &self,
        version: &DeploymentItem,
        request: &DeployVersionRequest,
    ) -> Result<(), ServiceError> {
        if let Some(current) = self.repo.find_current(&version.component, &version.arch).await?
            && current.id == version.id
        {
            return Ok(());
        }

        let web_root = runtime_root_dir().join("web");
        let tmp_dir = web_root.join(format!(".deploy-{}", version.id));
        if tmp_dir.exists() {
            fs::remove_dir_all(&tmp_dir).map_err(|err| {
                ServiceError::InvalidOperation(format!("Failed to clear temp web directory: {err}"))
            })?;
        }
        fs::create_dir_all(&tmp_dir).map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to create temp web directory: {err}"))
        })?;

        let extract_result = extract_zip_to_dir(Path::new(&version.file_path), &tmp_dir);
        if let Err(err) = extract_result {
            let _ = fs::remove_dir_all(&tmp_dir);
            return Err(err);
        }

        let extracted_dist = tmp_dir.join("dist");
        if !extracted_dist.join("index.html").is_file() {
            let _ = fs::remove_dir_all(&tmp_dir);
            return Err(ServiceError::InvalidOperation(
                "web package must contain dist/index.html".to_string(),
            ));
        }

        fs::create_dir_all(&web_root).map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to create web directory: {err}"))
        })?;
        let dist_dir = web_root.join("dist");
        let new_dist = web_root.join("dist.new");
        let prev_dist = web_root.join("dist.prev");
        remove_path_if_exists(&new_dist)?;
        fs::rename(&extracted_dist, &new_dist).map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to prepare new web dist: {err}"))
        })?;
        remove_path_if_exists(&prev_dist)?;
        if dist_dir.exists() {
            fs::rename(&dist_dir, &prev_dist).map_err(|err| {
                ServiceError::InvalidOperation(format!(
                    "Failed to archive previous web dist: {err}"
                ))
            })?;
        }
        fs::rename(&new_dist, &dist_dir).map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to activate web dist: {err}"))
        })?;
        let _ = fs::remove_dir_all(&tmp_dir);

        if let Err(err) = self
            .repo
            .set_current(
                &version.component,
                &version.arch,
                version.id,
                request.deployed_by.as_deref(),
            )
            .await
        {
            if let Err(restore_err) = restore_web_dist(&dist_dir, &prev_dist) {
                tracing::error!(
                    "Failed to rollback web dist after database error: {}",
                    restore_err
                );
            }
            return Err(err);
        }

        let _ = remove_path_if_exists(&prev_dist);
        Ok(())
    }
}

async fn save_version_file(
    component: &DeployComponent,
    version: &str,
    arch: &str,
    file_data: &[u8],
) -> Result<PathBuf, ServiceError> {
    let path = version_file_path(component, version, arch)?;
    if path.exists() {
        return Err(ServiceError::InvalidOperation(format!(
            "Deploy file already exists: {}",
            path.display()
        )));
    }
    fs::create_dir_all(parent_dir(&path)?).map_err(|err| {
        ServiceError::InvalidOperation(format!("Failed to create version directory: {err}"))
    })?;
    tokio::fs::write(&path, file_data).await.map_err(|err| {
        ServiceError::InvalidOperation(format!("Failed to save deploy file: {err}"))
    })?;

    if matches!(component, DeployComponent::Server) {
        set_executable(&path)?;
    }

    Ok(path)
}

fn version_file_path(
    component: &DeployComponent,
    version: &str,
    arch: &str,
) -> Result<PathBuf, ServiceError> {
    let root = runtime_root_dir();
    match component {
        DeployComponent::Server => {
            Ok(root.join("bin").join(format!("{SERVER_BINARY_NAME}-{version}-{arch}")))
        }
        DeployComponent::Web => Ok(root.join("web").join(format!("web-{version}.zip"))),
    }
}

fn validate_stored_file(version: &DeploymentItem) -> Result<(), ServiceError> {
    let data = fs::read(&version.file_path).map_err(|err| {
        ServiceError::InvalidOperation(format!("Failed to read deploy file: {err}"))
    })?;
    if data.len() as i64 != version.file_size {
        return Err(ServiceError::InvalidOperation(
            "Deploy file size does not match database record".to_string(),
        ));
    }
    let actual_hash = sha256_hex(&data);
    if actual_hash != version.file_hash {
        return Err(ServiceError::InvalidOperation(
            "Deploy file hash does not match database record".to_string(),
        ));
    }

    match version.component {
        DeployComponent::Server => validate_server_file(&data, &version.version, &version.arch),
        DeployComponent::Web => validate_web_file(&data, &version.version),
    }
}

fn validate_upload_size(file_data: &[u8]) -> Result<(), ServiceError> {
    if file_data.is_empty() {
        return Err(ServiceError::InvalidOperation("file is required".to_string()));
    }
    if file_data.len() > DEPLOY_FILE_MAX_SIZE {
        return Err(ServiceError::InvalidOperation(format!(
            "file must be smaller than {} MB",
            DEPLOY_FILE_MAX_SIZE / 1024 / 1024
        )));
    }
    Ok(())
}

fn validate_server_file(
    file_data: &[u8],
    expected_version: &str,
    expected_arch: &str,
) -> Result<(), ServiceError> {
    validate_server_file_with_signature_policy(
        file_data,
        expected_version,
        expected_arch,
        CONFIG.deploy_signature_required,
        CONFIG.deploy_verify_key.as_deref(),
    )
}

fn validate_server_file_with_signature_policy(
    file_data: &[u8],
    expected_version: &str,
    expected_arch: &str,
    signature_required: bool,
    verify_key: Option<&str>,
) -> Result<(), ServiceError> {
    if is_zip(file_data) {
        return Err(ServiceError::InvalidOperation(
            "server component does not accept zip files".to_string(),
        ));
    }
    if !(is_elf(file_data) || is_macho_or_fat(file_data)) {
        return Err(ServiceError::InvalidOperation(
            "server file must be an executable binary".to_string(),
        ));
    }
    if signature_required {
        validate_server_signed_marker(file_data, expected_version, expected_arch, verify_key)?;
    } else if !file_data
        .windows(SERVER_MARKER_PREFIX.len())
        .any(|window| window == SERVER_MARKER_PREFIX)
        && split_server_signed_marker(file_data).is_err()
    {
        return Err(ServiceError::InvalidOperation("server file marker check failed".to_string()));
    }
    if let Some(detected_arch) = detect_binary_arch(file_data)?
        && detected_arch != expected_arch
    {
        return Err(ServiceError::InvalidOperation(format!(
            "server file arch mismatch: detected {detected_arch}, expected {expected_arch}"
        )));
    }
    Ok(())
}

fn validate_web_file(file_data: &[u8], expected_version: &str) -> Result<(), ServiceError> {
    const MAX_FILES: usize = 5000;
    const MAX_SINGLE_UNCOMPRESSED: u64 = 5 * 1024 * 1024;
    const MAX_TOTAL_UNCOMPRESSED: u64 = 50 * 1024 * 1024;

    if !is_zip(file_data) {
        return Err(ServiceError::InvalidOperation(
            "web component only accepts zip files".to_string(),
        ));
    }

    let mut archive = ZipArchive::new(Cursor::new(file_data))
        .map_err(|_| ServiceError::InvalidOperation("web zip cannot be parsed".to_string()))?;
    let file_count = archive.len();
    if file_count == 0 || file_count > MAX_FILES {
        return Err(ServiceError::InvalidOperation(format!(
            "web zip file count is invalid: {file_count}"
        )));
    }

    let mut has_index = false;
    let mut has_asset = false;
    let mut marker_content = None;
    let mut total_uncompressed = 0_u64;
    let mut content_entries = Vec::new();

    for index in 0..file_count {
        let mut file = archive
            .by_index(index)
            .map_err(|_| ServiceError::InvalidOperation("web zip read failed".to_string()))?;
        let Some(enclosed_name) = file.enclosed_name().map(|path| path.to_path_buf()) else {
            return Err(ServiceError::InvalidOperation(
                "web zip contains invalid paths".to_string(),
            ));
        };
        let Some(name) = zip_path_name(&enclosed_name) else {
            return Err(ServiceError::InvalidOperation(
                "web zip contains invalid paths".to_string(),
            ));
        };

        if name == "dist/index.html" {
            has_index = true;
        }
        if name.starts_with("dist/assets/") && (name.ends_with(".js") || name.ends_with(".css")) {
            has_asset = true;
        }
        if name == WEB_MARKER_FILE {
            marker_content = Some(read_web_marker(&mut file)?);
        }

        let size = file.size();
        if size > MAX_SINGLE_UNCOMPRESSED {
            return Err(ServiceError::InvalidOperation(format!(
                "web zip file is too large after unzip: {name}"
            )));
        }
        total_uncompressed = total_uncompressed.saturating_add(size);
        if total_uncompressed > MAX_TOTAL_UNCOMPRESSED {
            return Err(ServiceError::InvalidOperation(
                "web zip total uncompressed size is too large".to_string(),
            ));
        }

        if name != WEB_MARKER_FILE && file.is_file() {
            let content_hash = zip_file_content_hash(&mut file)?;
            content_entries.push((name, size, content_hash));
        }
    }

    if !has_index {
        return Err(ServiceError::InvalidOperation(
            "web zip must contain dist/index.html".to_string(),
        ));
    }
    if !has_asset {
        return Err(ServiceError::InvalidOperation(
            "web zip must contain dist/assets/*.js or *.css".to_string(),
        ));
    }
    let Some(marker_content) = marker_content else {
        return Err(ServiceError::InvalidOperation(format!(
            "web zip must contain {WEB_MARKER_FILE}"
        )));
    };

    let content_hash = web_content_hash(content_entries);
    validate_web_marker_content_with_signature_policy(
        &marker_content,
        expected_version,
        CONFIG.deploy_signature_required,
        CONFIG.deploy_verify_key.as_deref(),
        &content_hash,
    )?;

    Ok(())
}

fn read_web_marker<R: Read>(reader: &mut R) -> Result<String, ServiceError> {
    let mut content = String::new();
    reader
        .read_to_string(&mut content)
        .map_err(|_| ServiceError::InvalidOperation("web marker cannot be read".to_string()))?;
    Ok(content)
}

fn validate_web_marker_content_with_signature_policy(
    content: &str,
    expected_version: &str,
    signature_required: bool,
    verify_key: Option<&str>,
    content_hash: &str,
) -> Result<(), ServiceError> {
    if signature_required {
        let marker: DeploySignatureMarker = serde_json::from_str(content).map_err(|_| {
            ServiceError::InvalidOperation("web signature marker is not valid JSON".to_string())
        })?;
        return validate_signed_marker(
            &marker,
            "web",
            expected_version,
            "universal",
            content_hash,
            verify_key,
        );
    }

    let marker: serde_json::Value = serde_json::from_str(&content)
        .map_err(|_| ServiceError::InvalidOperation("web marker is not valid JSON".to_string()))?;

    if marker.get("schemaVersion").and_then(|value| value.as_u64())
        == Some(DEPLOY_SIGNATURE_SCHEMA_VERSION as u64)
    {
        if marker.get("component").and_then(|value| value.as_str()) == Some("web") {
            return Ok(());
        }
        return Err(ServiceError::InvalidOperation(
            "web signature marker component must be web".to_string(),
        ));
    }

    if marker.get("component").and_then(|value| value.as_str()) != Some("web") {
        return Err(ServiceError::InvalidOperation("web marker component must be web".to_string()));
    }
    if marker.get("build_id").and_then(|value| value.as_str()) != Some("manual") {
        return Err(ServiceError::InvalidOperation(
            "web marker build_id must be manual".to_string(),
        ));
    }
    Ok(())
}

fn zip_file_content_hash<R: Read>(reader: &mut R) -> Result<String, ServiceError> {
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8192];
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|_| ServiceError::InvalidOperation("web zip read failed".to_string()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(finalize_sha256_hex(hasher))
}

fn web_content_hash(mut entries: Vec<(String, u64, String)>) -> String {
    entries.sort_by(|left, right| left.0.cmp(&right.0));
    let mut hasher = Sha256::new();
    for (name, size, content_hash) in entries {
        hasher.update(name.as_bytes());
        hasher.update([0]);
        hasher.update(size.to_le_bytes());
        hasher.update(content_hash.as_bytes());
        hasher.update([0]);
    }
    finalize_sha256_hex(hasher)
}

fn validate_server_signed_marker(
    file_data: &[u8],
    expected_version: &str,
    expected_arch: &str,
    verify_key: Option<&str>,
) -> Result<(), ServiceError> {
    let (content, marker) = split_server_signed_marker(file_data)?;
    let marker: DeploySignatureMarker = serde_json::from_slice(marker).map_err(|_| {
        ServiceError::InvalidOperation("server signature marker is not valid JSON".to_string())
    })?;
    let content_hash = sha256_hex(content);
    validate_signed_marker(
        &marker,
        "server",
        expected_version,
        expected_arch,
        &content_hash,
        verify_key,
    )
}

fn split_server_signed_marker(file_data: &[u8]) -> Result<(&[u8], &[u8]), ServiceError> {
    let marker_start = find_last_subslice(file_data, SIGNED_MARKER_BEGIN).ok_or_else(|| {
        ServiceError::InvalidOperation("server signature marker is required".to_string())
    })?;
    let marker_content_start = marker_start + SIGNED_MARKER_BEGIN.len();
    let marker_end = find_subslice(&file_data[marker_content_start..], SIGNED_MARKER_END)
        .map(|offset| marker_content_start + offset)
        .ok_or_else(|| {
            ServiceError::InvalidOperation("server signature marker is incomplete".to_string())
        })?;
    Ok((&file_data[..marker_start], &file_data[marker_content_start..marker_end]))
}

fn validate_signed_marker(
    marker: &DeploySignatureMarker,
    expected_component: &str,
    expected_version: &str,
    expected_arch: &str,
    expected_content_hash: &str,
    verify_key: Option<&str>,
) -> Result<(), ServiceError> {
    if marker.schema_version != DEPLOY_SIGNATURE_SCHEMA_VERSION {
        return Err(ServiceError::InvalidOperation(
            "deploy signature marker schema version is invalid".to_string(),
        ));
    }
    if marker.component != expected_component {
        return Err(ServiceError::InvalidOperation(format!(
            "deploy signature component mismatch: expected {expected_component}"
        )));
    }
    if marker.version != expected_version {
        return Err(ServiceError::InvalidOperation(format!(
            "deploy signature version mismatch: expected {expected_version}"
        )));
    }
    if marker.arch != expected_arch {
        return Err(ServiceError::InvalidOperation(format!(
            "deploy signature arch mismatch: expected {expected_arch}"
        )));
    }
    if marker.content_sha256 != expected_content_hash {
        return Err(ServiceError::InvalidOperation(
            "deploy signature content hash mismatch".to_string(),
        ));
    }

    let verify_key =
        verify_key.and_then(|value| normalize_optional(value.to_string())).ok_or_else(|| {
            ServiceError::InvalidOperation(
                "deploy signature verification key is required".to_string(),
            )
        })?;
    let verifying_key = parse_verify_key(&verify_key)?;
    let signature = parse_signature(&marker.signature)?;
    let payload = deploy_signature_payload(
        expected_component,
        expected_version,
        expected_arch,
        expected_content_hash,
    );
    verifying_key.verify(payload.as_bytes(), &signature).map_err(|_| {
        ServiceError::InvalidOperation("deploy signature verification failed".to_string())
    })
}

fn deploy_signature_payload(
    component: &str,
    version: &str,
    arch: &str,
    content_hash: &str,
) -> String {
    format!(
        "{DEPLOY_SIGNATURE_PAYLOAD_VERSION}\ncomponent={component}\nversion={version}\narch={arch}\ncontent_sha256={content_hash}\n"
    )
}

fn parse_verify_key(value: &str) -> Result<VerifyingKey, ServiceError> {
    let bytes = decode_hex(value).map_err(|err| {
        ServiceError::InvalidOperation(format!(
            "deploy signature verification key is invalid: {err}"
        ))
    })?;
    let key_bytes: [u8; 32] = bytes.try_into().map_err(|_| {
        ServiceError::InvalidOperation(
            "deploy signature verification key must be 32 bytes hex".to_string(),
        )
    })?;
    VerifyingKey::from_bytes(&key_bytes).map_err(|_| {
        ServiceError::InvalidOperation("deploy signature verification key is invalid".to_string())
    })
}

fn parse_signature(value: &str) -> Result<Signature, ServiceError> {
    let bytes = decode_hex(value).map_err(|err| {
        ServiceError::InvalidOperation(format!("deploy signature is invalid: {err}"))
    })?;
    Signature::from_slice(&bytes).map_err(|_| {
        ServiceError::InvalidOperation("deploy signature must be 64 bytes hex".to_string())
    })
}

fn decode_hex(value: &str) -> Result<Vec<u8>, String> {
    let value = value.trim();
    if !value.len().is_multiple_of(2) {
        return Err("hex length must be even".to_string());
    }
    let mut bytes = Vec::with_capacity(value.len() / 2);
    for chunk in value.as_bytes().chunks_exact(2) {
        let high = hex_value(chunk[0])?;
        let low = hex_value(chunk[1])?;
        bytes.push((high << 4) | low);
    }
    Ok(bytes)
}

fn hex_value(byte: u8) -> Result<u8, String> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        b'A'..=b'F' => Ok(byte - b'A' + 10),
        _ => Err("contains non-hex characters".to_string()),
    }
}

fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|window| window == needle)
}

fn find_last_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).rposition(|window| window == needle)
}

fn extract_zip_to_dir(zip_path: &Path, output_dir: &Path) -> Result<(), ServiceError> {
    let file = fs::File::open(zip_path)
        .map_err(|err| ServiceError::InvalidOperation(format!("Failed to open web zip: {err}")))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|_| ServiceError::InvalidOperation("web zip cannot be parsed".to_string()))?;

    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|_| ServiceError::InvalidOperation("web zip read failed".to_string()))?;
        let Some(enclosed_name) = file.enclosed_name().map(|path| path.to_path_buf()) else {
            return Err(ServiceError::InvalidOperation(
                "web zip contains invalid paths".to_string(),
            ));
        };
        let output_path = output_dir.join(enclosed_name);
        if file.is_dir() {
            fs::create_dir_all(&output_path).map_err(|err| {
                ServiceError::InvalidOperation(format!("Failed to create web directory: {err}"))
            })?;
            continue;
        }
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|err| {
                ServiceError::InvalidOperation(format!("Failed to create web directory: {err}"))
            })?;
        }
        let mut output = fs::File::create(&output_path).map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to create web file: {err}"))
        })?;
        std::io::copy(&mut file, &mut output).map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to extract web file: {err}"))
        })?;
    }

    Ok(())
}

fn parse_component(value: String) -> Result<DeployComponent, ServiceError> {
    match value.trim() {
        "server" => Ok(DeployComponent::Server),
        "web" => Ok(DeployComponent::Web),
        _ => Err(ServiceError::InvalidOperation("component must be server or web".to_string())),
    }
}

fn validate_version(value: String) -> Result<String, ServiceError> {
    let value = non_empty(value, "version")?;
    if value.len() > 64 {
        return Err(ServiceError::InvalidOperation(
            "version must be at most 64 characters".to_string(),
        ));
    }
    if value.chars().all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-')) {
        Ok(value)
    } else {
        Err(ServiceError::InvalidOperation(
            "version can only contain letters, numbers, dot, underscore, and dash".to_string(),
        ))
    }
}

fn normalize_arch(value: &str) -> Result<String, ServiceError> {
    match value.trim().to_ascii_lowercase().as_str() {
        "x86_64" | "amd64" => Ok("x86_64".to_string()),
        "aarch64" | "arm64" => Ok("aarch64".to_string()),
        _ => Err(ServiceError::InvalidOperation("arch must be x86_64 or aarch64".to_string())),
    }
}

fn resolve_server_arch(value: Option<&str>, file_data: &[u8]) -> Result<String, ServiceError> {
    if let Some(value) = value {
        return normalize_arch(value);
    }

    detect_binary_arch(file_data)?.ok_or_else(|| {
        ServiceError::InvalidOperation(
            "server file arch cannot be detected; expected x86_64 or aarch64 binary".to_string(),
        )
    })
}

fn ensure_version_is_deployable(version: &DeploymentItem) -> Result<(), ServiceError> {
    if version.is_expired {
        return Err(ServiceError::InvalidOperation("Cannot deploy an expired version".to_string()));
    }
    Ok(())
}

fn detect_binary_arch(file_data: &[u8]) -> Result<Option<String>, ServiceError> {
    if is_elf(file_data) {
        return detect_elf_arch(file_data);
    }
    if is_macho_or_fat(file_data) {
        return detect_macho_arch(file_data);
    }
    Ok(None)
}

fn detect_elf_arch(file_data: &[u8]) -> Result<Option<String>, ServiceError> {
    if file_data.len() < 20 {
        return Ok(None);
    }

    let is_little_endian = file_data[5] == 1;
    let machine = if is_little_endian {
        u16::from_le_bytes([file_data[18], file_data[19]])
    } else {
        u16::from_be_bytes([file_data[18], file_data[19]])
    };

    match machine {
        62 => Ok(Some("x86_64".to_string())),
        183 => Ok(Some("aarch64".to_string())),
        _ => Ok(None),
    }
}

fn detect_macho_arch(file_data: &[u8]) -> Result<Option<String>, ServiceError> {
    if file_data.len() < 8 {
        return Ok(None);
    }

    let magic_be = u32::from_be_bytes([file_data[0], file_data[1], file_data[2], file_data[3]]);
    let magic_le = u32::from_le_bytes([file_data[0], file_data[1], file_data[2], file_data[3]]);
    if magic_be == 0xCAFEBABE || magic_le == 0xBEBAFECA {
        return Ok(None);
    }

    let little_endian = matches!(magic_le, 0xFEEDFACE | 0xFEEDFACF);
    let cputype = if little_endian {
        u32::from_le_bytes([file_data[4], file_data[5], file_data[6], file_data[7]])
    } else {
        u32::from_be_bytes([file_data[4], file_data[5], file_data[6], file_data[7]])
    };

    const CPU_TYPE_X86_64: u32 = 0x01000007;
    const CPU_TYPE_ARM64: u32 = 0x0100000C;
    match cputype {
        CPU_TYPE_X86_64 => Ok(Some("x86_64".to_string())),
        CPU_TYPE_ARM64 => Ok(Some("aarch64".to_string())),
        _ => Ok(None),
    }
}

fn swap_symlink(target_link: &Path, new_target: &Path) -> std::io::Result<Option<PathBuf>> {
    let old_target = if target_link.exists() { fs::read_link(target_link).ok() } else { None };
    if target_link.exists() && old_target.is_none() {
        fs::remove_file(target_link)?;
    }
    let parent = parent_dir(target_link)
        .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidInput, err.to_string()))?;
    let tmp_link = parent.join(format!(
        ".{}.tmp",
        target_link.file_name().and_then(|name| name.to_str()).unwrap_or("rustzen-admin")
    ));
    if tmp_link.exists() {
        let _ = fs::remove_file(&tmp_link);
    }
    std::os::unix::fs::symlink(new_target, &tmp_link)?;
    fs::rename(&tmp_link, target_link)?;
    Ok(old_target)
}

fn restore_symlink(target_link: &Path, old_target: Option<&Path>) -> std::io::Result<()> {
    if target_link.exists() {
        let _ = fs::remove_file(target_link);
    }
    let Some(old_target) = old_target else {
        return Ok(());
    };
    let parent = target_link
        .parent()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidInput, "missing parent"))?;
    let tmp_link = parent.join(format!(
        ".{}.tmp",
        target_link.file_name().and_then(|name| name.to_str()).unwrap_or("rustzen-admin")
    ));
    if tmp_link.exists() {
        let _ = fs::remove_file(&tmp_link);
    }
    std::os::unix::fs::symlink(old_target, &tmp_link)?;
    fs::rename(&tmp_link, target_link)?;
    Ok(())
}

fn restore_web_dist(dist_dir: &Path, prev_dist: &Path) -> Result<(), ServiceError> {
    if !prev_dist.exists() {
        remove_path_if_exists(dist_dir)?;
        return Ok(());
    }

    let failed_dist = dist_dir.with_file_name("dist.failed");
    remove_path_if_exists(&failed_dist)?;
    if dist_dir.exists() {
        fs::rename(dist_dir, &failed_dist).map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to archive failed web dist: {err}"))
        })?;
    }

    if let Err(err) = fs::rename(prev_dist, dist_dir) {
        if failed_dist.exists()
            && let Err(restore_err) = fs::rename(&failed_dist, dist_dir)
        {
            tracing::error!("Failed to restore failed web dist: {}", restore_err);
        }
        return Err(ServiceError::InvalidOperation(format!(
            "Failed to restore previous web dist: {err}"
        )));
    }

    let _ = remove_path_if_exists(&failed_dist);
    Ok(())
}

async fn restart_server() -> Result<(), ServiceError> {
    let status = Command::new("systemctl")
        .arg("--no-block")
        .arg("restart")
        .arg(SERVER_SYSTEMD_UNIT)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to trigger server restart: {err}"))
        })?;

    if !status.success() {
        return Err(ServiceError::InvalidOperation(
            "Failed to trigger server restart: systemctl restart was not accepted".to_string(),
        ));
    }

    Ok(())
}

async fn prepare_server_restart() -> Result<(), ServiceError> {
    let status = Command::new("systemctl")
        .arg("daemon-reload")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to prepare server restart: {err}"))
        })?;

    if !status.success() {
        return Err(ServiceError::InvalidOperation(
            "Failed to prepare server restart: systemctl daemon-reload failed".to_string(),
        ));
    }

    Ok(())
}

fn set_executable(path: &Path) -> Result<(), ServiceError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(path)
            .map_err(|err| {
                ServiceError::InvalidOperation(format!("Failed to read file metadata: {err}"))
            })?
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions).map_err(|err| {
            ServiceError::InvalidOperation(format!("Failed to set file permissions: {err}"))
        })?;
    }
    Ok(())
}

fn runtime_root_dir() -> PathBuf {
    resolve_runtime_path(&CONFIG.runtime_root_dir())
}

fn resolve_runtime_path(path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir().map(|cwd| cwd.join(path)).unwrap_or_else(|_| path.to_path_buf())
    }
}

fn parent_dir(path: &Path) -> Result<&Path, ServiceError> {
    path.parent().ok_or_else(|| {
        ServiceError::InvalidOperation(format!("Path has no parent: {}", path.display()))
    })
}

fn remove_path_if_exists(path: &Path) -> Result<(), ServiceError> {
    if !path.exists() {
        return Ok(());
    }
    let metadata = fs::symlink_metadata(path).map_err(|err| {
        ServiceError::InvalidOperation(format!("Failed to read path metadata: {err}"))
    })?;
    if metadata.is_dir() { fs::remove_dir_all(path) } else { fs::remove_file(path) }
        .map_err(|err| ServiceError::InvalidOperation(format!("Failed to remove path: {err}")))
}

fn is_zip(bytes: &[u8]) -> bool {
    bytes.len() >= 2 && bytes[0] == b'P' && bytes[1] == b'K'
}

fn is_elf(bytes: &[u8]) -> bool {
    bytes.len() >= 4 && bytes[0] == 0x7F && bytes[1] == b'E' && bytes[2] == b'L' && bytes[3] == b'F'
}

fn is_macho_or_fat(bytes: &[u8]) -> bool {
    if bytes.len() < 4 {
        return false;
    }
    let be = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    let le = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    matches!(be, 0xFEEDFACE | 0xFEEDFACF | 0xCAFEBABE | 0xBEBAFECA)
        || matches!(le, 0xFEEDFACE | 0xFEEDFACF | 0xCAFEBABE | 0xBEBAFECA)
}

fn zip_path_name(path: &Path) -> Option<String> {
    let mut parts = Vec::new();
    for component in path.components() {
        let std::path::Component::Normal(part) = component else {
            return None;
        };
        parts.push(part.to_str()?.to_string());
    }
    Some(parts.join("/"))
}

fn sha256_hex(data: &[u8]) -> String {
    let digest = Sha256::digest(data);
    digest.iter().map(|byte| format!("{byte:02x}")).collect::<String>()
}

fn finalize_sha256_hex(hasher: Sha256) -> String {
    hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect::<String>()
}

fn non_empty(value: String, field: &str) -> Result<String, ServiceError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(ServiceError::InvalidOperation(format!("{field} is required")));
    }
    Ok(value)
}

fn normalize_optional(value: String) -> Option<String> {
    let value = value.trim().to_string();
    if value.is_empty() { None } else { Some(value) }
}

fn remove_deploy_file(version: &DeploymentItem) -> Result<(), ServiceError> {
    remove_deploy_file_path(Path::new(&version.file_path))
}

fn remove_deploy_file_path(path: &Path) -> Result<(), ServiceError> {
    if !path.exists() {
        return Ok(());
    }
    fs::remove_file(path).map_err(|err| {
        ServiceError::InvalidOperation(format!("Failed to remove deploy version file: {err}"))
    })
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use ed25519_dalek::{Signer, SigningKey};

    use super::*;

    #[test]
    fn ensure_version_is_deployable_rejects_expired_versions() {
        let version = deployment_item(true);

        let err = ensure_version_is_deployable(&version).expect_err("expired version is invalid");

        assert!(matches!(err, ServiceError::InvalidOperation(_)));
    }

    #[test]
    fn ensure_version_is_deployable_accepts_active_versions() {
        let version = deployment_item(false);

        assert!(ensure_version_is_deployable(&version).is_ok());
    }

    #[test]
    fn server_arch_is_detected_when_upload_omits_arch() {
        let file_data = sample_elf_x86_64_with_legacy_marker();

        let arch = resolve_server_arch(None, &file_data).expect("server arch is detected");

        assert_eq!(arch, "x86_64");
    }

    #[test]
    fn signed_server_marker_is_required_when_signature_check_is_enabled() {
        let signing_key = SigningKey::from_bytes(&[7; 32]);
        let verify_key = hex_encode(signing_key.verifying_key().as_bytes());
        let mut file_data = sample_elf_x86_64();
        append_signed_server_marker(&mut file_data, "v0.4.0", "x86_64", &signing_key);

        validate_server_file_with_signature_policy(
            &file_data,
            "v0.4.0",
            "x86_64",
            true,
            Some(&verify_key),
        )
        .expect("signed server marker is valid");

        let unsigned = sample_elf_x86_64_with_legacy_marker();
        let err = validate_server_file_with_signature_policy(
            &unsigned,
            "v0.4.0",
            "x86_64",
            true,
            Some(&verify_key),
        )
        .expect_err("legacy marker is rejected when signatures are required");

        assert!(err.to_string().contains("signature"));
    }

    #[test]
    fn signed_web_marker_is_required_when_signature_check_is_enabled() {
        let signing_key = SigningKey::from_bytes(&[9; 32]);
        let verify_key = hex_encode(signing_key.verifying_key().as_bytes());
        let content_hash = "aa".repeat(32);
        let marker = signed_marker_json("web", "v0.4.0", "universal", &content_hash, &signing_key);

        validate_web_marker_content_with_signature_policy(
            &marker,
            "v0.4.0",
            true,
            Some(&verify_key),
            &content_hash,
        )
        .expect("signed web marker is valid");

        let legacy_marker = r#"{"component":"web","build_id":"manual"}"#;
        let err = validate_web_marker_content_with_signature_policy(
            legacy_marker,
            "v0.4.0",
            true,
            Some(&verify_key),
            &content_hash,
        )
        .expect_err("legacy marker is rejected when signatures are required");

        assert!(err.to_string().contains("signature"));
    }

    fn deployment_item(is_expired: bool) -> DeploymentItem {
        let now = Utc::now();
        DeploymentItem {
            id: 1,
            component: DeployComponent::Server,
            version: "v0.4.0".to_string(),
            arch: "x86_64".to_string(),
            file_path: "/tmp/rustzen-admin".to_string(),
            file_size: 1,
            file_hash: "hash".to_string(),
            is_current: false,
            is_deployed: false,
            is_expired,
            deployed_at: None,
            expired_at: None,
            deleted_at: None,
            deployed_by: None,
            notes: None,
            created_at: now,
            updated_at: now,
        }
    }

    fn sample_elf_x86_64() -> Vec<u8> {
        let mut bytes = vec![0_u8; 64];
        bytes[0] = 0x7f;
        bytes[1] = b'E';
        bytes[2] = b'L';
        bytes[3] = b'F';
        bytes[4] = 2;
        bytes[5] = 1;
        bytes[18] = 62;
        bytes
    }

    fn sample_elf_x86_64_with_legacy_marker() -> Vec<u8> {
        let mut bytes = sample_elf_x86_64();
        bytes.extend_from_slice(b"RUSTZEN_ADMIN_MARKER\ncomponent=server\nbuild_id=v0.4.0\n");
        bytes
    }

    fn append_signed_server_marker(
        file_data: &mut Vec<u8>,
        version: &str,
        arch: &str,
        signing_key: &SigningKey,
    ) {
        let content_hash = sha256_hex(file_data);
        let marker = signed_marker_json("server", version, arch, &content_hash, signing_key);
        file_data.extend_from_slice(SIGNED_MARKER_BEGIN);
        file_data.extend_from_slice(marker.as_bytes());
        file_data.extend_from_slice(SIGNED_MARKER_END);
    }

    fn signed_marker_json(
        component: &str,
        version: &str,
        arch: &str,
        content_hash: &str,
        signing_key: &SigningKey,
    ) -> String {
        let payload = deploy_signature_payload(component, version, arch, content_hash);
        let signature = signing_key.sign(payload.as_bytes());
        format!(
            r#"{{"schemaVersion":1,"component":"{component}","version":"{version}","arch":"{arch}","contentSha256":"{content_hash}","signature":"{}"}}"#,
            hex_encode(&signature.to_bytes())
        )
    }

    fn hex_encode(bytes: &[u8]) -> String {
        bytes.iter().map(|byte| format!("{byte:02x}")).collect()
    }
}
