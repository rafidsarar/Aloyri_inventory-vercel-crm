import test from 'node:test';
import assert from 'node:assert/strict';
import { roleCanBackup, roleCanCloseFinance, roleCanEdit, roleCanExportData, roleCanImport, roleCanInspectReturns, roleCanLoadStarterCatalog, roleCanManageFinance, roleCanManageTeam, roleCanPrintInvoice, roleCanReset, roleCanViewAudit } from '../lib/roles.ts';
import { applyRoleChanges, visibleState, validateRoleRelations, validateWorkspaceChange } from '../lib/role-data.ts';
import { accountBalance, allocate, applyCancellationQuarantine, applyDeliveryFollowUps, applyRetentionIntelligence, batchRemaining, cashflow, collectedAmount, customerInsight, initialState, metrics, nextStatuses, orderBalance, orderPaymentStatus, receivable, replenishmentSignals, stateSchema, statuses, shiftDate, stock, stockPosition, today, uid, validateRelations, type Order, type State } from '../lib/crm.ts';

function baseOrder(overrides:Partial<Order>={}):Order{
  return {
    id:uid(),number:'SK-TEST',customerId:'customer-1',created:today(),channel:'Website',payment:'COD',status:'Delivered',
    delivered:today(),settledAt:undefined,collections:[],items:[{productId:'product-1',qty:1,price:1000,allocations:[{batchId:'batch-1',qty:1,unitCost:400}]}],
    discount:0,deliveryCharge:100,courierCost:80,packaging:20,paymentFee:20,returnFee:0,settled:false,restocked:false,tracking:'',notes:'',...overrides
  };
}
function baseState(order:Order):State{
  const state=initialState();
  state.products=[{id:'product-1',brand:'Test',name:'Test product',size:'1',category:'Other',price:1000,cost:400,targetQty:1,reorderAt:0,replenishDays:0,active:true}];
  state.productCategories=['Other'];
  state.customers=[{id:'customer-1',name:'Customer',phone:'',address:'',city:'',preference:'',notes:'',consent:false,created:today()}];
  state.suppliers=[{id:'supplier-1',name:'Supplier',contact:'',phone:'',notes:'',verified:true}];
  state.batches=[{id:'batch-1',productId:'product-1',qty:10,unitCost:400,expiry:shiftDate(365),received:today(),supplierId:'supplier-1',invoice:'INV-1',payments:[],paid:false}];
  state.orders=[order];
  state.purchaseOrders=[];state.stockAdjustments=[];state.inventoryHolds=[];state.expenses=[];state.cashEntries=[];state.accountOpenings=[];state.accountMatches=[];state.financeCloses=[];state.tasks=[];
  return state;
}

test('customer insights classify retention states from delivered history',()=>{
  const current=baseState(baseOrder({id:'order-1',number:'SK-1',delivered:today(),created:today()}));
  let insight=customerInsight(current,'customer-1');
  assert.equal(insight.segment,'New');
  assert.equal(insight.delivered.length,1);
  assert.equal(insight.deliveredSpend,1100);

  current.orders.push(baseOrder({id:'order-2',number:'SK-2',delivered:shiftDate(-20),created:shiftDate(-22)}));
  insight=customerInsight(current,'customer-1');
  assert.equal(insight.segment,'Repeat');
  assert.equal(insight.delivered.length,2);

  current.orders=current.orders.map(o=>({...o,delivered:shiftDate(-75),created:shiftDate(-80)}));
  insight=customerInsight(current,'customer-1');
  assert.equal(insight.segment,'At risk');

  current.orders=current.orders.map(o=>({...o,delivered:shiftDate(-130),created:shiftDate(-135)}));
  insight=customerInsight(current,'customer-1');
  assert.equal(insight.segment,'Inactive');

  current.orders=[baseOrder({id:'order-3',number:'SK-3',status:'Cancelled',delivered:undefined})];
  insight=customerInsight(current,'customer-1');
  assert.equal(insight.segment,'No orders');
});

