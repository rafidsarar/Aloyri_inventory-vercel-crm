import test from 'node:test';
import assert from 'node:assert/strict';
import { roleCanEdit, roleCanManageFinance, roleCanManageTeam, roleCanReset } from '../lib/roles.ts';
import { applyRoleChanges, visibleState } from '../lib/role-data.ts';
import { accountBalance, allocate, batchRemaining, cashflow, collectedAmount, initialState, metrics, nextStatuses, orderBalance, orderPaymentStatus, receivable, stateSchema, statuses, shiftDate, stock, stockPosition, today, uid, validateRelations, type Order, type State } from '../lib/crm.ts';

function baseOrder(overrides:Partial<Order>={}):Order{
  return {
    id:uid(),number:'SK-TEST',customerId:'customer-1',created:today(),channel:'Website',payment:'COD',status:'Delivered',
    delivered:today(),settledAt:undefined,collections:[],items:[{productId:'product-1',qty:1,price:1000,allocations:[{batchId:'batch-1',qty:1,unitCost:400}]}],
    discount:0,deliveryCharge:100,courierCost:80,packaging:20,paymentFee:20,returnFee:0,settled:false,restocked:false,tracking:'',notes:'',...overrides
  };
}
function baseState(order:Order):State{
  const state=initialState();
  state.products=[{id:'product-1',brand:'Test',name:'Test product',size:'1',category:'Other',price:1000,cost:400,targetQty:1,reorderAt:0,active:true}];
  state.productCategories=['Other'];
  state.customers=[{id:'customer-1',name:'Customer',phone:'',address:'',city:'',preference:'',notes:'',consent:false,created:today()}];
  state.suppliers=[{id:'supplier-1',name:'Supplier',contact:'',phone:'',notes:'',verified:true}];
  state.batches=[{id:'batch-1',productId:'product-1',batchNumber:'LOT-TEST',qty:10,unitCost:400,manufactured:shiftDate(-30),expiry:shiftDate(365),received:today(),supplierId:'supplier-1',invoice:'INV-1',payments:[],paid:false}];
  state.orders=[order];
  state.purchaseOrders=[];state.stockAdjustments=[];state.inventoryHolds=[];state.expenses=[];state.cashEntries=[];state.accountOpenings=[];state.accountMatches=[];state.financeCloses=[];state.tasks=[];
  return state;
}

test('legacy starting capital is ignored and new workspaces do not contain it',()=>{
  const fresh=initialState() as State & {budget?:number};
  assert.equal('budget' in fresh,false);
  const parsed=stateSchema.parse({...fresh,budget:120000}) as State & {budget?:number};
  assert.equal('budget' in parsed,false);
});

test('order lifecycle follows the requested queue sequence and migrates legacy stages',()=>{
  assert.deepEqual(statuses,['New','Confirmed','Ready to pack','Packed','Shipped','Out for delivery','Delivered','Returned','Cancelled']);
  assert.deepEqual(nextStatuses(baseOrder({status:'Confirmed',delivered:undefined})),['Ready to pack','Cancelled']);
  assert.deepEqual(nextStatuses(baseOrder({status:'Ready to pack',delivered:undefined})),['Packed','Cancelled']);
  assert.deepEqual(nextStatuses(baseOrder({status:'Packed',delivered:undefined})),['Shipped','Cancelled']);
  assert.deepEqual(nextStatuses(baseOrder({status:'Shipped',delivered:undefined})),['Out for delivery']);
  assert.deepEqual(nextStatuses(baseOrder({status:'Out for delivery',delivered:undefined})),['Delivered','Returned']);
  assert.deepEqual(nextStatuses(baseOrder({status:'Delivered'})),['Returned']);
  const processing=structuredClone(baseState(baseOrder({status:'Confirmed',delivered:undefined}))) as unknown as {orders:Array<{status:string}>};processing.orders[0].status='Processing';
  assert.equal(stateSchema.parse(processing).orders[0].status,'Ready to pack');
  const readyToShip=structuredClone(baseState(baseOrder({status:'Confirmed',delivered:undefined}))) as unknown as {orders:Array<{status:string}>};readyToShip.orders[0].status='Ready to Ship';
  assert.equal(stateSchema.parse(readyToShip).orders[0].status,'Packed');
});

