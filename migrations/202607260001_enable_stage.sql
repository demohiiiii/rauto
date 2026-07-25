ALTER TABLE device_credentials ADD COLUMN enable_enabled INTEGER NOT NULL DEFAULT 0;

UPDATE device_credentials
SET enable_enabled = CASE
    WHEN enable_password_ref IS NOT NULL OR enable_password_empty_enter <> 0 THEN 1
    ELSE 0
END;

ALTER TABLE device_credentials DROP COLUMN enable_password_empty_enter;
