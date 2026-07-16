CREATE TABLE IF NOT EXISTS insights_projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    project_key_hash TEXT NOT NULL UNIQUE,
    allowed_origins TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insights_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('page_view', 'api_request')),
    visitor_id TEXT NOT NULL,
    path TEXT NOT NULL,
    duration_ms INTEGER,
    is_error INTEGER NOT NULL DEFAULT 0 CHECK(is_error IN (0, 1)),
    occurred_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES insights_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_insights_events_project_time
ON insights_events(project_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_insights_events_project_type_time
ON insights_events(project_id, event_type, occurred_at DESC);
