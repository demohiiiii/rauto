ALTER TABLE connections ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE connections ADD COLUMN labels_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE connections ADD COLUMN vars_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS inventory_groups (
    name TEXT PRIMARY KEY,
    description TEXT,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_group_vars (
    group_name TEXT PRIMARY KEY,
    vars_json TEXT NOT NULL DEFAULT '{}',
    updated_at_ms INTEGER NOT NULL,
    FOREIGN KEY(group_name) REFERENCES inventory_groups(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_group_members (
    group_name TEXT NOT NULL,
    connection_name TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    PRIMARY KEY(group_name, connection_name),
    FOREIGN KEY(group_name) REFERENCES inventory_groups(name) ON DELETE CASCADE,
    FOREIGN KEY(connection_name) REFERENCES connections(name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inventory_group_members_connection
ON inventory_group_members(connection_name);
