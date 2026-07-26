CREATE TABLE IF NOT EXISTS config_command_overrides (
    device_profile TEXT NOT NULL,
    kind TEXT NOT NULL,
    command TEXT NOT NULL,
    mode TEXT,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    PRIMARY KEY (device_profile, kind)
);
