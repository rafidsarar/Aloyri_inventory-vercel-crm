import test from 'node:test';
import assert from 'node:assert/strict';
import { roleCanBackup, roleCanCloseFinance, roleCanEdit, roleCanExportData, roleCanImport, roleCanInspectReturns, roleCanLoadStarterCatalog, roleCanManageFinance, roleCanManageTeam, roleCanPrintInvoice, roleCanReset, roleCanViewAudit, roleCanViewSection } from '../lib/roles.ts';
import { applyRoleChanges, visibleState, validateRoleRelations, validateWorkspaceChange } from '../lib/role-data.ts';
import { accountBalance, allocate, applyCancellationQuarantine, applyDeliveryFollowUps, applyPurchaseOrderReceipt, automationSignals, batchRemaining, cashflow, collectedAmount, defaultAutomationSettings, initialState, metrics, nextStatuses, orderBalance, orderPaymentStatus, purchaseOrderProgress, purchaseOrderReceivedUnits, purchaseOrderValue, receivable, stateSchema, statuses, shiftDate, stock, stockPosition, supplierInsight, today, uid, validateRelations, type Order, type State } from '../lib/crm.ts';

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
  state.suppliers=[{id:'supplier-1',name:'Supplier',contact:'',phone:'',email:'supplier@example.com',address:'Dhaka',leadDays:14,paymentTermsDays:30,notes:'',verified:true}];
  state.batches=[{id:'batch-1',productId:'product-1',qty:10,unitCost:400,expiry:shiftDate(365),received:today(),supplierId:'supplier-1',invoice:'INV-1',payments:[],paid:false}];
  state.orders=[order];
  state.purchaseOrders=[];state.stockAdjustments=[];state.inventoryHolds=[];state.expenses=[];state.cashEntries=[];state.accountOpenings=[];state.accountMatches=[];state.financeCloses=[];state.tasks=[];
  return state;
}

test('legacy workspaces receive safe automation defaults',()=>{
  const raw=structuredClone(baseState(baseOrder())) as unknown as Record<string,unknown>;
  delete raw.automationSettings;
  const parsed=stateSchema.parse(raw);
  assert.deepEqual(parsed.automationSettings,defaultAutomationSettings());
  assert.equal(parsed.automationSettings.deliveryFollowUp.enabled,true);
  assert.equal(parsed.automationSettings.deliveryFollowUp.delayDays,7);
});

test('delivery follow-up automation respects enablement and configured delay',()=>{
  const previous=baseState(baseOrder({status:'Out for delivery',delivered:undefined}));
  const next=structuredClone(previous);
  next.automationSettings.deliveryFollowUp.delayDays=10;
  next.orders[0].status='Delivered';
  next.orders[0].delivered=today();
  const scheduled=applyDeliveryFollowUps(previous,next);
  assert.equal(scheduled.tasks.length,1);
  assert.equal(scheduled.tasks[0].due,shiftDate(10));

  const disabledPrevious=baseState(baseOrder({status:'Out for delivery',delivered:undefined}));
  const disabledNext=structuredClone(disabledPrevious);
  disabledNext.automationSettings.deliveryFollowUp.enabled=false;
  disabledNext.orders[0].status='Delivered';
  disabledNext.orders[0].delivered=today();
  assert.equal(applyDeliveryFollowUps(disabledPrevious,disabledNext).tasks.length,0);
});

test('automation signals cover stock, purchasing, finance, retention and order workflow',()=>{
  const order=baseOrder({id:'delivered-order',number:'SK-DUE',created:shiftDate(-10),delivered:shiftDate(-10),status:'Delivered'});
  const state=baseState(order);
  state.products[0].reorderAt=15;
  state.batches[0].expiry=shiftDate(20);
  state.batches[0].dueDate=shiftDate(3);
  state.purchaseOrders=[{id:'po-overdue',number:'PO-OVERDUE',supplierId:'supplier-1',created:shiftDate(-20),expected:shiftDate(-5),status:'Sent',notes:'',items:[{productId:'product-1',qty:5,unitCost:400,receivedQty:0}]}];
  state.customers[0].created=shiftDate(-200);
  state.automationSettings.customerRetention.inactivityDays=5;
  const signals=automationSignals(state);
  const keys=new Set(signals.map(signal=>signal.rule));
  assert.equal(keys.has('lowStock'),true);
  assert.equal(keys.has('expiringStock'),true);
  assert.equal(keys.has('overduePurchaseOrders'),true);
  assert.equal(keys.has('supplierPayments'),true);
  assert.equal(keys.has('customerCollections'),true);
  assert.equal(keys.has('customerRetention'),true);
});

