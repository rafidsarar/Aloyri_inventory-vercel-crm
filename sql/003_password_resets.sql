CREATE TABLE IF NOT EXISTS crm_password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS crm_password_resets_user ON crm_password_resets(user_id);
