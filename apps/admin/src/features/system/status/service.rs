use std::{
    fs, io,
    path::{Path, PathBuf},
};

use crate::infra::config::CONFIG;
use chrono::Utc;
use tokio::task;
use tracing::warn;

use crate::{
    common::error::ServiceError,
    infra::system_info::{SystemInfo, SystemUtils},
};

use super::types::{
    CpuResourceStatus, DirectoryStorageItem, DiskResourceStatus, LocalResourceStatus,
    MemoryResourceStatus, SqliteStorageStatus, SystemStatusOverview, SystemStorageStatus,
};

pub struct SystemStatusService;

impl SystemStatusService {
    pub async fn overview() -> Result<SystemStatusOverview, ServiceError> {
        let storage = task::spawn_blocking(collect_storage_status).await.map_err(|err| {
            ServiceError::InvalidOperation(format!("Status collection failed: {err}"))
        })?;

        Ok(SystemStatusOverview {
            collected_at: Utc::now(),
            storage,
            resource: collect_local_resource_status(SystemUtils::get_system_info()),
        })
    }
}

fn collect_storage_status() -> SystemStorageStatus {
    SystemStorageStatus {
        database: collect_sqlite_storage(&CONFIG.admin_database_path()),
        directories: collect_directory_items(),
    }
}

fn collect_sqlite_storage(db_path: &Path) -> SqliteStorageStatus {
    let main_bytes = path_size_bytes(db_path).unwrap_or_else(|err| {
        warn!(
            path = %db_path.display(),
            error = %err,
            "failed to collect sqlite main file size"
        );
        0
    });
    let wal_path = sqlite_sidecar_path(db_path, "-wal");
    let wal_bytes = path_size_bytes(&wal_path).unwrap_or_else(|err| {
        warn!(
            path = %wal_path.display(),
            error = %err,
            "failed to collect sqlite wal file size"
        );
        0
    });
    let shm_path = sqlite_sidecar_path(db_path, "-shm");
    let shm_bytes = path_size_bytes(&shm_path).unwrap_or_else(|err| {
        warn!(
            path = %shm_path.display(),
            error = %err,
            "failed to collect sqlite shm file size"
        );
        0
    });

    SqliteStorageStatus {
        total_bytes: main_bytes.saturating_add(wal_bytes).saturating_add(shm_bytes),
        main_bytes,
        wal_bytes,
        shm_bytes,
    }
}

fn collect_directory_items() -> Vec<DirectoryStorageItem> {
    let runtime_root = CONFIG.runtime_root_dir();
    [
        ("web", "web 静态资源", CONFIG.web_dist_dir()),
        ("bin", "bin 服务程序", runtime_root.join("bin")),
        ("logs", "logs 日志", CONFIG.log_dir()),
        ("data", "data 数据", CONFIG.data_dir()),
    ]
    .into_iter()
    .map(|(key, label, path)| directory_item(key, label, path))
    .collect()
}

fn directory_item(key: &str, label: &str, path: PathBuf) -> DirectoryStorageItem {
    match path_size_bytes(&path) {
        Ok(size_bytes) => DirectoryStorageItem {
            key: key.to_string(),
            label: label.to_string(),
            size_bytes,
            error_message: None,
        },
        Err(err) => {
            warn!(
                path = %path.display(),
                error = %err,
                "failed to collect system status directory size"
            );
            DirectoryStorageItem {
                key: key.to_string(),
                label: label.to_string(),
                size_bytes: 0,
                error_message: Some("Read failed".to_string()),
            }
        }
    }
}

fn collect_local_resource_status(info: SystemInfo) -> LocalResourceStatus {
    LocalResourceStatus {
        cpu: CpuResourceStatus {
            cores: info.cpu_total as u64,
            usage_percent: round_percent(info.cpu_used as f64),
        },
        memory: MemoryResourceStatus {
            total_bytes: info.memory_total,
            used_bytes: info.memory_used,
            available_bytes: info.memory_free,
            usage_percent: percentage(info.memory_used, info.memory_total),
        },
        disk: DiskResourceStatus {
            total_bytes: info.disk_total,
            used_bytes: info.disk_used,
            available_bytes: info.disk_free,
            usage_percent: percentage(info.disk_used, info.disk_total),
        },
    }
}

fn path_size_bytes(path: &Path) -> Result<u64, ServiceError> {
    match path_size_bytes_inner(path) {
        Ok(size) => Ok(size),
        Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(0),
        Err(err) => Err(ServiceError::InvalidOperation(format!(
            "Failed to read path size: {}, {}",
            path.display(),
            err
        ))),
    }
}

fn path_size_bytes_inner(path: &Path) -> io::Result<u64> {
    let metadata = fs::symlink_metadata(path)?;
    if metadata.is_file() {
        return Ok(metadata.len());
    }
    if metadata.is_symlink() || !metadata.is_dir() {
        return Ok(0);
    }

    let mut total = 0_u64;
    for entry in fs::read_dir(path)? {
        total = total.saturating_add(path_size_bytes_inner(&entry?.path())?);
    }
    Ok(total)
}

fn sqlite_sidecar_path(db_path: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{}", db_path.to_string_lossy(), suffix))
}

fn percentage(used: u64, total: u64) -> f64 {
    if total == 0 { 0.0 } else { round_percent((used as f64 / total as f64) * 100.0) }
}

fn round_percent(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn path_size_counts_nested_files_and_missing_path_as_zero() {
        let dir = std::env::temp_dir().join(format!(
            "rustzen-admin-status-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time after unix epoch")
                .as_nanos()
        ));
        fs::create_dir(&dir).expect("create temp dir");
        let nested = dir.join("nested");
        fs::create_dir(&nested).expect("create nested dir");

        let mut first = fs::File::create(dir.join("first.txt")).expect("create first file");
        first.write_all(b"abc").expect("write first file");
        let mut second = fs::File::create(nested.join("second.txt")).expect("create second file");
        second.write_all(b"defg").expect("write second file");

        assert_eq!(path_size_bytes(&dir).expect("read dir size"), 7);
        assert_eq!(path_size_bytes(&dir.join("missing")).expect("read missing size"), 0);
        fs::remove_dir_all(&dir).expect("remove temp dir");
    }

    #[test]
    fn sqlite_sidecar_path_appends_suffix_to_full_database_filename() {
        let path = PathBuf::from("/tmp/rustzen.db");

        assert_eq!(sqlite_sidecar_path(&path, "-wal"), PathBuf::from("/tmp/rustzen.db-wal"));
        assert_eq!(sqlite_sidecar_path(&path, "-shm"), PathBuf::from("/tmp/rustzen.db-shm"));
    }
}