test('customer insights surface due and open follow-ups',()=>{
  const state=baseState(baseOrder());
  state.tasks=[
    {id:'task-due',customerId:'customer-1',orderId:'',productId:'',title:'Due',due:today(),done:false,kind:'Follow-up',priority:'High',channel:'Phone',notes:'',completedAt:'',source:'Manual'},
    {id:'task-later',customerId:'customer-1',orderId:'',productId:'',title:'Later',due:shiftDate(5),done:false,kind:'Replenishment',priority:'Normal',channel:'WhatsApp',notes:'',completedAt:'',source:'Manual'},
    {id:'task-done',customerId:'customer-1',orderId:'',productId:'',title:'Done',due:today(),done:true,kind:'Other',priority:'Low',channel:'Other',notes:'',completedAt:today(),source:'Manual'}
  ];
  const insight=customerInsight(state,'customer-1');
  assert.equal(insight.openFollowUps.length,2);
  assert.equal(insight.dueFollowUps.length,1);
  assert.equal(insight.dueFollowUps[0].id,'task-due');
});

test('replenishment timing prefers customer purchase history over configured product cycles',()=>{
  const state=baseState(baseOrder({id:'order-latest',number:'SK-LATEST',created:shiftDate(-30),delivered:shiftDate(-30)}));
  state.products[0].replenishDays=90;
  state.orders.push(baseOrder({id:'order-earlier',number:'SK-EARLIER',created:shiftDate(-90),delivered:shiftDate(-90)}));
  const [signal]=replenishmentSignals(state,'customer-1');
  assert.equal(signal.basis,'Purchase history');
  assert.equal(signal.intervalDays,60);
  assert.equal(signal.due,shiftDate(30));
  assert.equal(signal.purchaseCount,2);
});

test('replenishment timing uses product cycle then category estimate as fallbacks',()=>{
  const state=baseState(baseOrder());
  state.products[0].replenishDays=70;
  let [signal]=replenishmentSignals(state,'customer-1');
  assert.equal(signal.basis,'Product cycle');
  assert.equal(signal.intervalDays,70);
  assert.equal(signal.due,shiftDate(70));
  state.products[0].replenishDays=0;
  signal=replenishmentSignals(state,'customer-1')[0];
  assert.equal(signal.basis,'Category estimate');
  assert.equal(signal.intervalDays,75);
});

test('delivery schedules one automated replenishment reminder without duplicates',()=>{
  const previous=baseState(baseOrder({id:'order-delivery',number:'SK-DEL',status:'Out for delivery',delivered:undefined}));
  previous.products[0].replenishDays=60;
  const next=structuredClone(previous);
  next.orders[0].status='Delivered';next.orders[0].delivered=today();
  const once=applyRetentionIntelligence(previous,next);
  const reminders=once.tasks.filter(t=>t.kind==='Replenishment');
  assert.equal(reminders.length,1);
  assert.equal(reminders[0].source,'Replenishment');
  assert.equal(reminders[0].productId,'product-1');
  assert.equal(reminders[0].orderId,'order-delivery');
  assert.equal(reminders[0].due,shiftDate(60));
  const twice=applyRetentionIntelligence(previous,once);
  assert.equal(twice.tasks.filter(t=>t.kind==='Replenishment').length,1);
});

test('a delivered repurchase resolves the previous replenishment cycle and starts the next one',()=>{
  const source=baseOrder({id:'order-old',number:'SK-OLD',created:shiftDate(-70),delivered:shiftDate(-70)});
  const previous=baseState(source);
  previous.tasks=[{id:'replenish-old',customerId:'customer-1',orderId:'order-old',productId:'product-1',title:'Replenishment · Test product',due:shiftDate(-10),done:false,kind:'Replenishment',priority:'High',channel:'WhatsApp',notes:'',completedAt:'',source:'Replenishment'}];
  previous.orders.push(baseOrder({id:'order-new',number:'SK-NEW',status:'Out for delivery',created:today(),delivered:undefined}));
  const next=structuredClone(previous);
  next.orders.find(o=>o.id==='order-new')!.status='Delivered';
  next.orders.find(o=>o.id==='order-new')!.delivered=today();
  const result=applyRetentionIntelligence(previous,next);
  const oldTask=result.tasks.find(t=>t.id==='replenish-old')!;
  assert.equal(oldTask.done,true);
  assert.equal(oldTask.completedAt,today());
  const current=result.tasks.filter(t=>t.kind==='Replenishment'&&!t.done);
  assert.equal(current.length,1);
  assert.equal(current[0].orderId,'order-new');
});

