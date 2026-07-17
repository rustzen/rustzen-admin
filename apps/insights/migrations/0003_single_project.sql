INSERT OR IGNORE INTO insights_projects (
    id, name, project_key_hash, allowed_origins, created_at, updated_at
)
VALUES (
    'default', 'Default', '6ab538c2b9772ed3ea67476cf10035de9a31718833b1ab27c2d28c269f9a5b95', '[]',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
