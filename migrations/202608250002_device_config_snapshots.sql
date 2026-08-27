CREATE TABLE IF NOT EXISTS device_config_contents (
    id TEXT PRIMARY KEY,
    connection_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    content_size_bytes INTEGER NOT NULL,
    UNIQUE (connection_name, kind, sha256)
);

CREATE TABLE IF NOT EXISTS device_config_snapshots (
    id TEXT PRIMARY KEY,
    connection_name TEXT NOT NULL,
    host TEXT NOT NULL,
    device_profile TEXT NOT NULL,
    kind TEXT NOT NULL,
    command TEXT NOT NULL,
    source TEXT NOT NULL,
    task_id TEXT,
    fetched_at_ms INTEGER NOT NULL,
    content_id TEXT NOT NULL,
    previous_snapshot_id TEXT,
    changed_from_previous INTEGER,
    FOREIGN KEY (content_id) REFERENCES device_config_contents(id) ON DELETE RESTRICT,
    FOREIGN KEY (previous_snapshot_id) REFERENCES device_config_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_device_config_snapshots_connection_kind_fetched
ON device_config_snapshots(connection_name, kind, fetched_at_ms DESC);

CREATE INDEX IF NOT EXISTS idx_device_config_snapshots_fetched
ON device_config_snapshots(fetched_at_ms DESC);

CREATE INDEX IF NOT EXISTS idx_device_config_snapshots_task
ON device_config_snapshots(task_id);