test('production role permissions keep finance and destructive controls restricted',()=>{
  assert.equal(roleCanManageFinance('owner'),true);
  assert.equal(roleCanManageFinance('admin'),true);
  for(const role of ['sales','inventory','viewer'] as const)assert.equal(roleCanManageFinance(role),false);
  assert.equal(roleCanManageTeam('owner'),true);
  assert.equal(roleCanReset('owner'),true);
  for(const role of ['admin','sales','inventory','viewer'] as const){assert.equal(roleCanManageTeam(role),false);assert.equal(roleCanReset(role),false);}
  assert.equal(roleCanEdit('sales','orders'),true);
  assert.equal(roleCanEdit('sales','cashEntries'),false);
});

test('COD receivable is courier net while direct payments remain gross customer receipts',()=>{
  const cod=baseOrder();
  assert.equal(receivable(cod),1000);
  const bkash=baseOrder({payment:'bKash'});
  assert.equal(receivable(bkash),1100);
});

test('order payment helpers distinguish COD, partial and settled payments',()=>{
  const cod=baseOrder({status:'Confirmed',delivered:undefined});
  assert.equal(orderPaymentStatus(cod),'Due on delivery');
  assert.equal(orderBalance(cod),1000);
  const direct=baseOrder({payment:'bKash',status:'Confirmed',delivered:undefined,collections:[{id:'pay-1',date:today(),amount:400,reference:'BKASH'}]});
  assert.equal(collectedAmount(direct),400);
  assert.equal(orderBalance(direct),700);
  assert.equal(orderPaymentStatus(direct),'Part paid');
  direct.collections=[{id:'pay-2',date:today(),amount:1100,reference:'BKASH'}];direct.settled=true;direct.settledAt=today();
  assert.equal(orderBalance(direct),0);
  assert.equal(orderPaymentStatus(direct),'Paid');
  const cancelled=baseOrder({status:'Cancelled',delivered:undefined});
  assert.equal(orderBalance(cancelled),0);
  assert.equal(orderPaymentStatus(cancelled),'Closed');
});

test('advance direct payment is valid and appears in cashflow before delivery',()=>{
  const order=baseOrder({status:'Confirmed',delivered:undefined,payment:'bKash',collections:[{id:'pay-1',date:today(),amount:1100,reference:'BKASH-1'}],settled:true,settledAt:today()});
  const state=baseState(order);
  validateRelations(state);
  const entry=cashflow(state).entries.find(e=>e.id==='order-collection-'+order.id+'-pay-1');
  assert.equal(entry?.source,'Advance customer payment');
  assert.equal(entry?.amount,1100);
});

test('non-restocked returns include lost inventory cost in operating result',()=>{
  const returned=baseOrder({status:'Returned',returnedAt:today(),delivered:undefined,returnFee:70,restocked:false});
  const state=baseState(returned);
  validateRelations(state);
  assert.equal(metrics(state).profit,-590);
  returned.restocked=true;
  assert.equal(metrics(state).profit,-190);
});

test('broken account transfers are rejected by production validation',()=>{
  const state=baseState(baseOrder());
  state.cashEntries=[{id:'x1',date:today(),kind:'out',category:'Transfer',description:'Transfer',amount:500,transferId:'t1'}];
  assert.throws(()=>validateRelations(state),/Transfer t1/);
});

