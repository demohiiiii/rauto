CREATE TABLE IF NOT EXISTS config_volatile_patterns (
    device_profile TEXT NOT NULL,
    pattern TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    PRIMARY KEY (device_profile, pattern)
);
