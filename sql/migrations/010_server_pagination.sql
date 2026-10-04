-- Bound customer history and per-workspace fulfillment queries.
CREATE INDEX IF NOT EXISTS crm_orders_owner_customer_queue_idx ON crm_rel_orders(owner_id,customer_id,status,created,id);
CREATE INDEX IF NOT EXISTS crm_orders_owner_status_queue_idx ON crm_rel_orders(owner_id,status,created,number,id);
