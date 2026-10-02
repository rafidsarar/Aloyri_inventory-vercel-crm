import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  accountBalance,allocate,applyCancellationQuarantine,applyDeliveryFollowUps,applyPurchaseOrderReceipt,
  batchRemaining,initialState,stock,today,shiftDate,validateRelations
} from '../lib/crm.ts';

const orderWorkflows=readFileSync(new URL('../db/order-workflows.ts',import.meta.url),'utf8');
const orderRecords=readFileSync(new URL('../db/order-records.ts',import.meta.url),'utf8');
const inventoryWorkflows=readFileSync(new URL('../db/inventory-supplier-workflows.ts',import.meta.url),'utf8');
const inventoryRecords=readFileSync(new URL('../db/inventory-supplier-records.ts',import.meta.url),'utf8');
const financeWorkflows=readFileSync(new URL('../db/finance-workflows.ts',import.meta.url),'utf8');
const financeRecords=readFileSync(new URL('../db/finance-records.ts',import.meta.url),'utf8');
const inventoryShadow=readFileSync(new URL('../db/inventory-supplier-shadow.ts',import.meta.url),'utf8');
const financeShadow=readFileSync(new URL('../db/finance-shadow.ts',import.meta.url),'utf8');
const domainVersion=readFileSync(new URL('../db/domain-version.ts',import.meta.url),'utf8');

function workflowFixture(){
  const state=initialState();
  state.accountOpenings=[{account:'cash',date:shiftDate(-90),balance:10000}];
  state.suppliers=[{id:'supplier-1',name:'Supplier One',contact:'Buyer',phone:'01700000000',email:'',address:'Dhaka',leadDays:7,paymentTermsDays:30,notes:'',verified:true}];
  state.purchaseOrders=[{
    id:'po-1',number:'PO-1001',supplierId:'supplier-1',created:shiftDate(-10),expected:shiftDate(-3),status:'Sent',notes:'',
    items:[{productId:'simple-wash',qty:5,unitCost:500,receivedQty:0}]
  }];
  return state;
}

test('end-to-end core flow preserves stock, customer/order, follow-up and finance relations',()=>{
  let state=workflowFixture();
  state=applyPurchaseOrderReceipt(state,{
    purchaseOrderId:'po-1',received:shiftDate(-2),invoice:'INV-1001',dueDate:shiftDate(20),
    lines:[{productId:'simple-wash',qty:5,expiry:shiftDate(365)}]
  });
  const batch=state.batches[0];
  assert.equal(state.purchaseOrders[0].status,'Received');
  assert.equal(stock(state,'simple-wash'),5);

  state.customers.push({id:'customer-1',name:'Customer One',phone:'01800000000',address:'Dhaka',city:'Dhaka',preference:'',notes:'',consent:true,created:today()});
  const allocations=allocate(state,'simple-wash',2);
  state.orders.push({
    id:'order-1',number:'ALO-1001',customerId:'customer-1',created:today(),collections:[],channel:'Facebook',payment:'COD',status:'New',
    items:[{productId:'simple-wash',qty:2,price:749,allocations}],discount:0,deliveryCharge:80,courierCost:60,packaging:20,paymentFee:0,returnFee:0,
    settled:false,restocked:false,tracking:'',notes:''
  });
  assert.equal(stock(state,'simple-wash'),3);

  const beforeDelivery=structuredClone(state);
  state.orders[0].status='Delivered';
  state.orders[0].delivered=today();
  state=applyDeliveryFollowUps(beforeDelivery,state);
  assert.equal(state.tasks.filter(t=>t.orderId==='order-1'&&!t.done).length,1);

  state.orders[0].collections.push({id:'collection-1',date:today(),amount:100,reference:'Partial COD'});
  state.accountMatches.push({entryId:'order-collection-order-1-collection-1',account:'cash',matched:true,reference:'Partial COD'});
  assert.equal(accountBalance(state,'cash'),10100);

  state.batches[0].payments.push({id:'supplier-payment-1',date:today(),amount:200,note:'Part payment'});
  state.accountMatches.push({entryId:'batch-payment-'+batch.id+'-supplier-payment-1',account:'cash',matched:true,reference:'Part payment'});
  assert.equal(accountBalance(state,'cash'),9900);
  validateRelations(state,{skipOrderNumberUniqueness:true});
});

