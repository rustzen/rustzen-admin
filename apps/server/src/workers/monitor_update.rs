use std::{
    fs,
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::{io::AsyncWriteExt, process::Command};

use crate::{
    infra::config::CONFIG,
    workers::common::{sign_ipc_payload, verify_ipc_payload},
};

const UPDATE_PROTOCOL_VERSION: u8 = 1;
const UPDATE_SIGNATURE_LABEL: &str = "monitor-agent-update";
const MAX_AGENT_ARTIFACT_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Debug, Clone)]
pub struct AgentFacts<'a> {
    pub agent_id: &'a str,
    pub current_version: &'a str,
    pub os: &'a str,
    pub arch: &'a str,
    pub available_bytes: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentUpdateDirective {
    protocol_version: u8,
    version: String,
    os: String,
    arch: String,
    download_url: String,
    sha256: String,
    size_bytes: u64,
    signature: String,
}

#[derive(Debug, Clone)]
struct RolloutConfig {
    version: String,
    os: String,
    arch: String,
    download_url: String,
    sha256: String,
    size_bytes: u64,
    stage: RolloutStage,
}

#[derive(Debug, Clone)]
enum RolloutStage {
    Canary(Vec<String>),
    Batch { canaries: Vec<String>, percent: u8 },
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PendingAgentUpdate {
    target_version: String,
    previous_path: PathBuf,
}

pub fn validate_rollout_config() -> Result<(), Box<dyn std::error::Error>> {
    let _ = rollout_config()?;
    Ok(())
}

pub fn directive_for(
    facts: AgentFacts<'_>,
) -> Result<Option<AgentUpdateDirective>, Box<dyn std::error::Error>> {
    let Some(config) = rollout_config()? else {
        return Ok(None);
    };
    if facts.current_version == config.version
        || facts.os != config.os
        || facts.arch != config.arch
        || facts.available_bytes < config.size_bytes.saturating_mul(2)
        || !rollout_includes(&config.stage, facts.agent_id)
    {
        return Ok(None);
    }
    let payload = directive_payload(
        &config.version,
        &config.os,
        &config.arch,
        &config.download_url,
        &config.sha256,
        config.size_bytes,
    );
    Ok(Some(AgentUpdateDirective {
        protocol_version: UPDATE_PROTOCOL_VERSION,
        version: config.version,
        os: config.os,
        arch: config.arch,
        download_url: config.download_url,
        sha256: config.sha256,
        size_bytes: config.size_bytes,
        signature: sign_ipc_payload(UPDATE_SIGNATURE_LABEL, &payload)?,
    }))
}

pub async fn apply_update(
    client: &reqwest::Client,
    directive: &AgentUpdateDirective,
) -> Result<(), Box<dyn std::error::Error>> {
    validate_directive(directive)?;
    let executable = std::env::current_exe()?;
    let paths = AgentUpdatePaths::new(&executable)?;
    remove_file_if_exists(&paths.candidate)?;

    let mut response = client.get(&directive.download_url).send().await?.error_for_status()?;
    if response.content_length().is_some_and(|length| length != directive.size_bytes) {
        return Err(std::io::Error::other("agent artifact size does not match directive").into());
    }
    let mut file = tokio::fs::File::create(&paths.candidate).await?;
    let mut hash = Sha256::new();
    let mut received = 0_u64;
    while let Some(chunk) = response.chunk().await? {
        received = received.saturating_add(chunk.len() as u64);
        if received > directive.size_bytes || received > MAX_AGENT_ARTIFACT_BYTES {
            remove_file_if_exists(&paths.candidate)?;
            return Err(std::io::Error::other("agent artifact exceeds declared size").into());
        }
        hash.update(&chunk);
        file.write_all(&chunk).await?;
    }
    file.sync_all().await?;
    drop(file);
    if received != directive.size_bytes || hex::encode(hash.finalize()) != directive.sha256 {
        remove_file_if_exists(&paths.candidate)?;
        return Err(std::io::Error::other("agent artifact hash or size mismatch").into());
    }
    validate_candidate_arch(&paths.candidate, &directive.arch)?;
    set_executable(&paths.candidate)?;
    preflight_candidate(&paths.candidate).await?;

    install_candidate(&executable, &paths, &directive.version)
}

pub fn confirm_pending_update() -> Result<(), Box<dyn std::error::Error>> {
    let executable = std::env::current_exe()?;
    confirm_pending_update_at(&executable, env!("CARGO_PKG_VERSION"))
}

fn confirm_pending_update_at(
    executable: &Path,
    current_version: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let paths = AgentUpdatePaths::new(executable)?;
    let Some(pending) = read_pending(&paths.pending)? else {
        return Ok(());
    };
    if pending.target_version == current_version {
        remove_file_if_exists(&pending.previous_path)?;
    }
    remove_file_if_exists(&paths.pending)?;
    Ok(())
}

pub fn rollback_pending_update() -> Result<bool, Box<dyn std::error::Error>> {
    let executable = std::env::current_exe()?;
    rollback_pending_update_at(&executable, env!("CARGO_PKG_VERSION"))
}

fn rollback_pending_update_at(
    executable: &Path,
    current_version: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    let paths = AgentUpdatePaths::new(executable)?;
    let Some(pending) = read_pending(&paths.pending)? else {
        return Ok(false);
    };
    if pending.target_version != current_version || !pending.previous_path.is_file() {
        remove_file_if_exists(&paths.pending)?;
        return Ok(false);
    }
    let failed = paths.parent.join(format!(".{}.failed", paths.file_name));
    remove_file_if_exists(&failed)?;
    fs::rename(executable, &failed)?;
    if let Err(error) = fs::rename(&pending.previous_path, executable) {
        fs::rename(&failed, executable)?;
        return Err(error.into());
    }
    remove_file_if_exists(&paths.pending)?;
    Ok(true)
}

fn install_candidate(
    executable: &Path,
    paths: &AgentUpdatePaths,
    target_version: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    remove_file_if_exists(&paths.previous)?;
    write_pending(
        &paths.pending,
        &PendingAgentUpdate {
            target_version: target_version.to_string(),
            previous_path: paths.previous.clone(),
        },
    )?;
    fs::rename(executable, &paths.previous)?;
    if let Err(error) = fs::rename(&paths.candidate, executable) {
        fs::rename(&paths.previous, executable)?;
        remove_file_if_exists(&paths.pending)?;
        return Err(error.into());
    }
    Ok(())
}

fn rollout_config() -> Result<Option<RolloutConfig>, Box<dyn std::error::Error>> {
    let values = [
        CONFIG.monitor_agent_release_url.as_deref(),
        CONFIG.monitor_agent_release_sha256.as_deref(),
        CONFIG.monitor_agent_release_version.as_deref(),
        CONFIG.monitor_agent_release_os.as_deref(),
        CONFIG.monitor_agent_release_arch.as_deref(),
    ];
    if values.iter().all(|value| value.is_none_or(|value| value.trim().is_empty()))
        && CONFIG.monitor_agent_release_size_bytes.is_none()
    {
        return Ok(None);
    }
    let required = |value: Option<&str>, name: &str| {
        value
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .ok_or_else(|| std::io::Error::other(format!("{name} is required")))
    };
    let sha256 = required(
        CONFIG.monitor_agent_release_sha256.as_deref(),
        "RUSTZEN_MONITOR_AGENT_RELEASE_SHA256",
    )?
    .to_ascii_lowercase();
    if sha256.len() != 64 || !sha256.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(std::io::Error::other("invalid Monitor Agent SHA-256").into());
    }
    let size_bytes = CONFIG
        .monitor_agent_release_size_bytes
        .filter(|size| *size > 0 && *size <= MAX_AGENT_ARTIFACT_BYTES)
        .ok_or_else(|| std::io::Error::other("invalid Monitor Agent artifact size"))?;
    let canaries = CONFIG
        .monitor_agent_canary_ids
        .as_deref()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    let stage = match CONFIG.monitor_agent_rollout_stage.as_deref().map(str::trim) {
        Some("canary") if !canaries.is_empty() => RolloutStage::Canary(canaries),
        Some("batch") => RolloutStage::Batch {
            canaries,
            percent: CONFIG.monitor_agent_batch_percent.unwrap_or(0).min(100),
        },
        _ => return Err(std::io::Error::other("Monitor Agent rollout stage is invalid").into()),
    };
    Ok(Some(RolloutConfig {
        version: required(
            CONFIG.monitor_agent_release_version.as_deref(),
            "RUSTZEN_MONITOR_AGENT_RELEASE_VERSION",
        )?,
        os: required(
            CONFIG.monitor_agent_release_os.as_deref(),
            "RUSTZEN_MONITOR_AGENT_RELEASE_OS",
        )?,
        arch: required(
            CONFIG.monitor_agent_release_arch.as_deref(),
            "RUSTZEN_MONITOR_AGENT_RELEASE_ARCH",
        )?,
        download_url: required(
            CONFIG.monitor_agent_release_url.as_deref(),
            "RUSTZEN_MONITOR_AGENT_RELEASE_URL",
        )?,
        sha256,
        size_bytes,
        stage,
    }))
}

