-- Finance Manager role support for existing databases.
ALTER TABLE crm_users DROP CONSTRAINT IF EXISTS crm_users_role_check;
-- statement-break
ALTER TABLE crm_users
  ADD CONSTRAINT crm_users_role_check
  CHECK (role IN ('owner','admin','sales','inventory','finance','viewer'));
