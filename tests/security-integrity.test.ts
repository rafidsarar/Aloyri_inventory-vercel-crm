import test from 'node:test';
import assert from 'node:assert/strict';
import { roleCanEdit, roleCanManageFinance, roleCanManageTeam, roleCanReset } from '../lib/roles.ts';
import { accountBalance, cashflow, initialState, metrics, receivable, shiftDate, today, uid, validateRelations, type Order, type State } from '../lib/crm.ts';

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
  state.batches=[{id:'batch-1',productId:'product-1',qty:10,unitCost:400,expiry:shiftDate(365),received:today(),supplierId:'supplier-1',invoice:'INV-1',payments:[],paid:false}];
  state.orders=[order];
  state.purchaseOrders=[];state.stockAdjustments=[];state.expenses=[];state.cashEntries=[];state.accountOpenings=[];state.accountMatches=[];state.financeCloses=[];state.tasks=[];
  return state;
}

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
  assert.equal(metrics(state).profit,-570);
  returned.restocked=true;
  assert.equal(metrics(state).profit,-170);
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
