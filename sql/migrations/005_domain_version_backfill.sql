-- Backfill relational domain version rows for workspaces created before domain-version tracking.
CREATE TABLE IF NOT EXISTS crm_domain_versions (
  owner_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,domain)
);
-- statement-break
INSERT INTO crm_domain_versions (owner_id,domain,version,updated_at)
SELECT w.owner_id,d.domain,0,now()::text
FROM crm_workspaces w
CROSS JOIN (VALUES ('customers-orders'),('inventory-suppliers'),('finances')) AS d(domain)
ON CONFLICT(owner_id,domain) DO NOTHING;
