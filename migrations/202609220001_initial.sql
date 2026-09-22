-- Consolidated schema for new installations.
-- Future schema changes must use new incremental migrations.

CREATE TABLE device_credentials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password_ref TEXT NOT NULL,
    enable_password_ref TEXT,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    enable_enabled INTEGER NOT NULL DEFAULT 0,
    auth_type TEXT NOT NULL DEFAULT 'password',
    auth_metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE connections (
    name TEXT PRIMARY KEY,
    host TEXT,
    port INTEGER,
    ssh_security TEXT,
    device_profile TEXT,
    template_dir TEXT,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    labels_json TEXT NOT NULL DEFAULT '[]',
    vars_json TEXT NOT NULL DEFAULT '{}',
    linux_shell_flavor TEXT,
    connect_timeout_secs INTEGER,
    device_model TEXT,
    software_version TEXT,
    credential_id TEXT REFERENCES device_credentials(id),
    output_encoding TEXT NOT NULL DEFAULT 'utf8'
        CHECK(output_encoding IN ('utf8', 'gb2312', 'gbk', 'gb18030'))
);

CREATE TABLE history_entries (
    id TEXT PRIMARY KEY,
    ts_ms INTEGER NOT NULL,
    connection_key TEXT NOT NULL,
    connection_name TEXT,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT NOT NULL,
    device_profile TEXT NOT NULL,
    operation TEXT NOT NULL,
    command_label TEXT NOT NULL,
    mode TEXT,
    record_level TEXT NOT NULL,
    record_path TEXT NOT NULL,
    record_jsonl TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_history_connection_key_ts
ON history_entries(connection_key, ts_ms DESC);

CREATE TABLE blacklist_patterns (
    pattern TEXT PRIMARY KEY,
    normalized_pattern TEXT NOT NULL UNIQUE,
    created_at_ms INTEGER NOT NULL
);

CREATE TABLE custom_profiles (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE command_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE interactive_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE task_runs (
    task_id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    status TEXT NOT NULL,
    outcome TEXT,
    summary TEXT NOT NULL,
    success INTEGER NOT NULL,
    agent_name TEXT,
    source TEXT,
    target_label TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    execution_time_ms INTEGER,
    has_recording INTEGER NOT NULL DEFAULT 0,
    has_error INTEGER NOT NULL DEFAULT 0,
    result_summary_json TEXT,
    result_json TEXT,
    error_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_task_runs_status_started_at
ON task_runs(status, started_at DESC);

CREATE INDEX idx_task_runs_operation_started_at
ON task_runs(operation, started_at DESC);

CREATE TABLE task_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    operation TEXT NOT NULL,
    event_type TEXT NOT NULL,
    level TEXT NOT NULL,
    stage TEXT,
    message TEXT NOT NULL,
    progress INTEGER,
    details_json TEXT,
    occurred_at TEXT NOT NULL
);

CREATE INDEX idx_task_events_task_seq
ON task_events(task_id, seq ASC);

CREATE TABLE task_artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    name TEXT NOT NULL,
    storage_ref TEXT,
    content_type TEXT,
    size_bytes INTEGER,
    content_text TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_task_artifacts_task_created_at
ON task_artifacts(task_id, created_at ASC);

CREATE TABLE inventory_groups (
    name TEXT PRIMARY KEY,
    description TEXT,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE inventory_group_vars (
    group_name TEXT PRIMARY KEY,
    vars_json TEXT NOT NULL DEFAULT '{}',
    updated_at_ms INTEGER NOT NULL,
    FOREIGN KEY(group_name) REFERENCES inventory_groups(name) ON DELETE CASCADE
);

CREATE TABLE inventory_group_members (
    group_name TEXT NOT NULL,
    connection_name TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    PRIMARY KEY(group_name, connection_name),
    FOREIGN KEY(group_name) REFERENCES inventory_groups(name) ON DELETE CASCADE,
    FOREIGN KEY(connection_name) REFERENCES connections(name) ON DELETE CASCADE
);

CREATE INDEX idx_inventory_group_members_connection
ON inventory_group_members(connection_name);

CREATE TABLE tx_block_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE tx_workflow_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE orchestration_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE autodetect_profile_cache (
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    device_profile TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    PRIMARY KEY (host, port)
);

CREATE TABLE custom_textfsm_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE custom_textfsm_mappings (
    device_profile TEXT NOT NULL,
    command TEXT NOT NULL,
    template_name TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    PRIMARY KEY (device_profile, command),
    FOREIGN KEY (template_name)
        REFERENCES custom_textfsm_templates(name)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX idx_custom_textfsm_mappings_template_name
    ON custom_textfsm_mappings(template_name);

CREATE TABLE custom_show_objects (
    device_profile TEXT NOT NULL,
    object TEXT NOT NULL,
    command TEXT NOT NULL,
    mode TEXT,
    textfsm_mapping_command TEXT,
    textfsm_template_name TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    PRIMARY KEY (device_profile, object),
    FOREIGN KEY (textfsm_template_name)
        REFERENCES custom_textfsm_templates(name)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    FOREIGN KEY (device_profile, textfsm_mapping_command)
        REFERENCES custom_textfsm_mappings(device_profile, command)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_custom_show_objects_profile_enabled
    ON custom_show_objects(device_profile, enabled);

CREATE INDEX idx_connections_credential_id
ON connections(credential_id);

CREATE TABLE config_command_overrides (
    device_profile TEXT NOT NULL,
    kind TEXT NOT NULL,
    command TEXT NOT NULL,
    mode TEXT,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    PRIMARY KEY (device_profile, kind)
);

CREATE TABLE config_volatile_patterns (
    device_profile TEXT NOT NULL,
    pattern TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    PRIMARY KEY (device_profile, pattern)
);

CREATE TABLE device_discovery_runs (
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

CREATE INDEX idx_device_discovery_runs_created_at
ON device_discovery_runs(created_at_ms DESC);

CREATE TABLE device_discovery_results (
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

CREATE INDEX idx_device_discovery_results_run_status
ON device_discovery_results(run_id, status, host, port);

CREATE TABLE device_discovery_lease (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    run_id TEXT NOT NULL,
    heartbeat_at_ms INTEGER NOT NULL,
    FOREIGN KEY(run_id) REFERENCES device_discovery_runs(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_device_discovery_lease_run
ON device_discovery_lease(run_id);

CREATE TABLE schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    cron_expression TEXT NOT NULL,
    timezone TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_payload_json TEXT NOT NULL,
    payload_version INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    overlap_policy TEXT NOT NULL DEFAULT 'skip',
    misfire_policy TEXT NOT NULL DEFAULT 'fire_once',
    max_runtime_seconds INTEGER NOT NULL DEFAULT 3600,
    next_run_at_ms INTEGER,
    last_run_at_ms INTEGER,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE INDEX idx_schedules_due
ON schedules(enabled, next_run_at_ms);

CREATE TABLE schedule_runs (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    task_id TEXT UNIQUE,
    trigger_type TEXT NOT NULL,
    scheduled_for_ms INTEGER NOT NULL,
    status TEXT NOT NULL,
    skip_reason TEXT,
    error TEXT,
    started_at_ms INTEGER,
    completed_at_ms INTEGER,
    lease_owner TEXT,
    lease_until_ms INTEGER,
    created_at_ms INTEGER NOT NULL,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    UNIQUE(schedule_id, scheduled_for_ms)
);

CREATE INDEX idx_schedule_runs_pending
ON schedule_runs(status, lease_until_ms, created_at_ms);

CREATE INDEX idx_schedule_runs_schedule_created
ON schedule_runs(schedule_id, created_at_ms DESC);

CREATE TABLE device_config_contents (
    id TEXT PRIMARY KEY,
    connection_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    content_size_bytes INTEGER NOT NULL,
    UNIQUE (connection_name, kind, sha256)
);

CREATE TABLE device_config_snapshots (
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

CREATE INDEX idx_device_config_snapshots_connection_kind_fetched
ON device_config_snapshots(connection_name, kind, fetched_at_ms DESC);

CREATE INDEX idx_device_config_snapshots_fetched
ON device_config_snapshots(fetched_at_ms DESC);

CREATE INDEX idx_device_config_snapshots_task
ON device_config_snapshots(task_id);