fn rollout_includes(stage: &RolloutStage, agent_id: &str) -> bool {
    match stage {
        RolloutStage::Canary(canaries) => canaries.iter().any(|value| value == agent_id),
        RolloutStage::Batch { canaries, percent } => {
            canaries.iter().any(|value| value == agent_id)
                || rollout_bucket(agent_id) < u16::from(*percent)
        }
    }
}

fn rollout_bucket(agent_id: &str) -> u16 {
    let digest = Sha256::digest(agent_id.as_bytes());
    u16::from_be_bytes([digest[0], digest[1]]) % 100
}

fn validate_directive(directive: &AgentUpdateDirective) -> Result<(), Box<dyn std::error::Error>> {
    if directive.protocol_version != UPDATE_PROTOCOL_VERSION
        || directive.version == env!("CARGO_PKG_VERSION")
        || directive.os != std::env::consts::OS
        || directive.arch != std::env::consts::ARCH
        || directive.size_bytes == 0
        || directive.size_bytes > MAX_AGENT_ARTIFACT_BYTES
        || directive.sha256.len() != 64
    {
        return Err(std::io::Error::other("agent update directive is incompatible").into());
    }
    verify_ipc_payload(
        UPDATE_SIGNATURE_LABEL,
        &directive_payload(
            &directive.version,
            &directive.os,
            &directive.arch,
            &directive.download_url,
            &directive.sha256,
            directive.size_bytes,
        ),
        &directive.signature,
    )
    .map_err(|_| std::io::Error::other("agent update directive signature is invalid"))?;
    Ok(())
}