test('disabled automation rules stop producing their signals',()=>{
  const state=baseState(baseOrder({created:shiftDate(-10),delivered:undefined,status:'Confirmed'}));
  state.products[0].reorderAt=15;
  state.automationSettings.lowStock.enabled=false;
  state.automationSettings.staleOrders.enabled=false;
  const signals=automationSignals(state);
  assert.equal(signals.some(signal=>signal.rule==='lowStock'),false);
  assert.equal(signals.some(signal=>signal.rule==='staleOrders'),false);
});

test('automation settings are owner/admin controlled',()=>{
  assert.equal(roleCanViewSection('owner','Automation'),true);
  assert.equal(roleCanViewSection('admin','Automation'),true);
  assert.equal(roleCanEdit('owner','automationSettings'),true);
  assert.equal(roleCanEdit('admin','automationSettings'),true);
  for(const role of ['sales','inventory','viewer'] as const){
    assert.equal(roleCanViewSection(role,'Automation'),false);
    assert.equal(roleCanEdit(role,'automationSettings'),false);
  }
});

test('legacy follow-ups migrate to the expanded customer-care model',()=>{
  const raw=structuredClone(baseState(baseOrder())) as unknown as Record<string,unknown>;
  raw.tasks=[{id:'task-legacy',customerId:'customer-1',title:'Check in',due:today(),done:false,kind:'Follow-up'}];
  const parsed=stateSchema.parse(raw);
  assert.equal(parsed.tasks[0].priority,'Normal');
  assert.equal(parsed.tasks[0].channel,'WhatsApp');
  assert.equal(parsed.tasks[0].notes,'');
  assert.equal(parsed.tasks[0].orderId,'');
  assert.equal(parsed.tasks[0].completedAt,'');
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
  assert.equal(once.tasks[0].done,false);
  const twice=applyDeliveryFollowUps(previous,once);
  assert.equal(twice.tasks.length,1);
});

