CREATE TABLE IF NOT EXISTS custom_textfsm_templates (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_textfsm_mappings (
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

CREATE INDEX IF NOT EXISTS idx_custom_textfsm_mappings_template_name
    ON custom_textfsm_mappings(template_name);
