CREATE TABLE IF NOT EXISTS monitor_nodes (
    id TEXT PRIMARY KEY NOT NULL,
    agent_id TEXT NOT NULL UNIQUE,
    hostname TEXT NOT NULL,
    agent_version TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monitor_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    cpu_percent REAL NOT NULL,
    memory_used_bytes INTEGER NOT NULL,
    memory_total_bytes INTEGER NOT NULL,
    disk_used_bytes INTEGER NOT NULL,
    disk_total_bytes INTEGER NOT NULL,
    collected_at TEXT NOT NULL,
    FOREIGN KEY (node_id) REFERENCES monitor_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_monitor_nodes_last_seen
ON monitor_nodes(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitor_metrics_node_collected
ON monitor_metrics(node_id, collected_at DESC);
