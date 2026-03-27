CREATE TABLE IF NOT EXISTS command_flow_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);