test('cancelled stock is quarantined instead of silently becoming sellable',()=>{
  const state=workflowFixture();
  const received=applyPurchaseOrderReceipt(state,{
    purchaseOrderId:'po-1',received:shiftDate(-2),invoice:'INV-1001',lines:[{productId:'simple-wash',qty:5,expiry:shiftDate(365)}]
  });
  received.customers.push({id:'c1',name:'Customer',phone:'017',address:'Dhaka',city:'Dhaka',preference:'',notes:'',consent:true,created:today()});
  const allocations=allocate(received,'simple-wash',2);
  received.orders.push({id:'o1',number:'ALO-1',customerId:'c1',created:today(),collections:[],channel:'Facebook',payment:'COD',status:'Confirmed',items:[{productId:'simple-wash',qty:2,price:749,allocations}],discount:0,deliveryCharge:80,courierCost:0,packaging:0,paymentFee:0,returnFee:0,settled:false,restocked:false,tracking:'',notes:''});
  const next=structuredClone(received);next.orders[0].status='Cancelled';
  const quarantined=applyCancellationQuarantine(received,next);
  assert.equal(quarantined.inventoryHolds.length,1);
  assert.equal(quarantined.inventoryHolds[0].qty,2);
  assert.equal(batchRemaining(quarantined,quarantined.batches[0]),3);
  validateRelations(quarantined,{skipOrderNumberUniqueness:true});
});

test('inventory and finance domain writes are one database batch with relational shadow and version bump',()=>{
  for(const source of [inventoryRecords,financeRecords]){
    assert.match(source,/db\.batch\(\[/);
    assert.match(source,/ShadowStatements/);
    assert.match(source,/domainVersionBumpStatements/);
  }
});

test('purchase receipt and supplier payment commit inventory, finance and workspace atomically',()=>{
  assert.match(inventoryWorkflows,/await db\.batch\(statements\)/);
  assert.match(inventoryWorkflows,/inventorySupplierShadowStatements/);
  assert.match(inventoryWorkflows,/financeShadowStatements/);
  assert.match(inventoryWorkflows,/domainVersionBumpStatements/);
  assert.doesNotMatch(inventoryWorkflows,/try\{await migrateFinanceShadow/);
});

test('customer collections and return inspection synchronize cross-domain relational data inside the order transaction',()=>{
  assert.match(orderWorkflows,/financeShadowStatements/);
  assert.match(orderWorkflows,/inventorySupplierShadowStatements/);
  assert.match(orderWorkflows,/await db\.batch\(statements\)/);
  assert.doesNotMatch(orderWorkflows,/Finance shadow sync failed after order workflow/);
  assert.match(orderWorkflows,/\['orders','accountMatches'\]/);
  assert.match(orderWorkflows,/\['orders','inventoryHolds'\]/);
});

test('order cancellation quarantine is committed atomically with the order update',()=>{
  assert.match(orderRecords,/inventoryChanged/);
  assert.match(orderRecords,/inventorySupplierShadowStatements/);
  assert.match(orderRecords,/domainVersionBumpStatements/);
  assert.doesNotMatch(orderRecords,/await migrateInventorySupplierShadow/);
});

test('owner money and reversal use atomic finance persistence',()=>{
  assert.match(financeWorkflows,/financeShadowStatements/);
  assert.match(financeWorkflows,/domainVersionBumpStatements/);
  assert.match(financeWorkflows,/await db\.batch\(\[/);
  assert.doesNotMatch(financeWorkflows,/Finance shadow sync failed/);
});

test('shadow builders remain reusable by migrations and transactional workflows',()=>{
  assert.match(inventoryShadow,/export function inventorySupplierShadowStatements/);
  assert.match(inventoryShadow,/database\(\)\.batch\(inventorySupplierShadowStatements/);
  assert.match(financeShadow,/export function financeShadowStatements/);
  assert.match(financeShadow,/database\(\)\.batch\(financeShadowStatements/);
  assert.match(domainVersion,/export function domainVersionBumpStatements/);
});
