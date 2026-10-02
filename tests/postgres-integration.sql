\set ON_ERROR_STOP on

DO $$
DECLARE definition text;
DECLARE legacy jsonb;
BEGIN
  SELECT pg_get_constraintdef(oid)
    INTO definition
    FROM pg_constraint
   WHERE conrelid='crm_users'::regclass
     AND conname='crm_users_role_check';

  IF definition IS NULL OR position('finance' in lower(definition))=0 THEN
    RAISE EXCEPTION 'crm_users_role_check does not allow finance';
  END IF;

  SELECT data::jsonb INTO legacy FROM crm_workspaces WHERE owner_id='legacy-date-owner';
  IF legacy #>> '{customers,0,created}' <> '2026-09-30'
     OR legacy #>> '{purchaseOrders,0,created}' <> '2026-09-28'
     OR legacy #>> '{purchaseOrders,0,expected}' <> '2026-10-05'
     OR legacy #>> '{batches,0,expiry}' <> '2027-10-01'
     OR legacy #>> '{batches,0,received}' <> '2026-09-29'
     OR legacy #>> '{batches,0,dueDate}' <> '2026-10-29'
     OR legacy #>> '{batches,0,payments,0,date}' <> '2026-09-30'
     OR legacy #>> '{inventoryHolds,0,date}' <> '2026-10-01'
     OR legacy #>> '{orders,0,created}' <> '2026-09-30'
     OR legacy #>> '{orders,0,collections,0,date}' <> '2026-10-01'
     OR legacy #>> '{accountOpenings,0,date}' <> '2026-01-01'
     OR legacy #>> '{financeCloses,0,closedAt}' <> '2026-09-30'
     OR legacy #>> '{tasks,0,due}' <> '2026-10-02' THEN
    RAISE EXCEPTION 'legacy date canonicalization failed';
  END IF;
  IF (legacy #> '{batches,0}') ? 'paidAt'
     OR (legacy #> '{inventoryHolds,0}') ? 'releasedAt'
     OR (legacy #> '{orders,0}') ? 'delivered'
     OR (legacy #> '{accountOpenings,0}') ? 'statementDate'
     OR (legacy #> '{tasks,0}') ? 'completedAt' THEN
    RAISE EXCEPTION 'blank optional legacy dates were not removed';
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
     OR to_regclass('public.crm_backup_events') IS NULL
     OR to_regclass('public.crm_data_integrity_certifications') IS NULL THEN
    RAISE EXCEPTION 'security/recovery/data integrity metadata tables missing';
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
     OR NOT EXISTS (SELECT 1 FROM crm_schema_migrations WHERE version='006_session_security_recovery')
     OR NOT EXISTS (SELECT 1 FROM crm_schema_migrations WHERE version='007_legacy_date_canonicalization') THEN
    RAISE EXCEPTION 'required migrations were not recorded';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM crm_data_integrity_certifications
    WHERE owner_id='legacy-date-owner'
      AND migration_version='007_legacy_date_canonicalization'
      AND result='canonicalized'
      AND workspace_version=41
  ) THEN
    RAISE EXCEPTION 'legacy workspace data-integrity certification missing';
  END IF;
  IF (SELECT COUNT(*) FROM crm_domain_versions WHERE owner_id='legacy-owner') <> 3 THEN
    RAISE EXCEPTION 'legacy workspace domain versions were not backfilled';
  END IF;
END $$;

DELETE FROM crm_users WHERE owner_id='owner-test';
DELETE FROM crm_domain_versions WHERE owner_id='legacy-owner';
DELETE FROM crm_data_integrity_certifications WHERE owner_id='legacy-date-owner';
DELETE FROM crm_workspaces WHERE owner_id IN ('legacy-owner','legacy-date-owner');
