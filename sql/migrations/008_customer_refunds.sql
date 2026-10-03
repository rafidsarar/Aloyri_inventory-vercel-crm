CREATE TABLE IF NOT EXISTS crm_rel_finance_customer_refunds (
 owner_id TEXT NOT NULL, id TEXT NOT NULL, order_id TEXT NOT NULL,
 date DATE NOT NULL, amount NUMERIC NOT NULL CHECK (amount > 0),
 account TEXT NOT NULL CHECK (account IN ('cash','bank','bkash','nagad')),
 reference TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY (owner_id,id)
);
