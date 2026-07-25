CREATE TABLE IF NOT EXISTS device_credentials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password_ref TEXT NOT NULL,
    enable_password_ref TEXT,
    enable_password_empty_enter INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

ALTER TABLE connections ADD COLUMN credential_id TEXT REFERENCES device_credentials(id);

CREATE INDEX IF NOT EXISTS idx_connections_credential_id
ON connections(credential_id);

ALTER TABLE connections DROP COLUMN username;
ALTER TABLE connections DROP COLUMN password_ref;
ALTER TABLE connections DROP COLUMN enable_password_ref;
ALTER TABLE connections DROP COLUMN enable_password_empty_enter;