test('purchase orders enforce supplier, product and receiving integrity',()=>{
  const state=baseState(baseOrder());
  state.purchaseOrders=[{id:'po-1',number:'PO-1',supplierId:'supplier-1',created:today(),expected:today(),status:'Sent',notes:'',items:[{productId:'product-1',qty:2,unitCost:400,receivedQty:3}]}];
  assert.throws(()=>validateRelations(state),/received quantity/i);
  state.purchaseOrders[0].items[0].receivedQty=0;
  validateRelations(state);
});

test('account balances use assigned movements without double counting transfers',()=>{
  const state=baseState(baseOrder());
  state.orders=[];
  state.accountOpenings=[{account:'cash',date:today(),balance:1000},{account:'bank',date:today(),balance:2000}];
  state.cashEntries=[
    {id:'out',date:today(),kind:'out',category:'Transfer',description:'Cash to bank',amount:300,transferId:'t1'},
    {id:'in',date:today(),kind:'in',category:'Transfer',description:'Cash to bank',amount:300,transferId:'t1'}
  ];
  state.accountMatches=[
    {entryId:'manual-out',account:'cash',matched:true,reference:'T1'},
    {entryId:'manual-in',account:'bank',matched:true,reference:'T1'}
  ];
  validateRelations(state);
  assert.equal(accountBalance(state,'cash'),700);
  assert.equal(accountBalance(state,'bank'),2300);
});


test('sales-visible state hides supplier finance and remains safe for client validation',()=>{
  const state=baseState(baseOrder());
  state.batches[0].payments=[{id:'supplier-pay-1',date:today(),amount:800,note:'Bank'}];
  state.financeCloses=[{month:today().slice(0,7),closedAt:today(),closedBy:'Owner',notes:''}];
  validateRelations(state);
  const sales=visibleState(state,'sales');
  assert.equal(sales.batches[0].unitCost,0);
  assert.equal(sales.batches[0].batchNumber,'');
  assert.equal(sales.batches[0].manufactured,undefined);
  assert.deepEqual(sales.batches[0].payments,[]);
  assert.equal(sales.batches[0].paid,false);
  assert.equal(sales.batches[0].paidAt,undefined);
  assert.equal(sales.batches[0].invoice,'');
  assert.equal(sales.batches[0].dueDate,undefined);
  assert.deepEqual(sales.suppliers,[]);
  assert.deepEqual(sales.purchaseOrders,[]);
  assert.deepEqual(sales.financeCloses,[]);
  validateRelations(stateSchema.parse(sales));
});

test('sales order changes preserve protected finance and stock-cost data on the server',()=>{
  const current=baseState(baseOrder({collections:[{id:'collection-1',date:today(),amount:500,reference:'COD'}],courierCost:80,packaging:25,paymentFee:15,settled:false}));
  const proposed=visibleState(current,'sales');
  proposed.orders[0].status='Returned';
  proposed.orders[0].returnedAt=today();
  proposed.orders[0].tracking='RETURN-1';
  const merged=applyRoleChanges(current,proposed,'sales');
  assert.equal(merged.orders[0].status,'Returned');
  assert.equal(merged.orders[0].tracking,'RETURN-1');
  assert.deepEqual(merged.orders[0].collections,current.orders[0].collections);
  assert.equal(merged.orders[0].courierCost,80);
  assert.equal(merged.orders[0].packaging,25);
  assert.equal(merged.orders[0].paymentFee,15);
  assert.equal(merged.orders[0].items[0].allocations[0].unitCost,400);
  validateRelations(merged);
});

