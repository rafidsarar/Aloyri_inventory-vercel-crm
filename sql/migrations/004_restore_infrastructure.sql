-- Restore and audit infrastructure is deployment-managed, not request-created.
CREATE TABLE IF NOT EXISTS crm_restore_snapshots (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  workspace_version INTEGER NOT NULL,
  workspace_updated_at TEXT NOT NULL,
  checksum TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_restore_snapshots_owner_created_idx
  ON crm_restore_snapshots(owner_id,created_at DESC);
-- statement-break
CREATE TABLE IF NOT EXISTS crm_audit_log (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  role TEXT NOT NULL,
  summary TEXT NOT NULL,
  sections TEXT NOT NULL,
  created_at TEXT NOT NULL
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_audit_owner_created_idx
  ON crm_audit_log(owner_id,created_at DESC);
