import test from 'node:test';
import assert from 'node:assert/strict';
import { customerOrderShadowIds, customerOrderShadowMetrics, verificationMatches } from '../db/customer-order-shadow.ts';
import { initialState, today, type State } from '../lib/crm.ts';

function sampleState():State{
  const state=initialState();
  state.products=[{id:'p1',brand:'Test',name:'Product',size:'1',category:'Other',price:1000,cost:400,targetQty:5,reorderAt:1,active:true}];
  state.productCategories=['Other'];
  state.customers=[{id:'c1',name:'Customer',phone:'01700000000',address:'Dhaka',city:'Dhaka',preference:'',notes:'',consent:true,created:today()}];
  state.batches=[{id:'b1',productId:'p1',qty:10,unitCost:400,expiry:'2099-12-31',received:today(),supplierId:'',invoice:'',payments:[],paid:false}];
  state.orders=[{
    id:'o1',number:'ALO-1',customerId:'c1',created:today(),collections:[{id:'pay1',date:today(),amount:500,reference:'BK'}],
    channel:'Website',payment:'bKash',status:'Confirmed',
    items:[{productId:'p1',qty:2,price:1000,allocations:[{batchId:'b1',qty:2,unitCost:400}]}],
    discount:100,deliveryCharge:80,courierCost:60,packaging:20,paymentFee:10,returnFee:0,
    settled:false,restocked:false,tracking:'',notes:''
  }];
  return state;
}

test('shadow metrics capture customer, order, child and money totals',()=>{
  const metrics=customerOrderShadowMetrics(sampleState());
  assert.deepEqual(metrics,{
    customers:1,
    orders:1,
    items:1,
    allocations:1,
    collections:1,
    orderValue:1980,
    collectionValue:500
  });
});

test('shadow identity verification includes order number and customer reference',()=>{
  const ids=customerOrderShadowIds(sampleState());
  assert.deepEqual(ids.customers,['c1']);
  assert.deepEqual(ids.orders,['o1']);
  assert.deepEqual(ids.references,['o1|ALO-1|c1']);
});

test('verification rejects count, financial or identity drift',()=>{
  const state=sampleState();
  const expected={metrics:customerOrderShadowMetrics(state),ids:customerOrderShadowIds(state)};
  assert.equal(verificationMatches(expected,structuredClone(expected)),true);

  const wrongMoney=structuredClone(expected);
  wrongMoney.metrics.collectionValue=499;
  assert.equal(verificationMatches(expected,wrongMoney),false);

  const wrongReference=structuredClone(expected);
  wrongReference.ids.references=['o1|ALO-2|c1'];
  assert.equal(verificationMatches(expected,wrongReference),false);
});

test('shadow metrics handle empty customer and order sets',()=>{
  const state=initialState();
  state.customers=[];
  state.orders=[];
  assert.deepEqual(customerOrderShadowMetrics(state),{
    customers:0,orders:0,items:0,allocations:0,collections:0,orderValue:0,collectionValue:0
  });
});