fn directive_payload(
    version: &str,
    os: &str,
    arch: &str,
    url: &str,
    sha256: &str,
    size_bytes: u64,
) -> String {
    format!(
        "protocol={UPDATE_PROTOCOL_VERSION}\nversion={version}\nos={os}\narch={arch}\nurl={url}\nsha256={sha256}\nsize={size_bytes}"
    )
}

fn validate_candidate_arch(path: &Path, arch: &str) -> Result<(), Box<dyn std::error::Error>> {
    let data = fs::read(path)?;
    if data.len() < 20 || &data[..4] != b"\x7fELF" {
        return Err(std::io::Error::other("agent candidate is not an ELF executable").into());
    }
    let machine = u16::from_le_bytes([data[18], data[19]]);
    if !matches!((arch, machine), ("x86_64", 62) | ("aarch64", 183)) {
        return Err(std::io::Error::other("agent candidate architecture mismatch").into());
    }
    Ok(())
}

async fn preflight_candidate(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let status = tokio::time::timeout(
        Duration::from_secs(10),
        Command::new(path)
            .args(["monitor", "agent", "verify"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status(),
    )
    .await
    .map_err(|_| std::io::Error::other("agent candidate preflight timed out"))??;
    if !status.success() {
        return Err(std::io::Error::other("agent candidate preflight failed").into());
    }
    Ok(())
}

struct AgentUpdatePaths {
    parent: PathBuf,
    file_name: String,
    candidate: PathBuf,
    previous: PathBuf,
    pending: PathBuf,
}

impl AgentUpdatePaths {
    fn new(executable: &Path) -> Result<Self, std::io::Error> {
        let parent = executable
            .parent()
            .ok_or_else(|| std::io::Error::other("agent executable has no parent"))?
            .to_path_buf();
        let file_name = executable
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| std::io::Error::other("agent executable name is invalid"))?
            .to_string();
        Ok(Self {
            candidate: parent.join(format!(".{file_name}.candidate")),
            previous: parent.join(format!(".{file_name}.previous")),
            pending: parent.join(format!(".{file_name}.update.json")),
            parent,
            file_name,
        })
    }
}

fn write_pending(path: &Path, pending: &PendingAgentUpdate) -> Result<(), std::io::Error> {
    let temporary = path.with_extension("json.new");
    fs::write(&temporary, serde_json::to_vec(pending).map_err(std::io::Error::other)?)?;
    fs::rename(temporary, path)
}

fn read_pending(path: &Path) -> Result<Option<PendingAgentUpdate>, Box<dyn std::error::Error>> {
    match fs::read(path) {
        Ok(data) => Ok(Some(serde_json::from_slice(&data)?)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

fn remove_file_if_exists(path: &Path) -> Result<(), std::io::Error> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

#[cfg(unix)]
fn set_executable(path: &Path) -> Result<(), std::io::Error> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o755))
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) -> Result<(), std::io::Error> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{
        AgentUpdatePaths, RolloutStage, confirm_pending_update_at, install_candidate,
        rollback_pending_update_at, rollout_bucket, rollout_includes,
    };

    #[test]
    fn canary_stage_selects_only_explicit_agents() {
        let stage = RolloutStage::Canary(vec!["canary-a".to_string()]);
        assert!(rollout_includes(&stage, "canary-a"));
        assert!(!rollout_includes(&stage, "node-b"));
    }

    #[test]
    fn batch_stage_is_stable_and_bounded() {
        let agent_id = "stable-node";
        assert_eq!(rollout_bucket(agent_id), rollout_bucket(agent_id));
        assert!(!rollout_includes(
            &RolloutStage::Batch { canaries: Vec::new(), percent: 0 },
            agent_id
        ));
        assert!(rollout_includes(
            &RolloutStage::Batch { canaries: Vec::new(), percent: 100 },
            agent_id
        ));
    }

    #[test]
    fn candidate_install_is_atomic_and_failed_heartbeat_can_restore_previous_binary() {
        let root = std::env::temp_dir().join(format!("rz-agent-update-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("update root");
        let executable = root.join("rz");
        fs::write(&executable, b"old").expect("old executable");
        let paths = AgentUpdatePaths::new(&executable).expect("paths");
        fs::write(&paths.candidate, b"new").expect("candidate");

        install_candidate(&executable, &paths, "2.0.0").expect("install");
        assert_eq!(fs::read(&executable).expect("current"), b"new");
        assert_eq!(fs::read(&paths.previous).expect("previous"), b"old");
        assert!(paths.pending.is_file());

        assert!(rollback_pending_update_at(&executable, "2.0.0").expect("rollback"));
        assert_eq!(fs::read(&executable).expect("restored"), b"old");
        assert!(!paths.pending.exists());
        fs::remove_dir_all(root).expect("remove root");
    }

    #[test]
    fn successful_heartbeat_confirms_update_and_removes_previous_binary() {
        let root = std::env::temp_dir().join(format!("rz-agent-confirm-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("update root");
        let executable = root.join("rz");
        fs::write(&executable, b"old").expect("old executable");
        let paths = AgentUpdatePaths::new(&executable).expect("paths");
        fs::write(&paths.candidate, b"new").expect("candidate");
        install_candidate(&executable, &paths, "2.0.0").expect("install");

        confirm_pending_update_at(&executable, "2.0.0").expect("confirm");
        assert_eq!(fs::read(&executable).expect("current"), b"new");
        assert!(!paths.previous.exists());
        assert!(!paths.pending.exists());
        fs::remove_dir_all(root).expect("remove root");
    }
}
