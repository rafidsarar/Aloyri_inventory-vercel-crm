import test from 'node:test';
import assert from 'node:assert/strict';
import { customer360,financeControl,inventoryPlanning,orderOperations,supplierPerformance } from '../db/growth-control.ts';
import { initialState,shiftDate,today,total,subtotal,type State } from '../lib/crm.ts';

function fixture(){
  const s=initialState();
  s.customers=[
    {id:'c1',name:'Amina',phone:'01710000000',address:'Dhaka',city:'Dhaka',preference:'',notes:'',consent:true,created:shiftDate(-100)},
    {id:'c2',name:'Nabila',phone:'01720000000',address:'Dhaka',city:'Dhaka',preference:'',notes:'',consent:true,created:shiftDate(-20)}
  ];
  s.suppliers=[{id:'s1',name:'Supplier One',contact:'',phone:'',email:'',address:'',leadDays:10,paymentTermsDays:30,notes:'',verified:true}];
  s.batches=[{
    id:'b1',productId:'simple-wash',qty:20,unitCost:500,expiry:shiftDate(180),received:shiftDate(-40),
    supplierId:'s1',invoice:'PO-1',dueDate:shiftDate(-5),payments:[{id:'p1',date:shiftDate(-3),amount:2000,note:''}],paid:false
  }];
  s.orders=[
    {id:'o1',number:'RPT-1',customerId:'c1',created:shiftDate(-20),delivered:shiftDate(-18),collections:[{id:'col1',date:shiftDate(-17),amount:500,reference:''}],channel:'Website',payment:'bKash',status:'Delivered',items:[{productId:'simple-wash',qty:2,price:800,allocations:[{batchId:'b1',qty:2,unitCost:500}]}],discount:100,deliveryCharge:80,courierCost:60,packaging:20,paymentFee:10,returnFee:0,settled:false,restocked:false,tracking:'TRK-1',notes:''},
    {id:'o2',number:'RPT-2',customerId:'c1',created:shiftDate(-8),delivered:shiftDate(-6),collections:[],channel:'Facebook',payment:'COD',status:'Delivered',items:[{productId:'simple-wash',qty:1,price:800,allocations:[{batchId:'b1',qty:1,unitCost:500}]}],discount:0,deliveryCharge:80,courierCost:60,packaging:20,paymentFee:0,returnFee:0,settled:false,restocked:false,tracking:'TRK-2',notes:''},
    {id:'o3',number:'RPT-3',customerId:'c2',created:shiftDate(-5),collections:[],channel:'Instagram',payment:'COD',status:'Packed',items:[{productId:'simple-wash',qty:1,price:800,allocations:[{batchId:'b1',qty:1,unitCost:500}]}],discount:0,deliveryCharge:80,courierCost:0,packaging:0,paymentFee:0,returnFee:0,settled:false,restocked:false,tracking:'',notes:''}
  ] as State['orders'];
  s.purchaseOrders=[{id:'po1',number:'PO-1',supplierId:'s1',created:shiftDate(-50),expected:shiftDate(-42),status:'Received',notes:'',items:[{productId:'simple-wash',qty:20,unitCost:500,receivedQty:20}]}];
  s.expenses=[{id:'e1',category:'Marketing',amount:250,date:shiftDate(-4),notes:'',vendor:'',reference:'',recurring:'none',account:'cash'}];
  return s;
}

test('management reporting reconciles customer and order revenue to delivered source records',()=>{
  const s=fixture();
  const customers=customer360(s);
  const deliveredRevenue=s.orders.filter(o=>o.status==='Delivered').reduce((n,o)=>n+subtotal(o),0);
  assert.equal(customers.reduce((n,row)=>n+row.revenue,0),deliveredRevenue);
  assert.equal(customers.find(row=>row.customerId==='c1')?.deliveredOrders,2);
});

test('management finance ageing buckets reconcile exactly to receivable and payable totals',()=>{
  const result=financeControl(fixture());
  assert.equal(
    Math.round((result.receivableBuckets.current+result.receivableBuckets.days8to30+result.receivableBuckets.days31plus)*100),
    Math.round(result.receivables*100)
  );
  assert.equal(
    Math.round((result.payableBuckets.notOverdue+result.payableBuckets.days1to30+result.payableBuckets.days31plus)*100),
    Math.round(result.payables*100)
  );
  assert.ok(result.receivables>0);
  assert.ok(result.payables>0);
});

test('management order exception value reconciles to its displayed exception queue',()=>{
  const result=orderOperations(fixture());
  const queueValue=result.queue.reduce((n,row)=>n+row.value,0);
  assert.equal(Math.round(queueValue*100),Math.round(result.exceptionValue*100));
  assert.ok(result.agedOpen>=1);
  assert.ok(result.deliveredUnpaid>=1);
});

test('inventory and supplier management reports reconcile to operational source data',()=>{
  const s=fixture();
  const inventory=inventoryPlanning(s);
  const supplier=supplierPerformance(s)[0];
  const expectedPurchaseValue=s.purchaseOrders[0].items.reduce((n,item)=>n+item.qty*item.unitCost,0);
  assert.equal(supplier.value,expectedPurchaseValue);
  assert.equal(supplier.received,1);
  const row=inventory.rows.find(x=>x.productId==='simple-wash');
  assert.ok(row);
  assert.ok((row?.units30||0)>=3);
  assert.ok((row?.available||0)>=0);
});