test('linked follow-ups must match the linked order customer',()=>{
  const state=baseState(baseOrder());
  state.customers.push({id:'customer-2',name:'Other customer',phone:'',address:'',city:'',preference:'',notes:'',consent:false,created:today()});
  state.tasks=[{id:'task-1',customerId:'customer-2',orderId:state.orders[0].id,title:'Wrong customer',due:today(),done:false,kind:'Follow-up',priority:'Normal',channel:'Phone',notes:'',completedAt:''}];
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

test('legacy suppliers migrate with safe purchasing defaults',()=>{
  const raw=structuredClone(baseState(baseOrder())) as unknown as {suppliers:Array<Record<string,unknown>>};
  delete raw.suppliers[0].email;
  delete raw.suppliers[0].address;
  delete raw.suppliers[0].leadDays;
  delete raw.suppliers[0].paymentTermsDays;
  const parsed=stateSchema.parse(raw);
  assert.equal(parsed.suppliers[0].email,'');
  assert.equal(parsed.suppliers[0].address,'');
  assert.equal(parsed.suppliers[0].leadDays,14);
  assert.equal(parsed.suppliers[0].paymentTermsDays,30);
});

test('purchase order helpers report value and receiving progress',()=>{
  const state=baseState(baseOrder());
  const po={id:'po-progress',number:'PO-PROGRESS',supplierId:'supplier-1',created:today(),expected:shiftDate(7),status:'Part received' as const,notes:'',items:[{productId:'product-1',qty:10,unitCost:400,receivedQty:4}]};
  state.purchaseOrders=[po];
  assert.equal(purchaseOrderValue(po),4000);
  assert.equal(purchaseOrderReceivedUnits(po),4);
  assert.equal(purchaseOrderProgress(po),40);
});

test('partial purchase receiving creates real batches and keeps outstanding stock open',()=>{
  const state=baseState(baseOrder());
  state.purchaseOrders=[{id:'po-partial',number:'PO-PARTIAL',supplierId:'supplier-1',created:shiftDate(-3),expected:today(),status:'Sent',notes:'',items:[{productId:'product-1',qty:5,unitCost:420,receivedQty:0}]}];
  const next=applyPurchaseOrderReceipt(state,{purchaseOrderId:'po-partial',received:today(),invoice:'INV-PO-1',dueDate:shiftDate(30),lines:[{productId:'product-1',qty:2,expiry:shiftDate(300)}]});
  const po=next.purchaseOrders[0];
  assert.equal(po.status,'Part received');
  assert.equal(po.items[0].receivedQty,2);
  const batch=next.batches.find(b=>b.invoice==='INV-PO-1')!;
  assert.equal(batch.qty,2);
  assert.equal(batch.unitCost,420);
  assert.equal(batch.supplierId,'supplier-1');
  assert.equal(batch.dueDate,shiftDate(30));
  validateRelations(next);
});

test('final purchase receipt closes the purchase order and rejects over-receiving',()=>{
  const state=baseState(baseOrder());
  state.purchaseOrders=[{id:'po-final',number:'PO-FINAL',supplierId:'supplier-1',created:shiftDate(-5),expected:today(),status:'Part received',notes:'',items:[{productId:'product-1',qty:5,unitCost:400,receivedQty:2}]}];
  const completed=applyPurchaseOrderReceipt(state,{purchaseOrderId:'po-final',received:today(),invoice:'PO-FINAL',dueDate:shiftDate(30),lines:[{productId:'product-1',qty:3,expiry:shiftDate(365)}]});
  assert.equal(completed.purchaseOrders[0].status,'Received');
  assert.equal(completed.purchaseOrders[0].items[0].receivedQty,5);
  assert.throws(()=>applyPurchaseOrderReceipt(state,{purchaseOrderId:'po-final',received:today(),invoice:'PO-FINAL',dueDate:shiftDate(30),lines:[{productId:'product-1',qty:4,expiry:shiftDate(365)}]}),/outstanding purchase order quantity/i);
});

test('supplier insights combine PO pipeline, receipts, lead time and payable balance',()=>{
  const state=baseState(baseOrder());
  state.batches=[];
  state.purchaseOrders=[
    {id:'po-received',number:'PO-RECEIVED',supplierId:'supplier-1',created:shiftDate(-20),expected:shiftDate(-10),status:'Received',notes:'',items:[{productId:'product-1',qty:2,unitCost:400,receivedQty:2}]},
    {id:'po-late',number:'PO-LATE',supplierId:'supplier-1',created:shiftDate(-10),expected:shiftDate(-2),status:'Sent',notes:'',items:[{productId:'product-1',qty:3,unitCost:450,receivedQty:0}]}
  ];
  state.batches=[{id:'batch-received',productId:'product-1',qty:2,unitCost:400,expiry:shiftDate(300),received:shiftDate(-8),supplierId:'supplier-1',invoice:'PO-RECEIVED',dueDate:shiftDate(20),payments:[{id:'pay-1',date:shiftDate(-5),amount:300,note:'Part'}],paid:false}];
  const insight=supplierInsight(state,'supplier-1');
  assert.equal(insight.purchaseOrders.length,2);
  assert.equal(insight.activePurchaseOrders.length,1);
  assert.equal(insight.overduePurchaseOrders.length,1);
  assert.equal(insight.receivedValue,800);
  assert.equal(insight.paidValue,300);
  assert.equal(insight.payable,500);
  assert.equal(insight.avgLeadDays,12);
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