test('legacy products receive an automatic replenishment-cycle default',()=>{
  const raw=structuredClone(baseState(baseOrder())) as unknown as {products:Array<Record<string,unknown>>};
  delete raw.products[0].replenishDays;
  const parsed=stateSchema.parse(raw);
  assert.equal(parsed.products[0].replenishDays,0);
});

test('legacy follow-ups migrate to the expanded customer-care model',()=>{
  const raw=structuredClone(baseState(baseOrder())) as unknown as Record<string,unknown>;
  raw.tasks=[{id:'task-legacy',customerId:'customer-1',title:'Check in',due:today(),done:false,kind:'Follow-up'}];
  const parsed=stateSchema.parse(raw);
  assert.equal(parsed.tasks[0].priority,'Normal');
  assert.equal(parsed.tasks[0].channel,'WhatsApp');
  assert.equal(parsed.tasks[0].notes,'');
  assert.equal(parsed.tasks[0].orderId,'');
  assert.equal(parsed.tasks[0].productId,'');
  assert.equal(parsed.tasks[0].completedAt,'');
  assert.equal(parsed.tasks[0].source,'Manual');
});

test('delivery creates exactly one post-delivery customer follow-up',()=>{
  const previous=baseState(baseOrder({status:'Out for delivery',delivered:undefined}));
  const next=structuredClone(previous);
  next.orders[0].status='Delivered';
  next.orders[0].delivered=today();
  const once=applyDeliveryFollowUps(previous,next);
  assert.equal(once.tasks.length,1);
  assert.equal(once.tasks[0].customerId,'customer-1');
  assert.equal(once.tasks[0].orderId,next.orders[0].id);
  assert.equal(once.tasks[0].due,shiftDate(7));
  assert.equal(once.tasks[0].kind,'Follow-up');
  assert.equal(once.tasks[0].priority,'Normal');
  assert.equal(once.tasks[0].source,'Delivery');
  assert.equal(once.tasks[0].productId,'');
  assert.equal(once.tasks[0].done,false);
  const twice=applyDeliveryFollowUps(previous,once);
  assert.equal(twice.tasks.length,1);
});

test('linked follow-ups must match the linked order customer',()=>{
  const state=baseState(baseOrder());
  state.customers.push({id:'customer-2',name:'Other customer',phone:'',address:'',city:'',preference:'',notes:'',consent:false,created:today()});
  state.tasks=[{id:'task-1',customerId:'customer-2',orderId:state.orders[0].id,productId:'',title:'Wrong customer',due:today(),done:false,kind:'Follow-up',priority:'Normal',channel:'Phone',notes:'',completedAt:'',source:'Manual'}];
  assert.throws(()=>validateRelations(state),/does not match the linked order/);
});

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

test('integrated role matrix covers finance, admin, inventory and read-only features',()=>{
  assert.equal(roleCanManageFinance('owner'),true);
  assert.equal(roleCanManageFinance('admin'),true);
  assert.equal(roleCanCloseFinance('owner'),true);
  assert.equal(roleCanCloseFinance('admin'),true);
  assert.equal(roleCanEdit('admin','financeCloses'),true);
  for(const role of ['sales','inventory','viewer'] as const){
    assert.equal(roleCanManageFinance(role),false);
    assert.equal(roleCanCloseFinance(role),false);
  }

  assert.equal(roleCanManageTeam('owner'),true);
  assert.equal(roleCanReset('owner'),true);
  assert.equal(roleCanBackup('owner'),true);
  for(const role of ['admin','sales','inventory','viewer'] as const){
    assert.equal(roleCanManageTeam(role),false);
    assert.equal(roleCanReset(role),false);
    assert.equal(roleCanBackup(role),false);
  }

  assert.equal(roleCanImport('owner'),true);
  assert.equal(roleCanImport('admin'),true);
  assert.equal(roleCanViewAudit('owner'),true);
  assert.equal(roleCanViewAudit('admin'),true);
  assert.equal(roleCanExportData('owner'),true);
  assert.equal(roleCanExportData('admin'),true);
  for(const role of ['sales','inventory','viewer'] as const){
    assert.equal(roleCanImport(role),false);
    assert.equal(roleCanViewAudit(role),false);
    assert.equal(roleCanExportData(role),false);
  }

  assert.equal(roleCanLoadStarterCatalog('owner'),true);
  assert.equal(roleCanLoadStarterCatalog('admin'),true);
  assert.equal(roleCanLoadStarterCatalog('inventory'),true);
  assert.equal(roleCanLoadStarterCatalog('sales'),false);
  assert.equal(roleCanLoadStarterCatalog('viewer'),false);

  for(const role of ['owner','admin','inventory'] as const)assert.equal(roleCanInspectReturns(role),true);
  for(const role of ['sales','viewer'] as const)assert.equal(roleCanInspectReturns(role),false);

  for(const role of ['owner','admin','sales','viewer'] as const)assert.equal(roleCanPrintInvoice(role),true);
  assert.equal(roleCanPrintInvoice('inventory'),false);

  assert.equal(roleCanEdit('sales','orders'),true);
  assert.equal(roleCanEdit('sales','customers'),true);
  assert.equal(roleCanEdit('sales','tasks'),true);
  assert.equal(roleCanEdit('sales','cashEntries'),false);

  for(const key of ['products','productCategories','batches','suppliers','purchaseOrders','stockAdjustments','inventoryHolds'])
    assert.equal(roleCanEdit('inventory',key),true);
  for(const key of ['orders','customers','tasks','expenses','cashEntries','accountMatches','financeCloses'])
    assert.equal(roleCanEdit('inventory',key),false);
});

