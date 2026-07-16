ALTER TABLE insights_projects ADD COLUMN archived_at TEXT;

ALTER TABLE insights_events RENAME TO insights_events_v1;

CREATE TABLE insights_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT,
    platform TEXT,
    page_path TEXT,
    referrer TEXT,
    api_path TEXT,
    api_method TEXT,
    status_code INTEGER,
    duration_ms INTEGER,
    is_error INTEGER NOT NULL DEFAULT 0 CHECK(is_error IN (0, 1)),
    properties TEXT NOT NULL DEFAULT '{}',
    occurred_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES insights_projects(id) ON DELETE CASCADE
);

INSERT INTO insights_events (
    id, project_id, event_name, visitor_id, page_path, api_path,
    duration_ms, is_error, occurred_at, received_at
)
SELECT id, project_id, event_type, visitor_id,
       CASE WHEN event_type = 'page_view' THEN path END,
       CASE WHEN event_type = 'api_request' THEN path END,
       duration_ms, is_error, occurred_at, occurred_at
FROM insights_events_v1;

DROP TABLE insights_events_v1;

CREATE INDEX idx_insights_events_project_time
ON insights_events(project_id, occurred_at DESC);

CREATE INDEX idx_insights_events_project_name_time
ON insights_events(project_id, event_name, occurred_at DESC);

CREATE INDEX idx_insights_events_project_page_time
ON insights_events(project_id, page_path, occurred_at DESC);

CREATE INDEX idx_insights_events_project_api_time
ON insights_events(project_id, api_path, occurred_at DESC);

CREATE INDEX idx_insights_events_project_visitor_time
ON insights_events(project_id, visitor_id, occurred_at DESC);

CREATE TABLE insights_settings (
    singleton INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK(singleton = 1),
    event_retention_days INTEGER NOT NULL DEFAULT 30,
    default_query_days INTEGER NOT NULL DEFAULT 7,
    max_query_days INTEGER NOT NULL DEFAULT 90,
    max_batch_events INTEGER NOT NULL DEFAULT 100,
    business_timezone TEXT NOT NULL DEFAULT 'UTC',
    updated_at TEXT NOT NULL
);

INSERT INTO insights_settings (singleton, updated_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
