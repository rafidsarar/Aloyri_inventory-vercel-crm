-- Track production data-canonicalization runs used by deployment certification.
CREATE TABLE IF NOT EXISTS crm_data_integrity_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  workspace_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('clean','normalized','failed')),
  changed_paths INTEGER NOT NULL DEFAULT 0,
  before_checksum TEXT,
  after_checksum TEXT,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_data_integrity_owner_created_idx
  ON crm_data_integrity_events(owner_id,created_at DESC);
