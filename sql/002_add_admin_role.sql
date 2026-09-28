-- Run once on an existing Skinventory Postgres database before inviting an admin.
ALTER TABLE crm_users
  DROP CONSTRAINT IF EXISTS crm_users_role_check,
  ADD CONSTRAINT crm_users_role_check
  CHECK (role IN ('owner','admin','sales','inventory','viewer'));
