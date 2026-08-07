CREATE TABLE IF NOT EXISTS device_discovery_runs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    phase TEXT NOT NULL,
    targets_json TEXT NOT NULL,
    ports_json TEXT NOT NULL,
    credential_ids_json TEXT NOT NULL,
    default_groups_json TEXT NOT NULL,
    default_labels_json TEXT NOT NULL,
    concurrency INTEGER NOT NULL,
    tcp_timeout_ms INTEGER NOT NULL,
    probe_timeout_secs INTEGER NOT NULL,
    total_targets INTEGER NOT NULL,
    scanned_targets INTEGER NOT NULL DEFAULT 0,
    reachable_count INTEGER NOT NULL DEFAULT 0,
    probed_targets INTEGER NOT NULL DEFAULT 0,
    identified_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at_ms INTEGER NOT NULL,
    started_at_ms INTEGER,
    completed_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_device_discovery_runs_created_at
ON device_discovery_runs(created_at_ms DESC);

CREATE TABLE IF NOT EXISTS device_discovery_results (
    run_id TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    status TEXT NOT NULL,
    latency_ms INTEGER,
    credential_id TEXT,
    device_profile TEXT,
    device_model TEXT,
    software_version TEXT,
    existing_connection_name TEXT,
    imported_connection_name TEXT,
    error TEXT,
    updated_at_ms INTEGER NOT NULL,
    PRIMARY KEY(run_id, host, port),
    FOREIGN KEY(run_id) REFERENCES device_discovery_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_discovery_results_run_status
ON device_discovery_results(run_id, status, host, port);

CREATE TABLE IF NOT EXISTS device_discovery_lease (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    run_id TEXT NOT NULL,
    heartbeat_at_ms INTEGER NOT NULL,
    FOREIGN KEY(run_id) REFERENCES device_discovery_runs(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_discovery_lease_run
ON device_discovery_lease(run_id);
