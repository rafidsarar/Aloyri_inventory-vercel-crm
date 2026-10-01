import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orderSchema, initialState, today, nextStatuses } from '../lib/crm.ts';
import { roleCanEdit, roleCanViewSection } from '../lib/roles.ts';
import { validateWorkspaceChange } from '../lib/role-data.ts';

const persistence=readFileSync(new URL('../db/order-records.ts',import.meta.url),'utf8');
const listRoute=readFileSync(new URL('../app/api/orders/route.ts',import.meta.url),'utf8');
const detailRoute=readFileSync(new URL('../app/api/orders/[id]/route.ts',import.meta.url),'utf8');

const sampleOrder=()=>({
  id:'o1',number:'ALO-1',customerId:'c1',created:today(),collections:[],
  channel:'Website' as const,payment:'COD' as const,status:'New' as const,
  items:[{productId:'p1',qty:1,price:1000,allocations:[{batchId:'b1',qty:1,unitCost:400}]}],
  discount:0,deliveryCharge:80,courierCost:0,packaging:0,paymentFee:0,returnFee:0,
  settled:false,restocked:false,tracking:'',notes:''
});

test('order record API validates the existing CRM order shape',()=>{
  const order=orderSchema.parse(sampleOrder());
  assert.equal(order.id,'o1');
  assert.throws(()=>orderSchema.parse({...order,items:[]}));
});

test('order API access follows existing order role boundaries',()=>{
  for(const role of ['owner','admin','sales'] as const)assert.equal(roleCanEdit(role,'orders'),true);
  for(const role of ['inventory','viewer'] as const)assert.equal(roleCanEdit(role,'orders'),false);
  for(const role of ['owner','admin','sales','viewer'] as const)assert.equal(roleCanViewSection(role,'Orders'),true);
});

test('order updates use per-record optimistic version checks',()=>{
  assert.match(persistence,/record_version=record_version\+1/);
  assert.match(persistence,/WHERE owner_id=\? AND id=\? AND record_version=\?/);
  assert.match(persistence,/ORDER_VERSION_CONFLICT/);
  assert.ok(detailRoute.includes('409'));
});

test('order writes update parent children and JSON compatibility state atomically',()=>{
  assert.match(persistence,/db\.batch\(/);
  assert.match(persistence,/crm_rel_orders/);
  assert.match(persistence,/crm_rel_order_items/);
  assert.match(persistence,/crm_rel_order_allocations/);
  assert.match(persistence,/crm_rel_order_collections/);
  assert.match(persistence,/UPDATE crm_workspaces SET data=\?,version=version\+1/);
  assert.match(persistence,/crm_relational_migrations/);
  assert.match(persistence,/crm_audit_log/);
});

test('order record path reuses role merge cancellation delivery and transition protections',()=>{
  assert.match(persistence,/applyRoleChanges/);
  assert.match(persistence,/applyCancellationQuarantine/);
  assert.match(persistence,/applyDeliveryFollowUps/);
  assert.match(persistence,/validateWorkspaceChange/);
  assert.match(persistence,/nextStatuses/);
});

test('legacy duplicate numbers remain untouched while new collisions are rejected',()=>{
  const state=initialState();
  state.products=[{id:'p1',brand:'T',name:'P',size:'1',category:'Other',price:1000,cost:400,targetQty:1,reorderAt:0,active:true}];
  state.productCategories=['Other'];
  state.customers=[{id:'c1',name:'C',phone:'',address:'',city:'',preference:'',notes:'',consent:false,created:today()}];
  state.batches=[{id:'b1',productId:'p1',qty:10,unitCost:400,expiry:'2099-12-31',received:today(),supplierId:'',invoice:'',payments:[],paid:false}];
  const first=sampleOrder(),second={...sampleOrder(),id:'o2',number:'ALO-1'};
  state.orders=[first,second];
  assert.doesNotThrow(()=>validateWorkspaceChange(state,structuredClone(state)));
  const changed=structuredClone(state);
  changed.orders.push({...sampleOrder(),id:'o3',number:'ALO-1'});
  assert.throws(()=>validateWorkspaceChange(state,changed),/unique/);
});

test('order status transition helper rejects skipping workflow stages',()=>{
  const order=orderSchema.parse(sampleOrder());
  assert.deepEqual(nextStatuses(order),['Confirmed','Cancelled']);
  assert.equal(nextStatuses(order).includes('Delivered'),false);
});

test('mutation routes require origin checks and order edit permission',()=>{
  assert.match(listRoute,/checkOrigin\(request\)/);
  assert.match(listRoute,/roleCanEdit\(role,'orders'\)/);
  assert.match(detailRoute,/checkOrigin\(request\)/);
  assert.match(detailRoute,/roleCanEdit\(role,'orders'\)/);
  assert.match(persistence,/Sales staff cannot delete existing orders/);
});
