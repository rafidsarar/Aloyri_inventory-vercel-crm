import { database } from './raw';

export const relationalFoundationSql = [
  `CREATE TABLE IF NOT EXISTS crm_relational_migrations (
    owner_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    source_version INTEGER NOT NULL DEFAULT 0,
    migrated_at TEXT,
    verified_at TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, domain)
  )`,
  `CREATE TABLE IF NOT EXISTS crm_rel_customers (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    preference TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    consent BOOLEAN NOT NULL DEFAULT FALSE,
    created DATE NOT NULL,
    record_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_customers_owner_created_idx
    ON crm_rel_customers(owner_id, created DESC)`,
  `CREATE INDEX IF NOT EXISTS crm_rel_customers_owner_phone_idx
    ON crm_rel_customers(owner_id, phone)`,
  `CREATE TABLE IF NOT EXISTS crm_rel_orders (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    number TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    created DATE NOT NULL,
    delivered DATE,
    returned_at DATE,
    settled_at DATE,
    channel TEXT NOT NULL,
    payment TEXT NOT NULL,
    status TEXT NOT NULL,
    discount NUMERIC NOT NULL DEFAULT 0,
    delivery_charge NUMERIC NOT NULL DEFAULT 0,
    courier_cost NUMERIC NOT NULL DEFAULT 0,
    packaging NUMERIC NOT NULL DEFAULT 0,
    payment_fee NUMERIC NOT NULL DEFAULT 0,
    return_fee NUMERIC NOT NULL DEFAULT 0,
    settled BOOLEAN NOT NULL DEFAULT FALSE,
    restocked BOOLEAN NOT NULL DEFAULT FALSE,
    tracking TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    record_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id, customer_id)
      REFERENCES crm_rel_customers(owner_id, id)
      DEFERRABLE INITIALLY DEFERRED
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS crm_rel_orders_owner_number_idx
    ON crm_rel_orders(owner_id, lower(number))`,
  `CREATE INDEX IF NOT EXISTS crm_rel_orders_owner_customer_idx
    ON crm_rel_orders(owner_id, customer_id)`,
  `CREATE INDEX IF NOT EXISTS crm_rel_orders_owner_status_created_idx
    ON crm_rel_orders(owner_id, status, created DESC)`,
  `CREATE TABLE IF NOT EXISTS crm_rel_order_items (
    owner_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    line_no INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    qty INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    PRIMARY KEY (owner_id, order_id, line_no),
    FOREIGN KEY (owner_id, order_id)
      REFERENCES crm_rel_orders(owner_id, id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_order_items_owner_product_idx
    ON crm_rel_order_items(owner_id, product_id)`,
  `CREATE TABLE IF NOT EXISTS crm_rel_order_allocations (
    owner_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    line_no INTEGER NOT NULL,
    allocation_no INTEGER NOT NULL,
    batch_id TEXT NOT NULL,
    qty INTEGER NOT NULL,
    unit_cost NUMERIC NOT NULL,
    PRIMARY KEY (owner_id, order_id, line_no, allocation_no),
    FOREIGN KEY (owner_id, order_id, line_no)
      REFERENCES crm_rel_order_items(owner_id, order_id, line_no)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_order_allocations_owner_batch_idx
    ON crm_rel_order_allocations(owner_id, batch_id)`,
  `CREATE TABLE IF NOT EXISTS crm_rel_order_collections (
    owner_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    id TEXT NOT NULL,
    date DATE NOT NULL,
    amount NUMERIC NOT NULL,
    reference TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (owner_id, order_id, id),
    FOREIGN KEY (owner_id, order_id)
      REFERENCES crm_rel_orders(owner_id, id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_order_collections_owner_date_idx
    ON crm_rel_order_collections(owner_id, date DESC)`
] as const;

let ready: Promise<void> | null = null;

export function ensureRelationalFoundation(){
  if(!ready){
    ready=(async()=>{
      const db=database();
      await db.batch(relationalFoundationSql.map(sql=>db.prepare(sql)));
    })().catch(error=>{
      ready=null;
      throw error;
    });
  }
  return ready;
}
