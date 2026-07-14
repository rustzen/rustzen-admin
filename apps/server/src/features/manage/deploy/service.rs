use std::{
    fs,
    future::Future,
    path::{Path, PathBuf},
    process::Stdio,
    sync::Arc,
    time::Duration,
};

use axum::extract::Multipart;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::process::Command;

use crate::{
    common::{
        error::ServiceError,
        pagination::{Pagination, PaginationQuery},
    },
    features::manage::deploy::types::{
        DeployComponent, DeploymentItem, DeploymentPayload, ExpireVersionRequest,
        ListDeploymentsQuery,
    },
    infra::config::CONFIG,
};

use super::repo::DeployRepository;

pub const DEPLOY_FILE_MAX_SIZE: usize = 64 * 1024 * 1024;
const DEPLOY_BODY_LIMIT: usize = DEPLOY_FILE_MAX_SIZE + 1024 * 1024;
const RELEASE_MARKER_PREFIX: &[u8] = b"RUSTZEN_RELEASE_MARKER\nartifact=rz\n";
const SIGNED_MARKER_BEGIN: &[u8] = b"\nRUSTZEN_RELEASE_SIGNED_MARKER_BEGIN\n";
const SIGNED_MARKER_END: &[u8] = b"\nRUSTZEN_RELEASE_SIGNED_MARKER_END\n";
const SIGNATURE_PAYLOAD_VERSION: &str = "rustzen-release-v1";
const SYSTEMD_UNITS: &[&str] =
    &["rz-monitor.service", "rz-insights.service", "rz-reports.service", "rz-admin.service"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReleaseSignatureMarker {
    schema_version: u8,
    component: String,
    version: String,
    arch: String,
    content_sha256: String,
    signature: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateJournal {
    release_id: i64,
    backup_dir: PathBuf,
    link: PathBuf,
    old_target: Option<PathBuf>,
    stage: String,
    #[serde(default)]
    restarted_units: Vec<String>,
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
                    let value = field.text().await.map_err(|_| {
                        ServiceError::InvalidOperation("Invalid component field".to_string())
                    })?;
                    if value != "release" {
                        return Err(ServiceError::InvalidOperation(
                            "Only complete release artifacts are accepted".to_string(),
                        ));
                    }
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
                "notes" => notes = normalize_optional(field.text().await.unwrap_or_default()),
                "file" => {
                    file_data = Some(
                        field
                            .bytes()
                            .await
                            .map_err(|_| {
                                ServiceError::InvalidOperation(
                                    "Failed to read uploaded release".to_string(),
                                )
                            })?
                            .to_vec(),
                    );
                }
                _ => {}
            }
        }

        let version =
            version.ok_or_else(|| ServiceError::InvalidOperation("version is required".into()))?;
        let data =
            file_data.ok_or_else(|| ServiceError::InvalidOperation("file is required".into()))?;
        validate_upload_size(&data)?;
        let detected_arch = detect_elf_arch(&data)?;
        if let Some(requested_arch) = arch
            && requested_arch != detected_arch
        {
            return Err(ServiceError::InvalidOperation(
                "Uploaded release architecture does not match arch field".to_string(),
            ));
        }
        validate_release(&data, &version, &detected_arch)?;
        let component = DeployComponent::Release;
        if self.repo.version_exists(&component, &version, &detected_arch).await? {
            return Err(ServiceError::InvalidOperation(
                "Release version has already been uploaded for this architecture".to_string(),
            ));
        }
        let file_hash = sha256_hex(&data);
        let file_path = save_release(&version, &detected_arch, &data).await?;
        match self
            .repo
            .insert(&DeploymentPayload {
                component,
                version,
                arch: detected_arch,
                file_path: file_path.to_string_lossy().to_string(),
                file_size: i64::try_from(data.len()).unwrap_or(i64::MAX),
                file_hash,
                notes,
            })
            .await
        {
            Ok(item) => Ok(item),
            Err(error) => {
                if let Err(cleanup_error) = fs::remove_file(&file_path) {
                    tracing::error!(
                        %cleanup_error,
                        path = %file_path.display(),
                        "Failed to remove unregistered release artifact"
                    );
                }
                Err(error)
            }
        }
    }

    pub async fn find_by_id(&self, id: i64) -> Result<DeploymentItem, ServiceError> {
        self.repo.find_by_id(id).await
    }

    pub async fn deploy(&self, id: i64, deployed_by: String) -> Result<bool, ServiceError> {
        let version = self.repo.find_by_id(id).await?;
        ensure_version_is_deployable(&version)?;
        validate_stored_release(&version)?;
        let executable = std::env::current_exe().map_err(|error| {
            ServiceError::InvalidOperation(format!("Cannot locate rz executable: {error}"))
        })?;
        Command::new("systemd-run")
            .arg(format!("--unit=rz-update-{id}"))
            .args(["--collect", "--no-block"])
            .args([
                "--property=Restart=on-failure",
                "--property=RestartSec=2s",
                "--property=StartLimitIntervalSec=60s",
                "--property=StartLimitBurst=3",
            ])
            .arg(format!("--setenv=RUSTZEN_UPDATE_DEPLOYED_BY={deployed_by}"))
            .arg(executable)
            .args(["update", "worker", &id.to_string()])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| {
                ServiceError::InvalidOperation(format!("Failed to start update worker: {error}"))
            })?;
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
                "Cannot delete the current release".to_string(),
            ));
        }
        let deleted = self.repo.delete_by_id(id).await?;
        if let Err(error) = fs::remove_file(&deleted.file_path)
            && error.kind() != std::io::ErrorKind::NotFound
        {
            tracing::warn!(%error, path = %deleted.file_path, "Release file cleanup failed");
        }
        Ok(deleted)
    }

    pub async fn cleanup_expired(
        &self,
        _component: Option<DeployComponent>,
    ) -> Result<usize, ServiceError> {
        let versions = self.repo.expired_non_current(Some(&DeployComponent::Release)).await?;
        let mut deleted = 0;
        for version in versions {
            let deleted_version = self.repo.delete_by_id(version.id).await?;
            if let Err(error) = fs::remove_file(&deleted_version.file_path)
                && error.kind() != std::io::ErrorKind::NotFound
            {
                tracing::warn!(%error, path = %deleted_version.file_path, "Release cleanup failed");
            }
            deleted += 1;
        }
        Ok(deleted)
    }

    pub async fn run_update_worker(id: i64) -> Result<(), Box<dyn std::error::Error>> {
        recover_interrupted_update(id).await?;
        let pool = crate::infra::db::create_default_pool().await?;
        crate::infra::db::run_migrations(&pool).await?;
        let service = Self::new(pool.clone());
        let version = service.find_by_id(id).await?;
        ensure_version_is_deployable(&version)?;
        validate_stored_release(&version)?;
        drop(service);
        pool.close().await;

        let backup_dir = match backup_databases(&version.version).await {
            Ok(path) => path,
            Err(error) => return Err(error),
        };
        let link = CONFIG.runtime_root_dir().join("bin/rz");
        let old_target = fs::read_link(&link).ok();
        let mut journal = UpdateJournal {
            release_id: id,
            backup_dir: backup_dir.clone(),
            link: link.clone(),
            old_target: old_target.clone(),
            stage: "backedUp".to_string(),
            restarted_units: Vec::new(),
        };
        write_update_journal(&journal)?;
        if let Err(error) = swap_symlink(&link, Path::new(&version.file_path)) {
            remove_update_journal()?;
            return Err(error.into());
        }
        journal.stage = "switched".to_string();
        write_update_journal(&journal)?;

        let update_result = async {
            roll_services(&mut journal, &update_journal_path()).await?;
            journal.stage = "committing".to_string();
            write_update_journal(&journal)?;
            let pool = crate::infra::db::create_default_pool().await?;
            crate::infra::db::run_migrations(&pool).await?;
            let service = Self::new(pool.clone());
            service
                .repo
                .set_current(
                    &DeployComponent::Release,
                    &version.arch,
                    version.id,
                    std::env::var("RUSTZEN_UPDATE_DEPLOYED_BY").ok().as_deref(),
                )
                .await?;
            pool.close().await;
            Ok::<(), Box<dyn std::error::Error>>(())
        }
        .await;

        if let Err(error) = update_result {
            let rollback_result = rollback_update(&journal).await;
            return match rollback_result {
                Ok(()) => {
                    remove_update_journal()?;
                    tracing::error!(%error, "Release update failed and was rolled back");
                    Ok(())
                }
                Err(rollback_error) => Err(std::io::Error::other(format!(
                    "release update failed: {error}; rollback failed: {rollback_error}"
                ))
                .into()),
            };
        }
        remove_update_journal()?;
        Ok(())
    }
}

