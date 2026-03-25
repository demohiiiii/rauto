CREATE TABLE IF NOT EXISTS connections (
    name TEXT PRIMARY KEY,
    host TEXT,
    username TEXT,
    password_encrypted TEXT,
    port INTEGER,
    enable_password_encrypted TEXT,
    ssh_security TEXT,
    device_profile TEXT,
    template_dir TEXT,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS history_entries (
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

CREATE INDEX IF NOT EXISTS idx_history_connection_key_ts
ON history_entries(connection_key, ts_ms DESC);

CREATE TABLE IF NOT EXISTS blacklist_patterns (
    pattern TEXT PRIMARY KEY,
    normalized_pattern TEXT NOT NULL UNIQUE,
    created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_profiles (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS command_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);
