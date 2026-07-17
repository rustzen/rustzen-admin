CREATE TABLE IF NOT EXISTS report_templates (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS report_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    template_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'succeeded', 'failed')),
    input_json TEXT NOT NULL,
    output_file TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_report_jobs_created
ON report_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_jobs_expiry
ON report_jobs(expires_at);

CREATE TABLE automation_systems (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE automation_accounts (
    id TEXT PRIMARY KEY NOT NULL,
    system_id TEXT NOT NULL,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    secret_ciphertext TEXT NOT NULL,
    secret_nonce TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (system_id) REFERENCES automation_systems(id) ON DELETE RESTRICT
);

CREATE INDEX idx_automation_accounts_system ON automation_accounts(system_id, created_at DESC);

CREATE TABLE automation_flows (
    id TEXT PRIMARY KEY NOT NULL,
    system_id TEXT NOT NULL,
    name TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (system_id) REFERENCES automation_systems(id) ON DELETE RESTRICT
);

CREATE INDEX idx_automation_flows_system ON automation_flows(system_id, created_at DESC);

CREATE TABLE automation_runs (
    id TEXT PRIMARY KEY NOT NULL,
    flow_id TEXT NOT NULL,
    account_id TEXT,
    schedule_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    input_json TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    FOREIGN KEY (flow_id) REFERENCES automation_flows(id) ON DELETE RESTRICT,
    FOREIGN KEY (account_id) REFERENCES automation_accounts(id) ON DELETE RESTRICT
);

CREATE INDEX idx_automation_runs_status_created ON automation_runs(status, created_at);

CREATE TABLE automation_run_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    duration_ms INTEGER,
    message TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES automation_runs(id) ON DELETE CASCADE
);

CREATE TABLE automation_artifacts (
    id TEXT PRIMARY KEY NOT NULL,
    run_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES automation_runs(id) ON DELETE CASCADE
);

CREATE TABLE automation_schedules (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    flow_id TEXT NOT NULL,
    account_id TEXT,
    cron TEXT NOT NULL,
    input_json TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
    next_run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (flow_id) REFERENCES automation_flows(id) ON DELETE RESTRICT,
    FOREIGN KEY (account_id) REFERENCES automation_accounts(id) ON DELETE RESTRICT
);

CREATE TABLE automation_schedule_ticks (
    schedule_id TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    run_id TEXT NOT NULL,
    PRIMARY KEY (schedule_id, scheduled_at)
);

CREATE TABLE automation_settings (
    singleton INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK(singleton = 1),
    run_retention_days INTEGER NOT NULL DEFAULT 30,
    artifact_retention_days INTEGER NOT NULL DEFAULT 30,
    default_step_timeout_seconds INTEGER NOT NULL DEFAULT 30,
    max_run_timeout_seconds INTEGER NOT NULL DEFAULT 600,
    updated_at TEXT NOT NULL
);

INSERT INTO automation_settings (singleton, updated_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