async fn recover_interrupted_update(id: i64) -> Result<(), Box<dyn std::error::Error>> {
    let Some(journal) = read_update_journal()? else {
        return Ok(());
    };
    if journal.release_id != id {
        return Err(std::io::Error::other(format!(
            "unfinished release {} must be recovered before release {id}",
            journal.release_id
        ))
        .into());
    }
    rollback_update(&journal).await?;
    remove_update_journal()?;
    Ok(())
}

fn update_journal_path() -> PathBuf {
    CONFIG.data_dir().join("update-state.json")
}

fn read_update_journal() -> Result<Option<UpdateJournal>, Box<dyn std::error::Error>> {
    read_update_journal_at(&update_journal_path())
}

fn read_update_journal_at(
    path: &Path,
) -> Result<Option<UpdateJournal>, Box<dyn std::error::Error>> {
    match fs::read(path) {
        Ok(data) => Ok(Some(serde_json::from_slice(&data)?)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

fn write_update_journal(journal: &UpdateJournal) -> Result<(), Box<dyn std::error::Error>> {
    write_update_journal_at(&update_journal_path(), journal)
}

fn write_update_journal_at(
    path: &Path,
    journal: &UpdateJournal,
) -> Result<(), Box<dyn std::error::Error>> {
    let parent = path.parent().ok_or_else(|| std::io::Error::other("invalid update state path"))?;
    fs::create_dir_all(parent)?;
    let temporary = path.with_extension("json.new");
    fs::write(&temporary, serde_json::to_vec_pretty(journal)?)?;
    fs::rename(temporary, path)?;
    Ok(())
}

fn remove_update_journal() -> Result<(), std::io::Error> {
    let path = update_journal_path();
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

fn validate_upload_size(data: &[u8]) -> Result<(), ServiceError> {
    if data.is_empty() || data.len() > DEPLOY_FILE_MAX_SIZE {
        return Err(ServiceError::InvalidOperation(format!(
            "Release must be between 1 byte and {DEPLOY_FILE_MAX_SIZE} bytes"
        )));
    }
    Ok(())
}

fn validate_version(value: String) -> Result<String, ServiceError> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > 64
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || ".-_".contains(character))
    {
        return Err(ServiceError::InvalidOperation("Invalid release version".to_string()));
    }
    Ok(value.to_string())
}

fn normalize_optional(value: String) -> Option<String> {
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_string())
}

fn detect_elf_arch(data: &[u8]) -> Result<String, ServiceError> {
    if data.len() < 20 || &data[..4] != b"\x7fELF" {
        return Err(ServiceError::InvalidOperation(
            "Release must be an ELF executable".to_string(),
        ));
    }
    match u16::from_le_bytes([data[18], data[19]]) {
        62 => Ok("x86_64".to_string()),
        183 => Ok("aarch64".to_string()),
        _ => Err(ServiceError::InvalidOperation("Unsupported release architecture".to_string())),
    }
}

fn validate_release(data: &[u8], version: &str, arch: &str) -> Result<(), ServiceError> {
    if !data.windows(RELEASE_MARKER_PREFIX.len()).any(|window| window == RELEASE_MARKER_PREFIX) {
        return Err(ServiceError::InvalidOperation(
            "Release marker is missing from rz".to_string(),
        ));
    }
    if CONFIG.deploy_signature_required {
        validate_signature(data, version, arch)?;
    }
    Ok(())
}

fn validate_signature(data: &[u8], version: &str, arch: &str) -> Result<(), ServiceError> {
    let begin = find_last(data, SIGNED_MARKER_BEGIN).ok_or_else(|| {
        ServiceError::InvalidOperation("Signed release marker is required".to_string())
    })?;
    let marker_start = begin + SIGNED_MARKER_BEGIN.len();
    let marker_end = data[marker_start..]
        .windows(SIGNED_MARKER_END.len())
        .position(|window| window == SIGNED_MARKER_END)
        .map(|offset| marker_start + offset)
        .ok_or_else(|| {
            ServiceError::InvalidOperation("Signed release marker is invalid".to_string())
        })?;
    if marker_end + SIGNED_MARKER_END.len() != data.len() {
        return Err(ServiceError::InvalidOperation(
            "Signed release marker must terminate the artifact".to_string(),
        ));
    }
    let marker: ReleaseSignatureMarker = serde_json::from_slice(&data[marker_start..marker_end])
        .map_err(|_| {
            ServiceError::InvalidOperation("Signed release marker is invalid".to_string())
        })?;
    let content_hash = sha256_hex(&data[..begin]);
    if marker.schema_version != 1
        || marker.component != "release"
        || marker.version != version
        || marker.arch != arch
        || marker.content_sha256 != content_hash
    {
        return Err(ServiceError::InvalidOperation(
            "Signed release metadata does not match the upload".to_string(),
        ));
    }
    let key_hex = CONFIG.deploy_verify_key.as_deref().ok_or_else(|| {
        ServiceError::InvalidOperation("Release verify key is not configured".to_string())
    })?;
    let key_bytes: [u8; 32] =
        hex::decode(key_hex).ok().and_then(|bytes| bytes.try_into().ok()).ok_or_else(|| {
            ServiceError::InvalidOperation("Release verify key is invalid".to_string())
        })?;
    let signature =
        Signature::from_slice(&hex::decode(&marker.signature).map_err(|_| {
            ServiceError::InvalidOperation("Release signature is invalid".to_string())
        })?)
        .map_err(|_| ServiceError::InvalidOperation("Release signature is invalid".to_string()))?;
    let payload = format!(
        "{SIGNATURE_PAYLOAD_VERSION}\ncomponent=release\nversion={version}\narch={arch}\ncontent_sha256={content_hash}\n"
    );
    VerifyingKey::from_bytes(&key_bytes)
        .map_err(|_| ServiceError::InvalidOperation("Release verify key is invalid".to_string()))?
        .verify(payload.as_bytes(), &signature)
        .map_err(|_| {
            ServiceError::InvalidOperation("Release signature verification failed".to_string())
        })
}

fn find_last(data: &[u8], needle: &[u8]) -> Option<usize> {
    data.windows(needle.len()).rposition(|window| window == needle)
}

fn sha256_hex(data: &[u8]) -> String {
    format!("{:x}", Sha256::digest(data))
}

async fn save_release(version: &str, arch: &str, data: &[u8]) -> Result<PathBuf, ServiceError> {
    let path = CONFIG.runtime_root_dir().join("bin").join(format!("rz-{version}-{arch}"));
    if path.exists() {
        return Err(ServiceError::InvalidOperation("Release file already exists".to_string()));
    }
    fs::create_dir_all(
        path.parent().ok_or_else(|| {
            ServiceError::InvalidOperation("Release path has no parent".to_string())
        })?,
    )
    .map_err(|error| {
        ServiceError::InvalidOperation(format!("Cannot create bin directory: {error}"))
    })?;
    tokio::fs::write(&path, data)
        .await
        .map_err(|error| ServiceError::InvalidOperation(format!("Cannot save release: {error}")))?;
    set_executable(&path)?;
    Ok(path)
}

#[cfg(unix)]
fn set_executable(path: &Path) -> Result<(), ServiceError> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o755)).map_err(|error| {
        ServiceError::InvalidOperation(format!("Cannot set release mode: {error}"))
    })
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) -> Result<(), ServiceError> {
    Ok(())
}

