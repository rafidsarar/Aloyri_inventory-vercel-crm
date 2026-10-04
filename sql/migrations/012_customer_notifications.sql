-- Durable customer notification contacts and outbox for Website orders.
CREATE TABLE IF NOT EXISTS crm_ecommerce_order_contacts (
  owner_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, order_id)
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_ecommerce_order_contacts_email_idx
  ON crm_ecommerce_order_contacts(owner_id, email);
-- statement-break
CREATE TABLE IF NOT EXISTS crm_customer_notification_outbox (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  order_status TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error TEXT NOT NULL DEFAULT '',
  provider_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT,
  UNIQUE (owner_id, order_id, event_key, channel)
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_customer_notification_due_idx
  ON crm_customer_notification_outbox(state, next_attempt_at, created_at);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_customer_notification_order_idx
  ON crm_customer_notification_outbox(owner_id, order_id, created_at DESC);
