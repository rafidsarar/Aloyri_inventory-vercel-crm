import { database } from './raw.ts';

export const relationalFoundationSql = [
  `CREATE TABLE IF NOT EXISTS crm_rel_return_records(owner_id TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(owner_id,kind,id))`,
  `CREATE TABLE IF NOT EXISTS crm_rel_finance_customer_refunds (
 owner_id TEXT NOT NULL, id TEXT NOT NULL, order_id TEXT NOT NULL,
 date DATE NOT NULL, amount NUMERIC NOT NULL CHECK (amount > 0),
 account TEXT NOT NULL CHECK (account IN ('cash','bank','bkash','nagad')),
 reference TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY (owner_id,id)
)`,
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
  `CREATE INDEX IF NOT EXISTS crm_rel_orders_owner_number_idx
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
    ON crm_rel_order_collections(owner_id, date DESC)`,
  `CREATE TABLE IF NOT EXISTS crm_rel_product_categories (
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    record_version INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, name)
  )`,
  `CREATE TABLE IF NOT EXISTS crm_rel_products (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    size TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    cost NUMERIC NOT NULL DEFAULT 0,
    target_qty INTEGER NOT NULL DEFAULT 0,
    reorder_at INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    record_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_products_owner_category_idx ON crm_rel_products(owner_id, category)`,
  `CREATE TABLE IF NOT EXISTS crm_rel_suppliers (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    contact TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    lead_days INTEGER NOT NULL DEFAULT 14,
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    notes TEXT NOT NULL DEFAULT '',
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    record_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_suppliers_owner_name_idx ON crm_rel_suppliers(owner_id, lower(name))`,
  `CREATE TABLE IF NOT EXISTS crm_rel_purchase_orders (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    number TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    created DATE NOT NULL,
    expected DATE NOT NULL,
    status TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    record_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id, supplier_id) REFERENCES crm_rel_suppliers(owner_id, id) DEFERRABLE INITIALLY DEFERRED
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_purchase_orders_owner_supplier_idx ON crm_rel_purchase_orders(owner_id, supplier_id)`,
  `CREATE INDEX IF NOT EXISTS crm_rel_purchase_orders_owner_number_idx ON crm_rel_purchase_orders(owner_id, lower(number))`,
  `CREATE TABLE IF NOT EXISTS crm_rel_purchase_order_items (
    owner_id TEXT NOT NULL,
    purchase_order_id TEXT NOT NULL,
    line_no INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    qty INTEGER NOT NULL,
    unit_cost NUMERIC NOT NULL,
    received_qty INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (owner_id, purchase_order_id, line_no),
    FOREIGN KEY (owner_id, purchase_order_id) REFERENCES crm_rel_purchase_orders(owner_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
  )`,
  `CREATE TABLE IF NOT EXISTS crm_rel_batches (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    qty INTEGER NOT NULL,
    unit_cost NUMERIC NOT NULL,
    expiry DATE NOT NULL,
    received DATE NOT NULL,
    supplier_id TEXT NOT NULL DEFAULT '',
    invoice TEXT NOT NULL DEFAULT '',
    due_date DATE,
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at DATE,
    record_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_batches_owner_product_idx ON crm_rel_batches(owner_id, product_id)`,
  `CREATE INDEX IF NOT EXISTS crm_rel_batches_owner_supplier_idx ON crm_rel_batches(owner_id, supplier_id)`,
  `CREATE TABLE IF NOT EXISTS crm_rel_batch_payments (
    owner_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    id TEXT NOT NULL,
    date DATE NOT NULL,
    amount NUMERIC NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (owner_id, batch_id, id),
    FOREIGN KEY (owner_id, batch_id) REFERENCES crm_rel_batches(owner_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
  )`,
  `CREATE TABLE IF NOT EXISTS crm_rel_stock_adjustments (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    delta INTEGER NOT NULL,
    date DATE NOT NULL,
    reason TEXT NOT NULL,
    record_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_stock_adjustments_owner_batch_idx ON crm_rel_stock_adjustments(owner_id, batch_id)`,
  `CREATE TABLE IF NOT EXISTS crm_rel_inventory_holds (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    qty INTEGER NOT NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL,
    reason TEXT NOT NULL,
    source TEXT NOT NULL,
    source_order_id TEXT,
    released_at DATE,
    record_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_inventory_holds_owner_batch_idx ON crm_rel_inventory_holds(owner_id, batch_id)`,
  `CREATE INDEX IF NOT EXISTS crm_rel_inventory_holds_owner_source_order_idx ON crm_rel_inventory_holds(owner_id, source_order_id)`,
  `CREATE TABLE IF NOT EXISTS crm_rel_finance_expenses (
    owner_id TEXT NOT NULL,id TEXT NOT NULL,category TEXT NOT NULL,amount NUMERIC NOT NULL,date DATE NOT NULL,
    notes TEXT NOT NULL DEFAULT '',vendor TEXT NOT NULL DEFAULT '',reference TEXT NOT NULL DEFAULT '',
    recurring TEXT NOT NULL DEFAULT 'none',account TEXT,record_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner_id,id)
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_finance_expenses_owner_date_idx ON crm_rel_finance_expenses(owner_id,date DESC)`,
  `CREATE TABLE IF NOT EXISTS crm_rel_finance_cash_entries (
    owner_id TEXT NOT NULL,id TEXT NOT NULL,date DATE NOT NULL,kind TEXT NOT NULL,category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',amount NUMERIC NOT NULL,transfer_id TEXT,reversal_of TEXT,reversal_reason TEXT,
    record_version INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner_id,id)
  )`,
  `CREATE INDEX IF NOT EXISTS crm_rel_finance_cash_owner_date_idx ON crm_rel_finance_cash_entries(owner_id,date DESC)`,
  `CREATE TABLE IF NOT EXISTS crm_rel_finance_account_openings (
    owner_id TEXT NOT NULL,account TEXT NOT NULL,date DATE NOT NULL,balance NUMERIC NOT NULL,statement_date DATE,
    statement_balance NUMERIC,record_version INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(owner_id,account)
  )`,
  `CREATE TABLE IF NOT EXISTS crm_rel_finance_account_matches (
    owner_id TEXT NOT NULL,entry_id TEXT NOT NULL,account TEXT NOT NULL,matched BOOLEAN NOT NULL DEFAULT FALSE,
    reference TEXT NOT NULL DEFAULT '',record_version INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,
    PRIMARY KEY(owner_id,entry_id)
  )`,
  `CREATE TABLE IF NOT EXISTS crm_rel_finance_closes (
    owner_id TEXT NOT NULL,month TEXT NOT NULL,closed_at DATE NOT NULL,closed_by TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',
    record_version INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(owner_id,month)
  )`,
  `CREATE TABLE IF NOT EXISTS crm_domain_versions (
    owner_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(owner_id,domain)
  )`,
  `CREATE TABLE IF NOT EXISTS crm_relational_cutover (
    owner_id TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    enabled_at TEXT,
    enabled_by TEXT,
    last_verified_at TEXT,
    last_verification TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS crm_orders_owner_customer_queue_idx ON crm_rel_orders(owner_id,customer_id,status,created,id)`,
  `CREATE INDEX IF NOT EXISTS crm_orders_owner_status_queue_idx ON crm_rel_orders(owner_id,status,created,number,id)`,
  `CREATE INDEX IF NOT EXISTS crm_stage4_orders_status_created_idx ON crm_rel_orders(owner_id,status,created DESC)`,
  `CREATE INDEX IF NOT EXISTS crm_stage4_purchase_orders_status_expected_idx ON crm_rel_purchase_orders(owner_id,status,expected)`,
  `CREATE INDEX IF NOT EXISTS crm_stage4_batches_product_expiry_idx ON crm_rel_batches(owner_id,product_id,expiry)`,
  `CREATE INDEX IF NOT EXISTS crm_stage4_domain_versions_updated_idx ON crm_domain_versions(owner_id,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS crm_stage5_orders_customer_status_delivered_idx ON crm_rel_orders(owner_id,customer_id,status,delivered DESC)`,
  `CREATE INDEX IF NOT EXISTS crm_stage5_orders_status_updated_idx ON crm_rel_orders(owner_id,status,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS crm_stage5_purchase_orders_supplier_status_expected_idx ON crm_rel_purchase_orders(owner_id,supplier_id,status,expected)`,
  `CREATE INDEX IF NOT EXISTS crm_stage5_batches_due_paid_idx ON crm_rel_batches(owner_id,due_date,paid)`,
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

