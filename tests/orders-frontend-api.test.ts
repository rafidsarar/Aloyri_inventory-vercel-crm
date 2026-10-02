import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const crm=readFileSync(new URL('../app/crm.tsx',import.meta.url),'utf8');
const listRoute=readFileSync(new URL('../app/api/orders/route.ts',import.meta.url),'utf8');
const detailRoute=readFileSync(new URL('../app/api/orders/[id]/route.ts',import.meta.url),'utf8');
const persistence=readFileSync(new URL('../db/order-records.ts',import.meta.url),'utf8');

test('Orders frontend loads record-level order data',()=>{
  assert.match(crm,/fetch\('\/api\/orders'/);
  assert.match(crm,/orderRecordVersions/);
  assert.match(crm,/OrderApiRecord/);
});

test('single-order mutations use record APIs with workspace fallback',()=>{
  assert.match(crm,/function orderOnlyMutation/);
  assert.match(crm,/async function saveOrderRecord/);
  assert.match(crm,/if\(!mutation\)return save\(next\)/);
  assert.match(crm,/async function saveRecordAware/);
  assert.match(crm,/onSave=\{saveRecordAware\}/);
});

test('order create update and delete map to expected HTTP methods',()=>{
  assert.match(crm,/mutation\.kind==='create'\?'POST':mutation\.kind==='update'\?'PUT':'DELETE'/);
  assert.match(crm,/recordVersion/);
  assert.match(crm,/encodeURIComponent\(id\)/);
});

test('order conflict handling refreshes the safe workspace state',()=>{
  assert.match(crm,/res\.status===409/);
  assert.match(crm,/This order changed in another window/);
  assert.match(crm,/await loadLive\(false,false\)/);
});

test('direct order status updates use record-level save',()=>{
  assert.match(crm,/async function updateOrder[\s\S]*saveOrderRecord\(next\)/);
  assert.match(crm,/function changeStatus[\s\S]*updateOrder/);
});

test('bulk order and finance collection changes use dedicated APIs',()=>{
  assert.match(crm,/async function bulkAdvanceSelectedOrders[\s\S]*fetch\('\/api\/orders\/bulk-advance'/);
  assert.match(crm,/async function submitPayment\(\)[\s\S]*fetch\('\/api\/orders\/'\+encodeURIComponent\(paymentDialog\.id\)\+'\/collection'/);
  assert.match(crm,/supplier-payment/);
});

test('order APIs return workspace versions for post-mutation resync',()=>{
  assert.match(listRoute,/version:result\.workspaceVersion/);
  assert.match(detailRoute,/version:result\.workspaceVersion/);
  assert.match(persistence,/workspaceVersion:nextWorkspaceVersion/);
});
