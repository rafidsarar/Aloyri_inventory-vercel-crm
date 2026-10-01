import test from 'node:test';
import assert from 'node:assert/strict';
import { relationalFoundationSql } from '../db/relational-foundation.ts';

const schema=relationalFoundationSql.join('\n');

test('Stage 3 relational foundation creates isolated customer and order tables',()=>{
  for(const table of [
    'crm_relational_migrations',
    'crm_rel_customers',
    'crm_rel_orders',
    'crm_rel_order_items',
    'crm_rel_order_allocations',
    'crm_rel_order_collections'
  ]) assert.match(schema,new RegExp('CREATE TABLE IF NOT EXISTS '+table));
});

test('Stage 3 relational foundation stays separate from the live JSON workspace',()=>{
  assert.doesNotMatch(schema,/\b(?:UPDATE|DELETE FROM|INSERT INTO)\s+crm_workspaces\b/i);
  assert.doesNotMatch(schema,/DROP\s+TABLE/i);
  assert.doesNotMatch(schema,/ALTER\s+TABLE\s+crm_workspaces/i);
});

test('customer and order records are tenant-scoped by owner',()=>{
  assert.match(schema,/PRIMARY KEY \(owner_id, id\)/);
  assert.match(schema,/FOREIGN KEY \(owner_id, customer_id\)/);
  assert.match(schema,/crm_rel_orders\(owner_id, customer_id\)/);
});

test('legacy duplicate order numbers remain migratable during the verification phase',()=>{
  assert.match(schema,/CREATE INDEX IF NOT EXISTS crm_rel_orders_owner_number_idx/);
  assert.doesNotMatch(schema,/CREATE UNIQUE INDEX IF NOT EXISTS crm_rel_orders_owner_number_idx/);
});

test('order child records cascade only inside the relational shadow tables',()=>{
  assert.match(schema,/REFERENCES crm_rel_orders\(owner_id, id\)[\s\S]*ON DELETE CASCADE/);
  assert.match(schema,/REFERENCES crm_rel_order_items\(owner_id, order_id, line_no\)[\s\S]*ON DELETE CASCADE/);
});
