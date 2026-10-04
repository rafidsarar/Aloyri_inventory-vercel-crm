-- Existing deployments already have relational tables. Fresh deployments
-- create these indexes with the relational foundation after migrations.
DO $$
BEGIN
 IF to_regclass('crm_rel_orders') IS NOT NULL THEN
  CREATE INDEX IF NOT EXISTS crm_orders_owner_customer_queue_idx ON crm_rel_orders(owner_id,customer_id,status,created,id);
  CREATE INDEX IF NOT EXISTS crm_orders_owner_status_queue_idx ON crm_rel_orders(owner_id,status,created,number,id);
 END IF;
END $$;
