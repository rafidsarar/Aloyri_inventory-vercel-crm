import assert from 'node:assert/strict';
import test from 'node:test';
import { ecommerceOrderInputSchema,normalizeBangladeshPhone,validBangladeshPhone } from '../lib/ecommerce-integration.ts';

test('normalizes Bangladesh mobile variants to local format',()=>{
  assert.equal(normalizeBangladeshPhone('01712345678'),'01712345678');
  assert.equal(normalizeBangladeshPhone('8801712345678'),'01712345678');
  assert.equal(normalizeBangladeshPhone('+8801712345678'),'01712345678');
  assert.equal(validBangladeshPhone('+8801712345678'),true);
  assert.equal(validBangladeshPhone('01234567890'),false);
});

test('storefront order contract accepts operational fields only',()=>{
  const parsed=ecommerceOrderInputSchema.parse({
    externalOrderId:'checkout_12345678',
    customer:{
      name:'Website Customer',
      phone:'01712345678',
      address:'House 1, Road 2, Dhaka',
      district:'Dhaka',
      area:'Dhanmondi',
      landmark:'',
      notes:'Call before delivery'
    },
    items:[{productId:'cosrx',qty:2}],
    deliveryZone:'inside-dhaka',
    paymentMethod:'COD'
  });
  assert.equal(parsed.items[0].productId,'cosrx');
  assert.throws(()=>ecommerceOrderInputSchema.parse({
    externalOrderId:'checkout_12345678',
    customer:{name:'Website Customer',phone:'01712345678',address:'House 1, Road 2, Dhaka',district:'Dhaka',area:'Dhanmondi'},
    items:[{productId:'cosrx',qty:1,price:1}],
    deliveryZone:'inside-dhaka',
    paymentMethod:'COD'
  }));
});
