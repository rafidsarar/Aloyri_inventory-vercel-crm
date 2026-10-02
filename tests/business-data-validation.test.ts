import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, uid } from '../lib/crm.ts';
import { validateBusinessData } from '../lib/business-data-validation.ts';

test('business data validation is clean for an empty valid workspace',()=>{
  const report=validateBusinessData(initialState());
  assert.equal(report.structuralValid,true);
  assert.equal(report.criticalCount,0);
});

test('business data validation flags cross-domain business exceptions',()=>{
  const s=initialState();
  s.customers.push(
    {id:'c1',name:'A',phone:'01711-111111',address:'',city:'',preference:'',notes:'',consent:true,created:'2026-01-01'},
    {id:'c2',name:'B',phone:'01711111111',address:'',city:'',preference:'',notes:'',consent:true,created:'2026-01-02'}
  );
  s.suppliers.push({id:'sup1',name:'Supplier',contact:'',phone:'',email:'',address:'',leadDays:14,paymentTermsDays:30,notes:'',verified:true});
  s.batches.push({
    id:'b1',productId:'simple-wash',qty:3,unitCost:500,expiry:'2027-12-31',received:'2026-01-01',
    supplierId:'sup1',invoice:'INV-1',dueDate:'2026-01-15',payments:[{id:uid(),date:'2026-01-10',amount:500,note:''}],paid:true,paidAt:'2026-01-10'
  });
  const report=validateBusinessData(s);
  assert.ok(report.issues.some(i=>i.code==='duplicate-customer-phones'));
  assert.ok(report.issues.some(i=>i.code==='supplier-batches-marked-paid-with-balance'));
  assert.ok(report.issues.some(i=>i.code==='overdue-supplier-balances'));
});
