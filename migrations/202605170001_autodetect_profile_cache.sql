CREATE TABLE IF NOT EXISTS autodetect_profile_cache (
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    device_profile TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    PRIMARY KEY (host, port)
);
