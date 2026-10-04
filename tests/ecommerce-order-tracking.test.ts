import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPublicTrackingView,
  type PublicOrderTracking
} from '../db/ecommerce-order-tracking.ts';
import { initialState, type State } from '../lib/crm.ts';

function trackingState(channel:'Website'|'Facebook'='Website'):State{
  const state=initialState();
  state.customers.push({
    id:'customer-1',
    name:'Customer Name',
    phone:'+8801712345678',
    address:'Private home address',
    city:'Dhaka',
    preference:'Website',
    notes:'Internal customer note',
    consent:false,
    created:'2026-10-01'
  });
  state.orders.push({
    id:'order-1',
    number:'WEB-20261001-ABC123',
    customerId:'customer-1',
    created:'2026-10-01',
    delivered:undefined,
    returnedAt:undefined,
    settledAt:undefined,
    collections:[],
    channel,
    payment:'COD',
    status:'Shipped',
    items:[{
      productId:'cosrx',
      qty:2,
      price:580,
      allocations:[{batchId:'secret-batch',qty:2,unitCost:400}]
    }],
    discount:50,
    deliveryCharge:80,
    courierCost:65,
    packaging:20,
    paymentFee:5,
    returnFee:0,
    settled:false,
    restocked:false,
    tracking:'STEADFAST-123456',
    notes:'Internal order note that must never be exposed'
  });
  return state;
}

test('tracking requires exact website order number plus normalized customer phone',()=>{
  const state=trackingState();
  assert.ok(buildPublicTrackingView(state,'WEB-20261001-ABC123','01712345678'));
  assert.ok(buildPublicTrackingView(state,'web-20261001-abc123','8801712345678'));
  assert.equal(buildPublicTrackingView(state,'WEB-20261001-ABC123','01812345678'),null);
  assert.equal(buildPublicTrackingView(state,'WEB-WRONG','01712345678'),null);
  assert.equal(
    buildPublicTrackingView(trackingState('Facebook'),'WEB-20261001-ABC123','01712345678'),
    null
  );
});

test('public tracking view exposes only customer-safe order fields',()=>{
  const result=buildPublicTrackingView(
    trackingState(),
    'WEB-20261001-ABC123',
    '01712345678'
  ) as PublicOrderTracking;

  assert.deepEqual(Object.keys(result).sort(),[
    'created',
    'deliveredDate',
    'deliveryCharge',
    'discount',
    'items',
    'orderNumber',
    'paymentMethod',
    'productsSubtotal',
    'returnedDate',
    'status',
    'total',
    'trackingReference'
  ].sort());

  assert.deepEqual(result.items[0],{
    name:'Low pH Good Morning Gel Cleanser',
    brand:'COSRX',
    size:'50ml',
    qty:2,
    unitPrice:580
  });

  const serialized=JSON.stringify(result);
  for(const forbidden of [
    'customerId',
    'address',
    'notes',
    'batchId',
    'unitCost',
    'courierCost',
    'packaging',
    'paymentFee',
    'collections',
    'settled',
    'restocked'
  ]){
    assert.equal(serialized.includes(forbidden),false,forbidden+' leaked');
  }

  assert.equal(result.productsSubtotal,1160);
  assert.equal(result.discount,50);
  assert.equal(result.deliveryCharge,80);
  assert.equal(result.total,1190);
});
