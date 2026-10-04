import assert from 'node:assert/strict';
import test from 'node:test';
import { publicCatalogProduct } from '../db/ecommerce-catalog.ts';

test('public ecommerce catalog whitelists customer-safe product fields',()=>{
  const source={
    id:'cosrx',
    name:'Low pH Good Morning Gel Cleanser',
    brand:'COSRX',
    size:'50ml',
    category:'Cleanser',
    price:580,
    active:true,
    cost:321,
    targetQty:40,
    reorderAt:8
  };

  const result=publicCatalogProduct(source,7);
  assert.deepEqual(result,{
    id:'cosrx',
    name:'Low pH Good Morning Gel Cleanser',
    brand:'COSRX',
    size:'50ml',
    category:'Cleanser',
    price:580,
    active:true,
    availableStock:7
  });
  assert.equal('cost' in result,false);
  assert.equal('targetQty' in result,false);
  assert.equal('reorderAt' in result,false);
});

test('public ecommerce catalog never exposes negative available stock',()=>{
  const result=publicCatalogProduct({
    id:'p1',
    name:'Product',
    brand:'Brand',
    size:'50ml',
    category:'Other',
    price:100,
    active:true
  },-4);
  assert.equal(result.availableStock,0);
});
