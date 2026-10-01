import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflows=readFileSync(new URL('../db/order-workflows.ts',import.meta.url),'utf8');
const crm=readFileSync(new URL('../app/crm.tsx',import.meta.url),'utf8');
const collectionRoute=readFileSync(new URL('../app/api/orders/[id]/collection/route.ts',import.meta.url),'utf8');
const inspectionRoute=readFileSync(new URL('../app/api/orders/[id]/inspection/route.ts',import.meta.url),'utf8');
const bulkRoute=readFileSync(new URL('../app/api/orders/bulk-advance/route.ts',import.meta.url),'utf8');
const combinedRoute=readFileSync(new URL('../app/api/orders/with-customer/route.ts',import.meta.url),'utf8');

test('Step 5A collection workflow enforces finance role and balance safety',()=>{
  assert.match(workflows,/FINANCE_FORBIDDEN/);
  assert.match(workflows,/Collection cannot exceed the outstanding order balance/);
  assert.match(workflows,/accountOpenings/);
  assert.match(workflows,/order-collection-/);
  assert.match(collectionRoute,/ORDER_VERSION_CONFLICT/);
});

test('Step 5B return inspection workflow protects stock and role access',()=>{
  assert.match(workflows,/RETURN_INSPECTION_FORBIDDEN/);
  assert.match(workflows,/Returned stock cannot be held safely/);
  assert.match(workflows,/inventoryHolds\.push/);
  assert.match(workflows,/source:'Return'/);
  assert.match(inspectionRoute,/Choose a valid inspection outcome/);
});

test('Step 5C bulk workflow uses per-order versions and partial results',()=>{
  assert.match(workflows,/results:\{id:string;ok:boolean/);
  assert.match(workflows,/Order changed in another window/);
  assert.match(workflows,/No safe next fulfillment step/);
  assert.match(workflows,/applyDeliveryFollowUps/);
  assert.match(bulkRoute,/bulkAdvanceOrdersWorkflow/);
});

test('Step 5D combined new customer and order workflow is atomic',()=>{
  assert.match(workflows,/createOrderWithCustomerWorkflow/);
  assert.match(workflows,/crm_rel_customers/);
  assert.match(workflows,/crm_rel_orders/);
  assert.match(workflows,/UPDATE crm_workspaces SET data=\?,version=version\+1/);
  assert.match(workflows,/db\.batch\(statements\)/);
  assert.match(combinedRoute,/createOrderWithCustomerWorkflow/);
});

test('mixed workflow commits update relational orders and workspace in one batch',()=>{
  assert.match(workflows,/orderReplaceStatements/);
  assert.match(workflows,/record_version=record_version\+1/);
  assert.match(workflows,/crm_rel_order_items/);
  assert.match(workflows,/crm_rel_order_allocations/);
  assert.match(workflows,/crm_rel_order_collections/);
  assert.match(workflows,/crm_relational_migrations/);
  assert.match(workflows,/crm_audit_log/);
});

test('frontend collection uses transaction endpoint instead of generic workspace save',()=>{
  const start=crm.indexOf('async function submitPayment(){');
  const end=crm.indexOf('function reverseCashEntry',start);
  const block=crm.slice(start,end);
  assert.match(block,/\/collection/);
  assert.match(block,/paymentDialog\.kind==='collection'/);
  assert.match(block,/if\(paymentDialog\.kind==='collection'\)[\s\S]*return;/);
});

test('frontend return inspection uses transaction endpoint',()=>{
  const start=crm.indexOf('async function inspectReturnedOrder');
  const end=crm.indexOf('function changeStatus',start);
  const block=crm.slice(start,end);
  assert.match(block,/\/inspection/);
  assert.doesNotMatch(block,/await save\(next\)/);
});

test('frontend bulk fulfillment uses bulk transaction API',()=>{
  const start=crm.indexOf('async function bulkAdvanceSelectedOrders');
  const end=crm.indexOf('async function bulkCreateCustomerFollowUps',start);
  const block=crm.slice(start,end);
  assert.match(block,/\/api\/orders\/bulk-advance/);
  assert.doesNotMatch(block,/save\(next\)/);
});

test('record-aware form routes combined customer and order creation to dedicated API',()=>{
  assert.match(crm,/function newCustomerOrderMutation/);
  assert.match(crm,/\/api\/orders\/with-customer/);
  assert.match(crm,/if\(newCustomerOrderMutation\(next\)\)return saveNewCustomerOrder\(next\)/);
});
