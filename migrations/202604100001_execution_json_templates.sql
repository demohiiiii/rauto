CREATE TABLE IF NOT EXISTS tx_block_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tx_workflow_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orchestration_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);
