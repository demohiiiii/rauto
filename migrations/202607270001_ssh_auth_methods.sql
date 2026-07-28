ALTER TABLE device_credentials
ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'password';

ALTER TABLE device_credentials
ADD COLUMN auth_metadata_json TEXT NOT NULL DEFAULT '{}';
