import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ecommercePromotionInputSchema,
  evaluatePromotionQuote,
  type EcommercePromotion
} from '../lib/ecommerce-promotions.ts';

const base=(patch:Partial<EcommercePromotion>={}):EcommercePromotion=>({
  id:'promo-1',
  name:'Glow Week',
  code:'',
  description:'',
  kind:'percentage',
  value:10,
  minimumSubtotal:0,
  startsAt:'',
  endsAt:'',
  usageLimit:null,
  usedCount:0,
  targetType:'all',
  targetIds:[],
  freeShipping:false,
  badgeText:'10% off',
  priority:0,
  active:true,
  createdAt:'2026-10-05T00:00:00.000Z',
  updatedAt:'2026-10-05T00:00:00.000Z',
  ...patch
});

test('quotes percentage promotion against eligible merchandise',()=>{
  const quote=evaluatePromotionQuote({
    promotions:[base()],
    lines:[{productId:'cosrx',category:'Cleanser',qty:2,price:500}],
    deliveryCharge:80,
    now:new Date('2026-10-05T12:00:00.000Z')
  });
  assert.equal(quote.productsSubtotal,1000);
  assert.equal(quote.discount,100);
  assert.equal(quote.total,980);
  assert.equal(quote.promotion?.id,'promo-1');
});

test('supports fixed product targeting and free shipping',()=>{
  const quote=evaluatePromotionQuote({
    promotions:[base({
      code:'GLOW150',
      kind:'fixed',
      value:150,
      targetType:'products',
      targetIds:['cosrx'],
      freeShipping:true
    })],
    lines:[
      {productId:'cosrx',category:'Cleanser',qty:1,price:580},
      {productId:'simple-light',category:'Moisturizer',qty:1,price:749}
    ],
    deliveryCharge:150,
    code:'glow150',
    now:new Date('2026-10-05T12:00:00.000Z')
  });
  assert.equal(quote.discount,150);
  assert.equal(quote.shippingDiscount,150);
  assert.equal(quote.total,1179);
  assert.equal(quote.codeApplied,true);
});

test('rejects invalid, expired and ineligible codes',()=>{
  const lines=[{productId:'cosrx',category:'Cleanser',qty:1,price:580}];
  assert.throws(()=>evaluatePromotionQuote({promotions:[],lines,deliveryCharge:80,code:'NOPE'}),/PROMOTION_CODE_INVALID/);
  assert.throws(()=>evaluatePromotionQuote({
    promotions:[base({code:'LATE',endsAt:'2026-10-01T00:00:00.000Z'})],
    lines,deliveryCharge:80,code:'LATE',now:new Date('2026-10-05T00:00:00.000Z')
  }),/PROMOTION_NOT_AVAILABLE/);
  assert.throws(()=>evaluatePromotionQuote({
    promotions:[base({code:'MIN',minimumSubtotal:1000})],
    lines,deliveryCharge:80,code:'MIN',now:new Date('2026-10-05T00:00:00.000Z')
  }),/PROMOTION_NOT_ELIGIBLE/);
});

test('supports a free-shipping-only promotion',()=>{
  const quote=evaluatePromotionQuote({
    promotions:[base({kind:'fixed',value:0,freeShipping:true})],
    lines:[{productId:'cosrx',category:'Cleanser',qty:1,price:580}],
    deliveryCharge:150,
    now:new Date('2026-10-05T12:00:00.000Z')
  });
  assert.equal(quote.discount,0);
  assert.equal(quote.shippingDiscount,150);
  assert.equal(quote.total,580);
});

test('validates campaign configuration safely',()=>{
  assert.equal(ecommercePromotionInputSchema.parse({
    name:'Sunscreen Sale',
    code:'SUN10',
    kind:'percentage',
    value:10,
    targetType:'categories',
    targetIds:['Sunscreen']
  }).value,10);
  assert.throws(()=>ecommercePromotionInputSchema.parse({
    name:'Broken percentage',
    kind:'percentage',
    value:120
  }));
  assert.doesNotThrow(()=>ecommercePromotionInputSchema.parse({
    name:'Free delivery',
    kind:'fixed',
    value:0,
    freeShipping:true
  }));
  assert.throws(()=>ecommercePromotionInputSchema.parse({
    name:'No actual offer',
    kind:'fixed',
    value:0,
    freeShipping:false
  }));
});
