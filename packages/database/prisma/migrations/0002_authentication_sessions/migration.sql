-- IS-15: global Identity authentication fields. Session credentials remain hashes only.
ALTER TABLE users ADD COLUMN password_hash text;
ALTER TABLE users ADD COLUMN is_active boolean NOT NULL DEFAULT true;
-- Existing IS-14 users are fixtures without credentials; deployments must backfill before enabling login.

ALTER TABLE sessions RENAME COLUMN expires_at TO idle_expires_at;
ALTER TABLE sessions ADD COLUMN absolute_expires_at timestamptz(6);
ALTER TABLE sessions ADD COLUMN auth_method text NOT NULL DEFAULT 'PASSWORD';
UPDATE sessions SET last_seen_at = created_at WHERE last_seen_at IS NULL;
ALTER TABLE sessions ALTER COLUMN last_seen_at SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN last_seen_at SET DEFAULT now();

UPDATE sessions SET absolute_expires_at = idle_expires_at WHERE absolute_expires_at IS NULL;
ALTER TABLE sessions ALTER COLUMN absolute_expires_at SET NOT NULL;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_expires_at_idx;
DROP INDEX IF EXISTS sessions_user_expiry_idx;
CREATE INDEX sessions_user_absolute_expiry_idx ON sessions (user_id, absolute_expires_at);