test('sales can create a catalog-priced order without internal fulfillment finance fields',()=>{
  const current=baseState(baseOrder());
  const proposed=visibleState(current,'sales');
  proposed.orders.push({
    id:'sales-order-2',number:'SK-TEST-2',customerId:'customer-1',created:today(),channel:'Facebook',payment:'COD',status:'New',
    delivered:undefined,returnedAt:undefined,settledAt:undefined,collections:[],
    items:[{productId:'product-1',qty:1,price:1000,allocations:[{batchId:'batch-1',qty:1,unitCost:0}]}],
    discount:0,deliveryCharge:60,courierCost:0,packaging:0,paymentFee:0,returnFee:0,settled:false,restocked:false,tracking:'',notes:''
  });
  const merged=applyRoleChanges(current,proposed,'sales');
  const created=merged.orders.find(o=>o.id==='sales-order-2')!;
  assert.equal(created.items[0].allocations[0].unitCost,400);
  assert.equal(created.courierCost,0);
  assert.equal(created.packaging,0);
  validateRelations(merged);
});

test('inventory-visible state hides finance and inventory saves preserve supplier payments',()=>{
  const current=baseState(baseOrder({payment:'bKash',collections:[{id:'collection-1',date:today(),amount:500,reference:'BKASH'}]}));
  current.batches[0].payments=[{id:'supplier-pay-1',date:today(),amount:800,note:'Bank'}];
  current.financeCloses=[{month:today().slice(0,7),closedAt:today(),closedBy:'Owner',notes:''}];
  validateRelations(current);
  const proposed=visibleState(current,'inventory');
  assert.deepEqual(proposed.batches[0].payments,[]);
  assert.equal(proposed.batches[0].paid,false);
  assert.deepEqual(proposed.orders[0].collections,[]);
  assert.equal(proposed.orders[0].settled,false);
  assert.deepEqual(proposed.financeCloses,[]);
  proposed.batches[0].invoice='INV-UPDATED';
  const merged=applyRoleChanges(current,proposed,'inventory');
  assert.equal(merged.batches[0].invoice,'INV-UPDATED');
  assert.deepEqual(merged.batches[0].payments,current.batches[0].payments);
  validateRelations(merged);
});

test('role capabilities keep operational boundaries aligned',()=>{
  for(const key of ['orders','customers','tasks'])assert.equal(roleCanEdit('sales',key),true);
  for(const key of ['batches','suppliers','purchaseOrders','cashEntries','expenses','accountMatches'])assert.equal(roleCanEdit('sales',key),false);
  for(const key of ['products','productCategories','batches','suppliers','purchaseOrders','stockAdjustments','inventoryHolds'])assert.equal(roleCanEdit('inventory',key),true);
  for(const key of ['orders','customers','tasks','cashEntries','expenses','accountMatches'])assert.equal(roleCanEdit('inventory',key),false);
  for(const key of ['orders','customers','products','batches','cashEntries','expenses','tasks'])assert.equal(roleCanEdit('viewer',key),false);
});


test('stock positions separate physical, reserved and available units',()=>{
  const order=baseOrder({status:'Confirmed',delivered:undefined});
  const state=baseState(order);
  const position=stockPosition(state,'product-1');
  assert.deepEqual(position,{physical:10,available:9,reserved:1,returnedPending:0,held:0,expired:0,blocked:0});
  assert.equal(stock(state,'product-1'),9);
  assert.equal(batchRemaining(state,state.batches[0]),9);
});

test('inventory holds block sale allocation without reducing physical stock',()=>{
  const state=baseState(baseOrder({status:'Confirmed',delivered:undefined}));
  state.inventoryHolds=[{id:'hold-1',batchId:'batch-1',qty:2,date:today(),type:'Quarantine',reason:'Seal check'}];
  validateRelations(state);
  const position=stockPosition(state,'product-1');
  assert.equal(position.physical,10);
  assert.equal(position.reserved,1);
  assert.equal(position.held,2);
  assert.equal(position.blocked,2);
  assert.equal(position.available,7);
  assert.equal(stock(state,'product-1'),7);
  assert.throws(()=>allocate(state,'product-1',8),/Not enough unexpired stock/);
  assert.equal(allocate(state,'product-1',7).reduce((n,a)=>n+a.qty,0),7);
});

