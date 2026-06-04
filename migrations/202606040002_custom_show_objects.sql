CREATE TABLE IF NOT EXISTS custom_show_objects (
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

CREATE INDEX IF NOT EXISTS idx_custom_show_objects_profile_enabled
    ON custom_show_objects(device_profile, enabled);
