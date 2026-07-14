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
