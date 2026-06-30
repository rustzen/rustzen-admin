//! Runtime layout helpers for sqlite-first runtime startup.

use std::path::PathBuf;

/// Default runtime root used by local development and packaging.
pub const DEFAULT_RUNTIME_ROOT: &str = ".rustzen-admin";

/// Default public files prefix for uploaded assets.
pub const DEFAULT_FILES_PREFIX: &str = "/resources";

/// Shared runtime paths under a single root path.
#[derive(Debug, Clone, Eq, PartialEq)]
pub struct RuntimeLayout {
    runtime_root: String,
    inner: rz_config::RuntimeLayout,
}

impl RuntimeLayout {
    /// Creates a layout bound to a runtime root and public files prefix.
    pub fn new(runtime_root: impl Into<String>, files_prefix: impl Into<String>) -> Self {
        let runtime_root = runtime_root.into();
        Self {
            inner: rz_config::RuntimeLayout::new(runtime_root.clone(), files_prefix.into()),
            runtime_root,
        }
    }

    /// Returns the configured runtime root as string.
    pub fn runtime_root(&self) -> &str {
        &self.runtime_root
    }

    /// Root directory path as configured (relative or absolute).
    pub fn runtime_root_dir(&self) -> PathBuf {
        self.inner.runtime_root_dir()
    }

    /// Directory for packaged frontend assets.
    pub fn web_dist_dir(&self) -> PathBuf {
        self.inner.web_dist_dir()
    }

    /// Directory for uploaded and runtime data.
    pub fn data_dir(&self) -> PathBuf {
        self.inner.data_dir()
    }

    /// Directory for SQLite database files.
    pub fn db_dir(&self) -> PathBuf {
        self.inner.db_dir()
    }

    /// Directory for logs.
    pub fn log_dir(&self) -> PathBuf {
        self.inner.log_dir()
    }

    /// Avatar file directory.
    pub fn avatars_dir(&self) -> PathBuf {
        self.inner.avatars_dir()
    }

    /// Upload root directory.
    pub fn uploads_dir(&self) -> PathBuf {
        self.inner.uploads_dir()
    }

    /// Public avatar prefix for static file route.
    pub fn avatars_prefix(&self) -> String {
        self.inner.avatars_prefix()
    }

    /// Resolves a runtime path value relative to runtime root.
    pub fn resolve_runtime_path(&self, value: &str) -> PathBuf {
        self.inner.resolve_runtime_path(value)
    }
}

/// Resolves a path relative to a runtime root.
///
/// Relative paths use the local working directory when runtime root is relative.
pub fn resolve_path_with_runtime_root(runtime_root: &str, value: &str) -> PathBuf {
    rz_config::RuntimeLayout::new(runtime_root, DEFAULT_FILES_PREFIX).resolve_runtime_path(value)
}

#[cfg(test)]
mod tests {
    use super::{DEFAULT_RUNTIME_ROOT, RuntimeLayout, resolve_path_with_runtime_root};
    use std::path::Path;
    use std::path::PathBuf;

    #[test]
    fn runtime_layout_derives_standard_directories() {
        let layout = RuntimeLayout::new(".rustzen-admin", "/resources");

        assert_eq!(layout.runtime_root_dir(), PathBuf::from(".rustzen-admin"));
        assert_eq!(layout.db_dir(), PathBuf::from(".rustzen-admin/data/db"));
        assert_eq!(layout.web_dist_dir(), PathBuf::from(".rustzen-admin/web/dist"));
        assert_eq!(layout.data_dir(), PathBuf::from(".rustzen-admin/data"));
        assert_eq!(layout.log_dir(), PathBuf::from(".rustzen-admin/logs"));
        assert_eq!(layout.uploads_dir(), PathBuf::from(".rustzen-admin/data/uploads"));
        assert_eq!(layout.avatars_dir(), PathBuf::from(".rustzen-admin/data/avatars"));
        assert_eq!(layout.avatars_prefix(), "/resources/avatars");
    }

    #[test]
    fn runtime_root_default_matches_constant() {
        assert_eq!(DEFAULT_RUNTIME_ROOT, ".rustzen-admin");
    }

    #[test]
    fn resolve_path_prefers_absolute_candidate() {
        let resolved = resolve_path_with_runtime_root(".rustzen-admin", "/tmp/data.db");

        assert_eq!(resolved, PathBuf::from("/tmp/data.db"));
        assert!(Path::new("/tmp/data.db").is_absolute());
    }
}
