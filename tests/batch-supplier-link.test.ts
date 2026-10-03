import test from 'node:test';
import assert from 'node:assert/strict';
import { linkBatchSupplier } from '../lib/batch-supplier.ts';
import { initialState, type State } from '../lib/crm.ts';
import { applyRoleChanges, visibleState } from '../lib/role-data.ts';

function fixture():State {
  const s=initialState();
  s.suppliers=[{id:'supplier',name:'Verified supplier',contact:'',phone:'',email:'',address:'',leadDays:1,paymentTermsDays:30,notes:'',verified:true}];
  s.batches=[{id:'batch',productId:'product',qty:10,unitCost:520,received:'2026-09-29',expiry:'2027-09-29',supplierId:'',invoice:'testing',payments:[{id:'payment',date:'2026-09-29',amount:5200,note:'Original proof'}],paid:true,paidAt:'2026-09-29'}];
  return s;
}

for(const role of ['owner','admin','inventory'] as const)test(role+' links provenance without changing stock or finances',()=>{
  const before=fixture(),next=linkBatchSupplier(before,'batch',{supplierId:'supplier',invoice:' INV-123 '},role);
  const expected=structuredClone(before);expected.batches[0].supplierId='supplier';expected.batches[0].invoice='INV-123';
  assert.deepEqual(next,expected);assert.equal(before.batches[0].supplierId,'');assert.equal(next.batches.length,1);
});

test('inventory save restores hidden payment history on the server',()=>{
  const current=fixture(),draft=linkBatchSupplier(visibleState(current,'inventory'),'batch',{supplierId:'supplier',invoice:'INV-123'},'inventory');
  const saved=applyRoleChanges(current,draft,'inventory');
  assert.deepEqual(saved.batches[0].payments,current.batches[0].payments);
  assert.equal(saved.batches[0].paid,true);assert.equal(saved.batches[0].paidAt,current.batches[0].paidAt);
  assert.equal(saved.batches[0].supplierId,'supplier');
});

for(const role of ['sales','finance','viewer'] as const)test(role+' cannot link suppliers',()=>{
  assert.throws(()=>linkBatchSupplier(fixture(),'batch',{supplierId:'supplier',invoice:'INV'},role),/role cannot/);
});

test('rejects missing batches, unknown suppliers and blank references',()=>{
  assert.throws(()=>linkBatchSupplier(fixture(),'missing',{supplierId:'supplier',invoice:'INV'},'owner'),/not found/);
  assert.throws(()=>linkBatchSupplier(fixture(),'batch',{supplierId:'unknown',invoice:'INV'},'owner'),/saved supplier/);
  assert.throws(()=>linkBatchSupplier(fixture(),'batch',{supplierId:'supplier',invoice:' '},'owner'),/reference/);
});
