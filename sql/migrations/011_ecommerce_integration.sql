-- Dedicated machine-to-machine state for the Aloyri storefront integration.
-- This is additive: existing CRM users, sessions and employee APIs are unchanged.
CREATE TABLE IF NOT EXISTS crm_ecommerce_nonces (
  integration_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (integration_id, nonce)
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_ecommerce_nonces_expiry_idx
  ON crm_ecommerce_nonces(expires_at);
-- statement-break
CREATE TABLE IF NOT EXISTS crm_ecommerce_requests (
  owner_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  external_order_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  crm_order_id TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, integration_id, idempotency_key),
  UNIQUE (owner_id, integration_id, external_order_id)
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_ecommerce_requests_created_idx
  ON crm_ecommerce_requests(owner_id, integration_id, created_at DESC);
