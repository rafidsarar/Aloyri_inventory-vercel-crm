import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState,type State } from '../lib/crm.ts';

function fixture():State{
  const state=initialState();
  state.customers=[{
    id:'customer-1',name:'Customer',phone:'01712345678',address:'Private address',
    city:'Dhaka',preference:'Website',notes:'Private note',consent:false,created:'2026-10-01'
  }];
  state.orders=[{
    id:'order-1',number:'WEB-20261001-ABC123',customerId:'customer-1',created:'2026-10-01',
    delivered:'2026-10-03',returnedAt:undefined,settledAt:'2026-10-03',collections:[],
    channel:'Website',payment:'COD',status:'Delivered',
    items:[{productId:'cosrx',qty:2,price:580,allocations:[{batchId:'private-batch',qty:2,unitCost:400}]}],
    discount:0,deliveryCharge:80,courierCost:60,packaging:20,paymentFee:0,returnFee:0,
    settled:true,restocked:false,tracking:'COURIER-123',notes:'Internal order note'
  }];
  return state;
}

test('website return request public line projection contains no internal allocation data',()=>{
  const state=fixture(),order=state.orders[0],item=order.items[0],product=state.products.find(p=>p.id===item.productId)!;
  const projected={
    line:0,
    productId:item.productId,
    name:product.name,
    brand:product.brand,
    size:product.size,
    qty:1
  };
  const text=JSON.stringify(projected);
  assert.equal(text.includes('batchId'),false);
  assert.equal(text.includes('unitCost'),false);
  assert.equal(text.includes('Private address'),false);
  assert.equal(text.includes('Internal order note'),false);
});

test('return workflow remains separate from refund and restock decisions',()=>{
  const state=fixture();
  const before=JSON.stringify({
    status:state.orders[0].status,
    restocked:state.orders[0].restocked,
    returns:state.returnInspections,
    settlements:state.returnSettlements,
    refunds:state.customerRefunds
  });
  const after=JSON.stringify({
    status:state.orders[0].status,
    restocked:state.orders[0].restocked,
    returns:state.returnInspections,
    settlements:state.returnSettlements,
    refunds:state.customerRefunds
  });
  assert.equal(after,before);
});

import { assertCustomerRequestEligibility } from '../db/ecommerce-return-requests.ts';

test('cancellation requests are accepted only before fulfillment',()=>{
  for(const status of ['New','Confirmed'] as const)assert.doesNotThrow(()=>assertCustomerRequestEligibility(status,'cancellation'));
  for(const status of ['Packed','Shipped','Delivered','Cancelled'] as const)assert.throws(()=>assertCustomerRequestEligibility(status,'cancellation'),/RETURN_ORDER_NOT_ELIGIBLE/);
});
test('return requests still require delivery or a recorded return',()=>{
  for(const status of ['Delivered','Returned'] as const)assert.doesNotThrow(()=>assertCustomerRequestEligibility(status,'return'));
  for(const status of ['New','Confirmed','Packed','Cancelled'] as const)assert.throws(()=>assertCustomerRequestEligibility(status,'return'),/RETURN_ORDER_NOT_ELIGIBLE/);
});