test('released inventory holds return units to available stock',()=>{
  const state=baseState(baseOrder({status:'Confirmed',delivered:undefined}));
  state.inventoryHolds=[{id:'hold-1',batchId:'batch-1',qty:2,date:today(),type:'Damaged',reason:'Outer box crushed',releasedAt:today()}];
  validateRelations(state);
  const position=stockPosition(state,'product-1');
  assert.equal(position.held,0);
  assert.equal(position.available,9);
  assert.equal(position.blocked,0);
});

test('returned stock stays in inspection pending until explicitly restocked',()=>{
  const returned=baseOrder({status:'Returned',returnedAt:today(),delivered:today(),restocked:false});
  const state=baseState(returned);
  validateRelations(state);
  let position=stockPosition(state,'product-1');
  assert.equal(position.physical,10);
  assert.equal(position.returnedPending,1);
  assert.equal(position.available,9);
  returned.restocked=true;
  position=stockPosition(state,'product-1');
  assert.equal(position.returnedPending,0);
  assert.equal(position.available,10);
});

test('shipped stock leaves physical on-hand while still remaining consumed',()=>{
  const state=baseState(baseOrder({status:'Shipped',delivered:undefined}));
  validateRelations(state);
  const position=stockPosition(state,'product-1');
  assert.equal(position.physical,9);
  assert.equal(position.available,9);
  assert.equal(position.reserved,0);
});

test('expired physical units are blocked rather than sellable',()=>{
  const state=baseState(baseOrder({status:'Cancelled',delivered:undefined}));
  state.batches[0].received=shiftDate(-365);
  state.batches[0].expiry=shiftDate(-1);
  validateRelations(state);
  const position=stockPosition(state,'product-1');
  assert.equal(position.physical,10);
  assert.equal(position.available,0);
  assert.equal(position.expired,10);
  assert.equal(position.blocked,10);
});

test('inventory holds cannot exceed uncommitted available stock',()=>{
  const state=baseState(baseOrder({status:'Confirmed',delivered:undefined}));
  state.inventoryHolds=[{id:'hold-1',batchId:'batch-1',qty:10,date:today(),type:'Quarantine',reason:'Check'}];
  assert.throws(()=>validateRelations(state),/over-allocated/i);
});

test('inventory employee can restock a returned order without gaining general order edits',()=>{
  const current=baseState(baseOrder({status:'Returned',returnedAt:today(),delivered:today(),restocked:false,payment:'bKash',collections:[{id:'pay-1',date:today(),amount:500,reference:'BKASH'}]}));
  const proposed=visibleState(current,'inventory');
  proposed.orders[0].restocked=true;
  const merged=applyRoleChanges(current,proposed,'inventory');
  assert.equal(merged.orders[0].restocked,true);
  assert.deepEqual(merged.orders[0].collections,current.orders[0].collections);
  assert.equal(stockPosition(merged,'product-1').available,10);

  const bad=visibleState(current,'inventory');
  bad.orders[0].status='Cancelled';
  assert.throws(()=>applyRoleChanges(current,bad,'inventory'),/only complete return inspection/i);
});


test('legacy batches migrate with empty batch number and optional manufacturing date',()=>{
  const state=baseState(baseOrder());
  const legacy=structuredClone(state) as any;
  delete legacy.batches[0].batchNumber;
  delete legacy.batches[0].manufactured;
  const parsed=stateSchema.parse(legacy);
  assert.equal(parsed.batches[0].batchNumber,'');
  assert.equal(parsed.batches[0].manufactured,undefined);
});

test('batch manufacturing date must be on or before receipt and before expiry',()=>{
  const state=baseState(baseOrder());
  state.batches[0].manufactured=shiftDate(1);
  assert.throws(()=>validateRelations(state),/Manufacturing date cannot be after the stock receipt date/i);
  state.batches[0].manufactured=state.batches[0].expiry;
  assert.throws(()=>validateRelations(state),/Manufacturing date cannot be after the stock receipt date|before expiry/i);
});
