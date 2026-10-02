-- Session security, auth-event audit and recovery-readiness metadata.
ALTER TABLE crm_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
-- statement-break
ALTER TABLE crm_sessions ADD COLUMN IF NOT EXISTS last_seen_at TEXT;
-- statement-break
CREATE INDEX IF NOT EXISTS crm_sessions_expires_idx ON crm_sessions(expires_at);
-- statement-break
CREATE TABLE IF NOT EXISTS crm_security_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_security_events_user_created_idx
  ON crm_security_events(user_id,created_at DESC);
-- statement-break
CREATE TABLE IF NOT EXISTS crm_backup_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  checksum TEXT NOT NULL,
  record_counts TEXT NOT NULL,
  relational_parity_ok INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_backup_events_owner_created_idx
  ON crm_backup_events(owner_id,created_at DESC);
