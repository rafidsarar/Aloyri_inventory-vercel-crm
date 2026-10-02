\set ON_ERROR_STOP on

DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_constraintdef(oid)
    INTO definition
    FROM pg_constraint
   WHERE conrelid='crm_users'::regclass
     AND conname='crm_users_role_check';

  IF definition IS NULL OR position('finance' in lower(definition))=0 THEN
    RAISE EXCEPTION 'crm_users_role_check does not allow finance';
  END IF;
END $$;

INSERT INTO crm_users (id,owner_id,email,name,role,created_at)
VALUES
 ('owner-test','owner-test','owner@test.local','Owner','owner',now()::text),
 ('finance-test','owner-test','finance@test.local','Finance','finance',now()::text),
 ('inventory-test','owner-test','inventory@test.local','Inventory','inventory',now()::text);

DO $$
BEGIN
  IF (SELECT count(*) FROM crm_users WHERE owner_id='owner-test') <> 3 THEN
    RAISE EXCEPTION 'role inserts failed';
  END IF;
  IF to_regclass('public.crm_workspaces') IS NULL
     OR to_regclass('public.crm_sessions') IS NULL
     OR to_regclass('public.crm_invites') IS NULL
     OR to_regclass('public.crm_login_attempts') IS NULL THEN
    RAISE EXCEPTION 'baseline auth/workspace tables missing';
  END IF;
  IF to_regclass('public.crm_rel_customers') IS NULL
     OR to_regclass('public.crm_rel_orders') IS NULL
     OR to_regclass('public.crm_rel_products') IS NULL
     OR to_regclass('public.crm_rel_finance_cash_entries') IS NULL
     OR to_regclass('public.crm_domain_versions') IS NULL
     OR to_regclass('public.crm_relational_cutover') IS NULL THEN
    RAISE EXCEPTION 'relational foundation tables missing';
  END IF;
  IF to_regclass('public.crm_restore_snapshots') IS NULL
     OR to_regclass('public.crm_audit_log') IS NULL THEN
    RAISE EXCEPTION 'restore infrastructure missing';
  END IF;
  IF to_regclass('public.crm_security_events') IS NULL
     OR to_regclass('public.crm_backup_events') IS NULL THEN
    RAISE EXCEPTION 'security/recovery metadata tables missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='crm_sessions' AND column_name='user_agent'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='crm_sessions' AND column_name='last_seen_at'
  ) THEN
    RAISE EXCEPTION 'session metadata columns missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM crm_schema_migrations WHERE version='004_restore_infrastructure')
     OR NOT EXISTS (SELECT 1 FROM crm_schema_migrations WHERE version='005_domain_version_backfill')
     OR NOT EXISTS (SELECT 1 FROM crm_schema_migrations WHERE version='006_session_security_recovery') THEN
    RAISE EXCEPTION 'required migrations were not recorded';
  END IF;
  IF (SELECT COUNT(*) FROM crm_domain_versions WHERE owner_id='legacy-owner') <> 3 THEN
    RAISE EXCEPTION 'legacy workspace domain versions were not backfilled';
  END IF;
END $$;

DELETE FROM crm_users WHERE owner_id='owner-test';
DELETE FROM crm_domain_versions WHERE owner_id='legacy-owner';
DELETE FROM crm_workspaces WHERE owner_id='legacy-owner';
