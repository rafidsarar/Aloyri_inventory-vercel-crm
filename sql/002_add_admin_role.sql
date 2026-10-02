-- Legacy compatibility migration. New deployments use sql/migrations via pnpm db:migrate.
-- Kept safe for older installations that still reference this file.
ALTER TABLE crm_users
  DROP CONSTRAINT IF EXISTS crm_users_role_check,
  ADD CONSTRAINT crm_users_role_check
  CHECK (role IN ('owner','admin','sales','inventory','finance','viewer'));
