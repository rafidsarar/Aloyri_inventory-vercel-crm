import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeLegacyState,assertCanonicalState } from '../lib/data-integrity.ts';
import { initialState,shiftDate } from '../lib/crm.ts';

test('legacy timestamp dates are canonicalized across nested CRM domains',()=>{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state:any=initialState();
  state.customers=[{id:'c',name:'C',phone:'',address:'Dhaka',city:'Dhaka',preference:'',notes:'',consent:true,created:shiftDate(-2)+'T18:00:00.000Z'}];
  state.suppliers=[{id:'s',name:'S',contact:'',phone:'',email:'',address:'',leadDays:1,paymentTermsDays:1,notes:'',verified:true}];
  state.purchaseOrders=[{id:'po',number:'PO',supplierId:'s',created:shiftDate(-2)+'T00:00:00Z',expected:shiftDate(2)+'T00:00:00Z',status:'Sent',notes:'',items:[{productId:'simple-wash',qty:1,unitCost:500,receivedQty:0}]}];
  state.batches=[{id:'b',productId:'simple-wash',qty:2,unitCost:500,expiry:shiftDate(365)+'T00:00:00Z',received:shiftDate(-2)+'T00:00:00Z',supplierId:'s',invoice:'I',dueDate:shiftDate(20)+'T00:00:00Z',payments:[],paid:false,paidAt:''}];
  state.inventoryHolds=[{id:'h',batchId:'b',qty:1,date:shiftDate(-1)+'T00:00:00Z',type:'Quarantine',reason:'test',source:'Manual',releasedAt:''}];
  const {state:next,report}=canonicalizeLegacyState(state);
  assert.ok(report.changedPaths.length>=7);
  assert.equal(next.customers[0].created,shiftDate(-2));
  assert.equal(next.purchaseOrders[0].created,shiftDate(-2));
  assert.equal(next.batches[0].expiry,shiftDate(365));
  assert.equal(next.batches[0].paidAt,undefined);
  assert.equal(next.inventoryHolds[0].releasedAt,undefined);
  assert.doesNotThrow(()=>assertCanonicalState(next));
});

test('unparseable required legacy dates fail closed',()=>{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state:any=initialState();
  state.customers=[{id:'c',name:'C',phone:'',address:'',city:'',preference:'',notes:'',consent:true,created:'not-a-date'}];
  assert.throws(()=>canonicalizeLegacyState(state),/Unparseable legacy date fields/);
});
