CREATE TABLE IF NOT EXISTS crm_ecommerce_return_requests (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  request_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  condition TEXT NOT NULL,
  preferred_resolution TEXT NOT NULL,
  customer_note TEXT NOT NULL DEFAULT '',
  items_json TEXT NOT NULL,
  staff_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE(owner_id, order_id)
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_ecommerce_return_requests_owner_status_idx
  ON crm_ecommerce_return_requests(owner_id, request_status, created_at DESC);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_ecommerce_return_requests_order_idx
  ON crm_ecommerce_return_requests(owner_id, order_id);
