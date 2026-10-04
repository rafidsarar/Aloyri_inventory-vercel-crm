import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCustomerNotification,
  notificationEventKey
} from '../db/customer-notifications.ts';
import { initialState, type State } from '../lib/crm.ts';

function stateWithWebsiteOrder():State{
  const state=initialState();
  state.customers.push({
    id:'customer-1',
    name:'Customer',
    phone:'01712345678',
    address:'Private address must not appear',
    city:'Dhaka',
    preference:'Website',
    notes:'Private customer note',
    consent:false,
    created:'2026-10-05'
  });
  state.orders.push({
    id:'order-1',
    number:'WEB-20261005-TEST123',
    customerId:'customer-1',
    created:'2026-10-05',
    collections:[],
    channel:'Website',
    payment:'COD',
    status:'Shipped',
    items:[{
      productId:'cosrx',
      qty:1,
      price:580,
      allocations:[{batchId:'private-batch',qty:1,unitCost:400}]
    }],
    discount:0,
    deliveryCharge:80,
    courierCost:50,
    packaging:20,
    paymentFee:0,
    returnFee:0,
    settled:false,
    restocked:false,
    tracking:'COURIER-123',
    notes:'Private internal order note'
  });
  return state;
}

test('status events are deterministic',()=>{
  assert.equal(notificationEventKey('Out for delivery'),'status:out-for-delivery');
  assert.equal(notificationEventKey('Delivered'),'status:delivered');
});

test('customer notification content contains safe order details only',()=>{
  const state=stateWithWebsiteOrder();
  const order=state.orders[0];
  const result=buildCustomerNotification(state,order,'Shipped','status:shipped');
  const combined=result.subject+'\n'+result.text+'\n'+result.html;

  assert.match(combined,/WEB-20261005-TEST123/);
  assert.match(combined,/COURIER-123/);
  assert.match(combined,/Track your order/i);

  for(const forbidden of [
    'Private address must not appear',
    'Private customer note',
    'Private internal order note',
    'private-batch',
    'unitCost',
    'courierCost',
    'packaging',
    'settled'
  ]){
    assert.equal(combined.includes(forbidden),false,forbidden+' leaked');
  }
});
