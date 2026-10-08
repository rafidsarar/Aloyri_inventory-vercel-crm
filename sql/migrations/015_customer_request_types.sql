ALTER TABLE crm_ecommerce_return_requests ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'return';
-- statement-break
ALTER TABLE crm_ecommerce_return_requests DROP CONSTRAINT IF EXISTS crm_ecommerce_return_requests_owner_id_order_id_key;
-- statement-break
CREATE UNIQUE INDEX IF NOT EXISTS crm_ecommerce_return_requests_owner_order_type_idx ON crm_ecommerce_return_requests(owner_id,order_id,request_type);