test('admin month-end close is accepted by the same server-side role merge used for workspace saves',()=>{
  const current=baseState(baseOrder());
  const proposed=structuredClone(current);
  proposed.financeCloses.push({month:today().slice(0,7),closedAt:today(),closedBy:'Admin',notes:'Reviewed'});
  const merged=applyRoleChanges(current,proposed,'admin');
  assert.equal(merged.financeCloses.length,1);
  assert.equal(merged.financeCloses[0].closedBy,'Admin');
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

test('inventory-visible orders keep unique private references so stock receipts validate client-side',()=>{
  const current=baseState(baseOrder());
  current.orders.push(baseOrder({id:'order-2',number:'SK-TEST-2'}));
  validateRelations(current);
  const proposed=visibleState(current,'inventory');
  assert.equal(proposed.orders.length,2);
  assert.equal(new Set(proposed.orders.map(o=>o.number)).size,2);
  assert.ok(proposed.orders.every(o=>o.number.startsWith('Private order ')));
  validateRelations(stateSchema.parse(proposed));
  proposed.batches.push({...structuredClone(current.batches[0]),id:'batch-2',qty:3,invoice:'INV-2',payments:[],paid:false,paidAt:undefined});
  const merged=applyRoleChanges(current,proposed,'inventory');
  assert.equal(merged.batches.length,2);
  assert.deepEqual(merged.orders.map(o=>o.number),current.orders.map(o=>o.number));
  validateRelations(merged);
});

test('inventory stock receipt can save when legacy real order numbers are duplicated but unchanged',()=>{
  const current=baseState(baseOrder({number:'SK-LEGACY'}));
  current.orders.push(baseOrder({id:'order-2',number:'SK-LEGACY'}));
  assert.throws(()=>validateRelations(current),/Order numbers must be unique/);
  const proposed=visibleState(current,'inventory');
  proposed.batches.push({...structuredClone(current.batches[0]),id:'batch-2',qty:4,invoice:'INV-LEGACY-2',payments:[],paid:false,paidAt:undefined});
  const merged=applyRoleChanges(current,proposed,'inventory');
  assert.deepEqual(merged.orders.map(o=>o.number),['SK-LEGACY','SK-LEGACY']);
  assert.equal(merged.batches.length,2);
  validateRelations(merged,{skipOrderNumberUniqueness:true});
});

test('workspace changes ignore untouched legacy duplicate order numbers for unrelated actions',()=>{
  const current=baseState(baseOrder({number:'SK-LEGACY'}));
  current.orders.push(baseOrder({id:'order-2',number:'SK-LEGACY'}));
  const next=structuredClone(current);
  next.batches.push({...structuredClone(current.batches[0]),id:'batch-2',qty:4,invoice:'INV-2',payments:[],paid:false,paidAt:undefined});
  assert.doesNotThrow(()=>validateWorkspaceChange(current,next));
});

test('workspace changes allow a new unique order even when old duplicate numbers exist',()=>{
  const current=baseState(baseOrder({number:'SK-LEGACY'}));
  current.orders.push(baseOrder({id:'order-2',number:'SK-LEGACY'}));
  const next=structuredClone(current);
  next.orders.push(baseOrder({id:'order-3',number:'SK-NEW'}));
  assert.doesNotThrow(()=>validateWorkspaceChange(current,next));
});

test('workspace changes still reject new or edited order-number collisions',()=>{
  const current=baseState(baseOrder({number:'SK-1001'}));
  const next=structuredClone(current);
  next.orders.push(baseOrder({id:'order-2',number:'SK-1001'}));
  assert.throws(()=>validateWorkspaceChange(current,next),/Order numbers must be unique/);
});

test('role-aware client validation does not block inventory actions on legacy duplicate order numbers',()=>{
  const state=baseState(baseOrder({number:'SK-LEGACY'}));
  state.orders.push(baseOrder({id:'order-2',number:'SK-LEGACY'}));
  assert.throws(()=>validateRoleRelations(state,'owner'),/Order numbers must be unique/);
  assert.doesNotThrow(()=>validateRoleRelations(state,'inventory'));
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
  state.inventoryHolds=[{id:'hold-1',batchId:'batch-1',qty:2,date:today(),type:'Quarantine',reason:'Seal check',source:'Manual'}];
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
  state.inventoryHolds=[{id:'hold-1',batchId:'batch-1',qty:2,date:today(),type:'Damaged',reason:'Outer box crushed',source:'Manual',releasedAt:today()}];
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
  state.inventoryHolds=[{id:'hold-1',batchId:'batch-1',qty:10,date:today(),type:'Quarantine',reason:'Check',source:'Manual'}];
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


test('cancelling an order replaces its reservation with quarantine until inventory inspection',()=>{
  const current=baseState(baseOrder({status:'Confirmed',delivered:undefined}));
  assert.equal(stockPosition(current,'product-1').reserved,1);
  assert.equal(stockPosition(current,'product-1').available,9);
  const proposed=structuredClone(current);
  proposed.orders[0].status='Cancelled';
  const quarantined=applyCancellationQuarantine(current,proposed);
  validateRelations(quarantined);
  const hold=quarantined.inventoryHolds.find(h=>h.source==='Cancelled');
  assert.equal(hold?.sourceOrderId,current.orders[0].id);
  assert.equal(hold?.type,'Quarantine');
  assert.equal(hold?.qty,1);
  assert.equal(stockPosition(quarantined,'product-1').reserved,0);
  assert.equal(stockPosition(quarantined,'product-1').held,1);
  assert.equal(stockPosition(quarantined,'product-1').available,9);
});

test('legacy inventory holds migrate as manual holds',()=>{
  const state=baseState(baseOrder({status:'Cancelled',delivered:undefined}));
  const legacy=structuredClone(state) as unknown as {inventoryHolds:Array<Record<string,unknown>>};
  legacy.inventoryHolds=[{id:'legacy-hold',batchId:'batch-1',qty:1,date:today(),type:'Quarantine',reason:'Legacy inspection'}];
  const parsed=stateSchema.parse(legacy);
  assert.equal(parsed.inventoryHolds[0].source,'Manual');
  assert.equal(parsed.inventoryHolds[0].sourceOrderId,undefined);
});

test('inventory employee can classify a returned item as damaged without gaining general order access',()=>{
  const current=baseState(baseOrder({status:'Returned',returnedAt:today(),delivered:today(),restocked:false}));
  const proposed=visibleState(current,'inventory');
  proposed.orders[0].restocked=true;
  proposed.inventoryHolds.push({id:'return-damaged',batchId:'batch-1',qty:1,date:today(),type:'Damaged',reason:'Returned stock inspected as damaged',source:'Return',sourceOrderId:current.orders[0].id});
  const merged=applyRoleChanges(current,proposed,'inventory');
  validateRelations(merged);
  assert.equal(merged.orders[0].restocked,true);
  assert.equal(stockPosition(merged,'product-1').held,1);
  assert.equal(stockPosition(merged,'product-1').available,9);
});
