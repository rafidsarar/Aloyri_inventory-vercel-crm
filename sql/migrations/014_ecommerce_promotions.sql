CREATE TABLE IF NOT EXISTS crm_ecommerce_promotions (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  value NUMERIC NOT NULL,
  minimum_subtotal NUMERIC NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  usage_limit INTEGER,
  target_type TEXT NOT NULL DEFAULT 'all',
  target_ids_json TEXT NOT NULL DEFAULT '[]',
  free_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  badge_text TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,id),
  UNIQUE(owner_id,code),
  CHECK(kind IN ('percentage','fixed')),
  CHECK(target_type IN ('all','products','categories')),
  CHECK(value>0),
  CHECK(minimum_subtotal>=0),
  CHECK(usage_limit IS NULL OR usage_limit>0)
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_ecommerce_promotions_owner_active_idx
  ON crm_ecommerce_promotions(owner_id,active,priority DESC,updated_at DESC);
-- statement-break
CREATE TABLE IF NOT EXISTS crm_ecommerce_promotion_redemptions (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  promotion_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  promotion_code TEXT NOT NULL DEFAULT '',
  merchandise_discount NUMERIC NOT NULL DEFAULT 0,
  shipping_discount NUMERIC NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,id),
  UNIQUE(owner_id,order_id)
);
-- statement-break
CREATE INDEX IF NOT EXISTS crm_ecommerce_promo_redemptions_promotion_idx
  ON crm_ecommerce_promotion_redemptions(owner_id,promotion_id,created_at DESC);
