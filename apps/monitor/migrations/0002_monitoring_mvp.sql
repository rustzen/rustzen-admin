CREATE TABLE monitor_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    offline_after_seconds INTEGER NOT NULL CHECK (offline_after_seconds BETWEEN 30 AND 3600),
    metrics_retention_days INTEGER NOT NULL CHECK (metrics_retention_days BETWEEN 1 AND 365),
    check_result_retention_days INTEGER NOT NULL CHECK (check_result_retention_days BETWEEN 1 AND 365),
    default_check_interval_seconds INTEGER NOT NULL CHECK (default_check_interval_seconds BETWEEN 30 AND 86400),
    default_check_timeout_ms INTEGER NOT NULL CHECK (default_check_timeout_ms BETWEEN 100 AND 30000),
    failure_threshold INTEGER NOT NULL CHECK (failure_threshold BETWEEN 1 AND 20),
    cpu_threshold_percent REAL NOT NULL CHECK (cpu_threshold_percent BETWEEN 1 AND 100),
    memory_threshold_percent REAL NOT NULL CHECK (memory_threshold_percent BETWEEN 1 AND 100),
    disk_threshold_percent REAL NOT NULL CHECK (disk_threshold_percent BETWEEN 1 AND 100),
    updated_at TEXT NOT NULL
);

INSERT INTO monitor_settings (
    id, offline_after_seconds, metrics_retention_days, check_result_retention_days,
    default_check_interval_seconds, default_check_timeout_ms, failure_threshold,
    cpu_threshold_percent, memory_threshold_percent, disk_threshold_percent, updated_at
) VALUES (1, 90, 30, 30, 60, 5000, 3, 90, 90, 90, CURRENT_TIMESTAMP);

CREATE TABLE monitor_checks (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
    interval_seconds INTEGER NOT NULL CHECK (interval_seconds BETWEEN 30 AND 86400),
    timeout_ms INTEGER NOT NULL CHECK (timeout_ms BETWEEN 100 AND 30000),
    failure_threshold INTEGER NOT NULL CHECK (failure_threshold BETWEEN 1 AND 20),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    last_status TEXT CHECK (last_status IN ('up', 'down')),
    last_checked_at TEXT,
    last_latency_ms INTEGER,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_monitor_checks_due
ON monitor_checks(enabled, last_checked_at, interval_seconds);

CREATE TABLE monitor_check_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('up', 'down')),
    latency_ms INTEGER,
    error TEXT,
    checked_at TEXT NOT NULL,
    FOREIGN KEY (check_id) REFERENCES monitor_checks(id) ON DELETE CASCADE
);

CREATE INDEX idx_monitor_check_results_check_time
ON monitor_check_results(check_id, checked_at DESC);

CREATE TABLE monitor_incidents (
    id TEXT PRIMARY KEY NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('node', 'check', 'resource')),
    source_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'resolved')),
    details TEXT NOT NULL DEFAULT '{}',
    opened_at TEXT NOT NULL,
    acknowledged_at TEXT,
    resolved_at TEXT,
    last_observed_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_monitor_incidents_active_source
ON monitor_incidents(source_type, source_id, kind)
WHERE status IN ('open', 'acknowledged');

CREATE INDEX idx_monitor_incidents_status_opened
ON monitor_incidents(status, opened_at DESC);
