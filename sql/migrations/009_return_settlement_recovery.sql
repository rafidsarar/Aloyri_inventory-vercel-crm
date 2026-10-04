CREATE TABLE IF NOT EXISTS crm_rel_return_records(owner_id TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(owner_id,kind,id));
-- statement-break
CREATE TABLE IF NOT EXISTS crm_recovery_codes(user_id TEXT NOT NULL,token_hash TEXT NOT NULL PRIMARY KEY,created_at TEXT NOT NULL);
-- statement-break
CREATE TABLE IF NOT EXISTS crm_automatic_backups(owner_id TEXT NOT NULL,day DATE NOT NULL,data TEXT NOT NULL,checksum TEXT NOT NULL,workspace_version INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(owner_id,day));
