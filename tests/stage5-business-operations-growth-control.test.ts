import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { customer360,financeControl,inventoryPlanning,orderOperations,supplierPerformance } from '../db/growth-control.ts';
import { initialState,shiftDate,today,type State } from '../lib/crm.ts';

function fixture(){
  const state=initialState();
  state.customers=[{id:'c1',name:'Amina',phone:'017',address:'Dhaka',city:'Dhaka',preference:'',notes:'',consent:true,created:shiftDate(-120)}];
  state.suppliers=[{id:'s1',name:'Supplier One',contact:'',phone:'',email:'',address:'',leadDays:14,paymentTermsDays:30,notes:'',verified:true}];
  state.batches=[{id:'b1',productId:'simple-wash',qty:10,unitCost:500,expiry:shiftDate(120),received:shiftDate(-45),supplierId:'s1',invoice:'PO-1',payments:[],paid:false,dueDate:shiftDate(-10)}];
  state.orders=[
    {id:'o1',number:'ALO-1',customerId:'c1',created:shiftDate(-50),delivered:shiftDate(-45),collections:[],channel:'Facebook',payment:'COD',status:'Delivered',items:[{productId:'simple-wash',qty:1,price:749,allocations:[{batchId:'b1',qty:1,unitCost:500}]}],discount:0,deliveryCharge:80,courierCost:60,packaging:20,paymentFee:0,returnFee:0,settled:false,restocked:false,tracking:'TRK-1',notes:''},
    {id:'o2',number:'ALO-2',customerId:'c1',created:shiftDate(-10),delivered:shiftDate(-5),collections:[],channel:'Instagram',payment:'bKash',status:'Delivered',items:[{productId:'simple-wash',qty:1,price:749,allocations:[{batchId:'b1',qty:1,unitCost:500}]}],discount:0,deliveryCharge:80,courierCost:60,packaging:20,paymentFee:10,returnFee:0,settled:false,restocked:false,tracking:'TRK-2',notes:''},
    {id:'o3',number:'ALO-3',customerId:'c1',created:shiftDate(-8),collections:[],channel:'WhatsApp',payment:'COD',status:'Packed',items:[{productId:'simple-wash',qty:1,price:749,allocations:[{batchId:'b1',qty:1,unitCost:500}]}],discount:0,deliveryCharge:80,courierCost:60,packaging:20,paymentFee:0,returnFee:0,settled:false,restocked:false,tracking:'',notes:''}
  ] as State['orders'];
  state.purchaseOrders=[{id:'po1',number:'PO-1',supplierId:'s1',created:shiftDate(-60),expected:shiftDate(-50),status:'Received',notes:'',items:[{productId:'simple-wash',qty:10,unitCost:500,receivedQty:10}]}];
  state.tasks=[{id:'t1',customerId:'c1',orderId:'o2',title:'Replenishment',due:today(),done:false,kind:'Replenishment',priority:'High',channel:'WhatsApp',notes:'',completedAt:''}];
  return state;
}

test('Customer 360 calculates delivered value, repeat depth and lifecycle',()=>{
  const rows=customer360(fixture());
  assert.equal(rows[0].customerId,'c1');
  assert.equal(rows[0].deliveredOrders,2);
  assert.ok(rows[0].revenue>0);
  assert.equal(rows[0].openFollowUps,1);
  assert.equal(rows[0].segment,'repeat-active');
});

test('Order Operations 2.0 identifies aged fulfillment and collection exceptions',()=>{
  const result=orderOperations(fixture());
  assert.equal(result.openOrders,1);
  assert.equal(result.agedOpen,1);
  assert.ok(result.deliveredUnpaid>=1);
  assert.ok(result.queue.some(row=>row.kind==='aged-order'));
});

test('Inventory Planning 2.0 derives velocity, cover and reorder guidance',()=>{
  const result=inventoryPlanning(fixture());
  const row=result.rows.find(x=>x.productId==='simple-wash');
  assert.ok(row);
  assert.ok((row?.units60||0)>=2);
  assert.ok(row?.coverDays!==null);
});

test('Supplier Performance includes observed lead time and purchasing value',()=>{
  const result=supplierPerformance(fixture());
  assert.equal(result[0].supplierId,'s1');
  assert.equal(result[0].received,1);
  assert.ok(result[0].value>0);
  assert.equal(result[0].avgLeadDays,15);
});

test('Finance Control 2.0 creates receivable/payable ageing and 30-day profit',()=>{
  const result=financeControl(fixture());
  assert.ok(result.receivables>0);
  assert.ok(result.payables>0);
  assert.ok(result.payableBuckets.days1to30>0);
  assert.equal(typeof result.profit30,'number');
});

const growth=readFileSync(new URL('../db/growth-control.ts',import.meta.url),'utf8');
const route=readFileSync(new URL('../app/api/growth-control/route.ts',import.meta.url),'utf8');
const reports=readFileSync(new URL('../app/crm-sections/reports.tsx',import.meta.url),'utf8');
const foundation=readFileSync(new URL('../db/relational-foundation.ts',import.meta.url),'utf8');

test('Stage 5 intelligence stays on relational core and protects management access',()=>{
  assert.match(growth,/relationalCoreState\(ownerId\)/);
  assert.doesNotMatch(growth,/SELECT data,version FROM crm_workspaces/);
  assert.match(route,/roleCanViewAudit\(role\)/);
  assert.match(route,/private, no-store/);
});

test('Stage 5 UI includes all requested operating-control modules',()=>{
  for(const label of ['Customer 360','Order operations 2.0','Inventory planning 2.0','Supplier performance','Finance control 2.0','Operational alerts','Executive operating system']){
    assert.ok(reports.toLowerCase().includes(label.toLowerCase()),label+' missing');
  }
  assert.match(reports,/fetch\('\/api\/growth-control'/);
});

test('Stage 5 adds scale indexes for customer, order, supplier and payable workflows',()=>{
  for(const name of ['crm_stage5_orders_customer_status_delivered_idx','crm_stage5_orders_status_updated_idx','crm_stage5_purchase_orders_supplier_status_expected_idx','crm_stage5_batches_due_paid_idx']){
    assert.ok(foundation.includes(name),name+' missing');
  }
});