fn validate_stored_release(version: &DeploymentItem) -> Result<(), ServiceError> {
    let data = fs::read(&version.file_path)
        .map_err(|error| ServiceError::InvalidOperation(format!("Cannot read release: {error}")))?;
    if sha256_hex(&data) != version.file_hash {
        return Err(ServiceError::InvalidOperation("Stored release hash mismatch".to_string()));
    }
    validate_release(&data, &version.version, &version.arch)
}

fn ensure_version_is_deployable(version: &DeploymentItem) -> Result<(), ServiceError> {
    if version.is_expired || version.deleted_at.is_some() {
        return Err(ServiceError::InvalidOperation(
            "Expired or deleted releases cannot be applied".to_string(),
        ));
    }
    Ok(())
}

fn service_probes() -> [(&'static str, String); 4] {
    [
        ("rz-monitor.service", format!("{}/health", CONFIG.monitor_base_url())),
        ("rz-insights.service", format!("{}/health", CONFIG.insights_base_url())),
        ("rz-reports.service", format!("{}/health", CONFIG.reports_base_url())),
        ("rz-admin.service", format!("http://127.0.0.1:{}/api/summary", CONFIG.app_port)),
    ]
}

async fn roll_services(
    journal: &mut UpdateJournal,
    journal_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    roll_services_with(journal, journal_path, |unit, url| async move {
        restart_and_verify(&unit, &url).await
    })
    .await
}

async fn roll_services_with<F, Fut>(
    journal: &mut UpdateJournal,
    journal_path: &Path,
    mut restart: F,
) -> Result<(), Box<dyn std::error::Error>>
where
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<(), Box<dyn std::error::Error>>>,
{
    for (unit, url) in service_probes() {
        journal.stage = format!("restarting:{unit}");
        if !journal.restarted_units.iter().any(|value| value == unit) {
            journal.restarted_units.push(unit.to_string());
        }
        write_update_journal_at(journal_path, journal)?;
        restart(unit.to_string(), url).await?;
    }
    Ok(())
}

async fn restart_and_verify(unit: &str, url: &str) -> Result<(), Box<dyn std::error::Error>> {
    systemctl("stop", &[unit]).await?;
    systemctl("start", &[unit]).await?;
    wait_for_health(url).await
}

async fn rollback_update(journal: &UpdateJournal) -> Result<(), Box<dyn std::error::Error>> {
    let units = journal.restarted_units.iter().map(String::as_str).collect::<Vec<_>>();
    if !units.is_empty() {
        systemctl("stop", &units).await?;
    }
    restore_symlink(&journal.link, journal.old_target.as_deref())?;
    restore_databases_for_units(&journal.backup_dir, &units)?;
    for (unit, url) in service_probes() {
        if units.contains(&unit) {
            systemctl("start", &[unit]).await?;
            wait_for_health(&url).await?;
        }
    }
    Ok(())
}

async fn systemctl(action: &str, units: &[&str]) -> Result<(), Box<dyn std::error::Error>> {
    if !matches!(action, "start" | "stop") || units.iter().any(|unit| !SYSTEMD_UNITS.contains(unit))
    {
        return Err(std::io::Error::other("invalid fixed service operation").into());
    }
    let status = Command::new("systemctl").arg(action).args(units).status().await?;
    if !status.success() {
        return Err(std::io::Error::other(format!("systemctl {action} failed")).into());
    }
    Ok(())
}

async fn wait_for_health(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()?;
    for _ in 0..20 {
        if client.get(url).send().await.is_ok_and(|response| response.status().is_success()) {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Err(std::io::Error::other(format!("health gate failed: {url}")).into())
}

async fn backup_databases(version: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let backup_dir = CONFIG.data_dir().join("backups").join(format!(
        "{}-{}",
        version,
        chrono::Utc::now().timestamp()
    ));
    fs::create_dir_all(&backup_dir)?;
    for path in database_paths() {
        if !path.is_file() {
            continue;
        }
        let file_name = path.file_name().ok_or_else(|| std::io::Error::other("invalid db path"))?;
        let destination = backup_dir.join(file_name);
        backup_database_online(&path, &destination).await?;
    }
    Ok(backup_dir)
}

async fn backup_database_online(
    source: &Path,
    destination: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let pool = crate::infra::db::create_pool_for_path(source).await?;
    sqlx::query("VACUUM INTO ?")
        .bind(destination.to_string_lossy().as_ref())
        .execute(&pool)
        .await?;
    pool.close().await;
    Ok(())
}

#[cfg(test)]
fn backup_database_paths(
    paths: &[PathBuf],
    backup_dir: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    for path in paths {
        for suffix in ["", "-wal", "-shm"] {
            let source = PathBuf::from(format!("{}{suffix}", path.display()));
            if source.is_file() {
                let file_name =
                    source.file_name().ok_or_else(|| std::io::Error::other("invalid db path"))?;
                fs::copy(&source, backup_dir.join(file_name))?;
            }
        }
    }
    Ok(())
}

fn restore_databases_for_units(
    backup_dir: &Path,
    units: &[&str],
) -> Result<(), Box<dyn std::error::Error>> {
    let all_paths = database_paths();
    let paths = SYSTEMD_UNITS
        .iter()
        .zip(all_paths.iter())
        .filter_map(|(unit, path)| units.contains(unit).then_some(path.clone()))
        .collect::<Vec<_>>();
    restore_database_paths(&paths, backup_dir)
}

fn restore_database_paths(
    paths: &[PathBuf],
    backup_dir: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    for path in paths {
        for suffix in ["", "-wal", "-shm"] {
            let destination = PathBuf::from(format!("{}{suffix}", path.display()));
            if destination.exists() {
                fs::remove_file(&destination)?;
            }
            let file_name =
                destination.file_name().ok_or_else(|| std::io::Error::other("invalid db path"))?;
            let source = backup_dir.join(file_name);
            if source.is_file() {
                fs::copy(source, destination)?;
            }
        }
    }
    Ok(())
}

fn database_paths() -> [PathBuf; 4] {
    [
        CONFIG.monitor_database_path(),
        CONFIG.insights_database_path(),
        CONFIG.reports_database_path(),
        CONFIG.sqlite_database_path(),
    ]
}

#[cfg(unix)]
fn swap_symlink(link: &Path, target: &Path) -> Result<(), std::io::Error> {
    use std::os::unix::fs::symlink;
    let temporary = link.with_extension("new");
    if temporary.exists() {
        fs::remove_file(&temporary)?;
    }
    symlink(target, &temporary)?;
    fs::rename(temporary, link)
}

#[cfg(unix)]
fn restore_symlink(link: &Path, old_target: Option<&Path>) -> Result<(), std::io::Error> {
    if let Some(target) = old_target {
        swap_symlink(link, target)
    } else if link.exists() {
        fs::remove_file(link)
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        sync::{Arc, Mutex},
    };

    use super::{
        RELEASE_MARKER_PREFIX, SYSTEMD_UNITS, UpdateJournal, backup_database_online,
        backup_database_paths, detect_elf_arch, read_update_journal_at, restore_database_paths,
        roll_services_with, validate_upload_size, validate_version, write_update_journal_at,
    };

    #[test]
    fn validates_complete_release_identity_and_architecture() {
        let mut elf = vec![0_u8; 64];
        elf[..4].copy_from_slice(b"\x7fELF");
        elf[18..20].copy_from_slice(&62_u16.to_le_bytes());
        elf.extend_from_slice(RELEASE_MARKER_PREFIX);
        assert_eq!(detect_elf_arch(&elf).expect("arch"), "x86_64");
        assert!(validate_upload_size(&elf).is_ok());
        assert_eq!(validate_version("1.2.3".to_string()).expect("version"), "1.2.3");
    }

    #[test]
    fn rejects_module_style_or_invalid_release_inputs() {
        assert!(detect_elf_arch(b"zip").is_err());
        assert!(validate_upload_size(&[]).is_err());
        assert!(validate_version("../module".to_string()).is_err());
    }

    #[test]
    fn update_journal_round_trips_interrupted_state() {
        let root = std::env::temp_dir().join(format!("rz-update-{}", uuid::Uuid::new_v4()));
        let path = root.join("data/update-state.json");
        let journal = UpdateJournal {
            release_id: 7,
            backup_dir: root.join("backup"),
            link: root.join("bin/rz"),
            old_target: Some(root.join("bin/rz-old")),
            stage: "switched".to_string(),
            restarted_units: Vec::new(),
        };

        write_update_journal_at(&path, &journal).expect("write journal");
        let restored = read_update_journal_at(&path).expect("read journal").expect("journal");
        assert_eq!(restored.release_id, journal.release_id);
        assert_eq!(restored.backup_dir, journal.backup_dir);
        assert_eq!(restored.old_target, journal.old_target);
        assert_eq!(restored.stage, "switched");
        assert!(restored.restarted_units.is_empty());
        fs::remove_dir_all(root).expect("remove journal root");
    }

    #[tokio::test]
    async fn every_service_health_failure_stops_the_roll_sequence() {
        for (failed_index, failed_unit) in SYSTEMD_UNITS.iter().enumerate() {
            let root =
                std::env::temp_dir().join(format!("rz-health-gate-{}", uuid::Uuid::new_v4()));
            let journal_path = root.join("update-state.json");
            let mut journal = UpdateJournal {
                release_id: 9,
                backup_dir: root.join("backup"),
                link: root.join("bin/rz"),
                old_target: Some(root.join("bin/rz-old")),
                stage: "switched".to_string(),
                restarted_units: Vec::new(),
            };
            let attempts = Arc::new(Mutex::new(Vec::new()));
            let recorded_attempts = Arc::clone(&attempts);
            let failed_unit = failed_unit.to_string();

            let result = roll_services_with(&mut journal, &journal_path, move |unit, _url| {
                let attempts = Arc::clone(&recorded_attempts);
                let failed_unit = failed_unit.clone();
                async move {
                    attempts.lock().expect("attempt lock").push(unit.clone());
                    if unit == failed_unit {
                        Err(std::io::Error::other("injected health failure").into())
                    } else {
                        Ok(())
                    }
                }
            })
            .await;

            assert!(result.is_err());
            assert_eq!(
                *attempts.lock().expect("attempt lock"),
                SYSTEMD_UNITS[..=failed_index]
                    .iter()
                    .map(|unit| unit.to_string())
                    .collect::<Vec<_>>()
            );
            assert_eq!(journal.restarted_units.len(), failed_index + 1);
            let saved = read_update_journal_at(&journal_path)
                .expect("read journal")
                .expect("saved journal");
            assert_eq!(saved.restarted_units, journal.restarted_units);
            fs::remove_dir_all(root).expect("remove health gate root");
        }
    }

    #[test]
    fn four_database_backup_and_restore_are_independent() {
        let root = std::env::temp_dir().join(format!("rz-backup-{}", uuid::Uuid::new_v4()));
        let data = root.join("data");
        let backup = root.join("backup");
        fs::create_dir_all(&data).expect("data dir");
        fs::create_dir_all(&backup).expect("backup dir");
        let paths = ["admin", "monitor", "insights", "reports"]
            .map(|name| data.join(format!("{name}.db")))
            .to_vec();
        for path in &paths {
            let name = path.file_stem().and_then(|value| value.to_str()).expect("name");
            fs::write(path, format!("{name}-database")).expect("database");
            fs::write(PathBuf::from(format!("{}-wal", path.display())), format!("{name}-wal"))
                .expect("wal");
        }

        backup_database_paths(&paths, &backup).expect("backup");
        for path in &paths {
            fs::write(path, "corrupt").expect("corrupt");
            let wal = PathBuf::from(format!("{}-wal", path.display()));
            if wal.exists() {
                fs::remove_file(wal).expect("remove wal");
            }
        }
        restore_database_paths(&paths, &backup).expect("restore");

        for path in &paths {
            let name = path.file_stem().and_then(|value| value.to_str()).expect("name");
            assert_eq!(fs::read_to_string(path).expect("database"), format!("{name}-database"));
            assert_eq!(
                fs::read_to_string(PathBuf::from(format!("{}-wal", path.display()))).expect("wal"),
                format!("{name}-wal")
            );
        }
        fs::remove_dir_all(root).expect("remove backup root");
    }

    #[tokio::test]
    async fn online_sqlite_backup_is_a_readable_consistent_database() {
        let root = std::env::temp_dir().join(format!("rz-online-backup-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("backup root");
        let source = root.join("source.db");
        let destination = root.join("backup.db");
        let pool = crate::infra::db::create_pool_for_path(&source).await.expect("source pool");
        sqlx::query("CREATE TABLE values_table (value TEXT NOT NULL)")
            .execute(&pool)
            .await
            .expect("create table");
        sqlx::query("INSERT INTO values_table (value) VALUES ('before')")
            .execute(&pool)
            .await
            .expect("insert value");

        backup_database_online(&source, &destination).await.expect("online backup");
        let backup =
            crate::infra::db::create_pool_for_path(&destination).await.expect("backup pool");
        let value: String = sqlx::query_scalar("SELECT value FROM values_table")
            .fetch_one(&backup)
            .await
            .expect("backup value");
        assert_eq!(value, "before");
        backup.close().await;
        pool.close().await;
        fs::remove_dir_all(root).expect("remove backup root");
    }
}
