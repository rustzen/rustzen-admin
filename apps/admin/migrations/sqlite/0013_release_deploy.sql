-- Preserve historical split server/web deployment rows as read-only evidence.
ALTER TABLE deploy_versions RENAME TO deploy_versions_legacy;

CREATE TABLE deploy_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component TEXT NOT NULL DEFAULT 'release' CHECK(component = 'release'),
    version TEXT NOT NULL,
    arch TEXT NOT NULL CHECK(arch IN ('x86_64', 'aarch64')),
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK(file_size > 0),
    file_hash TEXT NOT NULL,
    is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0, 1)),
    is_deployed INTEGER NOT NULL DEFAULT 0 CHECK(is_deployed IN (0, 1)),
    is_expired INTEGER NOT NULL DEFAULT 0 CHECK(is_expired IN (0, 1)),
    deployed_at DATETIME,
    expired_at DATETIME,
    deleted_at DATETIME,
    deployed_by TEXT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(component, version, arch)
);

CREATE INDEX idx_release_deploy_versions_component ON deploy_versions(component);
CREATE INDEX idx_release_deploy_versions_current ON deploy_versions(is_current);
CREATE INDEX idx_release_deploy_versions_expired ON deploy_versions(is_expired);
CREATE INDEX idx_release_deploy_versions_created ON deploy_versions(created_at DESC);
