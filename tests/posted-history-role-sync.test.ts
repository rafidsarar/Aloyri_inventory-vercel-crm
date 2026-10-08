import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, type State } from '../lib/crm.ts';
import { applyRoleChanges, samePostedRecords, visibleState } from '../lib/role-data.ts';
import { roleCanEdit, roleCanInspectReturns, roleCanManageFinance, type WorkspaceRole } from '../lib/roles.ts';

const roles:WorkspaceRole[]=['owner','admin','sales','inventory','finance','viewer'];

function fixture():State{
  const s=initialState();
  s.returnInspections=[
    {id:'inspection-z',orderId:'return-order-z',date:'2026-10-07',outcome:'Damaged'},
    {id:'inspection-a',orderId:'return-order-a',date:'2026-10-08',outcome:'Sellable'}
  ];
  s.returnSettlements=[
    {id:'settlement-z',orderId:'return-order-z',date:'2026-10-07',kind:'No refund',amount:0,reason:'Agreed'},
    {id:'settlement-a',orderId:'return-order-a',date:'2026-10-08',kind:'Refund',amount:500,reason:'Returned'}
  ];
  s.customerRefunds=[
    {id:'refund-z',orderId:'return-order-z',date:'2026-10-07',amount:100,account:'cash',reference:'R1',reason:'Refund'},
    {id:'refund-a',orderId:'return-order-a',date:'2026-10-08',amount:500,account:'bank',reference:'R2',reason:'Refund'}
  ];
  s.creditUses=[
    {id:'credit-z',settlementId:'settlement-z',orderId:'replacement-z',date:'2026-10-07',amount:100},
    {id:'credit-a',settlementId:'settlement-a',orderId:'replacement-a',date:'2026-10-08',amount:100}
  ];
  return s;
}

test('posted ledgers ignore relational read order, not record contents',()=>{
  const a=[{id:'z',amount:10},{id:'a',amount:20}];
  assert.equal(samePostedRecords(a,[...a].reverse()),true);
  assert.equal(samePostedRecords(a,a.slice(0,1)),false,'deletion');
  assert.equal(samePostedRecords(a,[...a,{id:'b',amount:0}]),false,'new record');
  assert.equal(samePostedRecords(a,[a[0],a[0]]),false,'duplicate ID');
  assert.equal(samePostedRecords(a,[a[0],{id:'a',amount:21}]),false,'tampering');
});

test('all six roles can submit their untouched, role-projected workspace',()=>{
  for(const role of roles){
    const source=fixture();
    assert.deepEqual(applyRoleChanges(source,visibleState(source,role),role),source,role);
  }
});

test('reordered posted ledgers are never mistaken for staff permission changes',()=>{
  for(const role of ['owner','admin','finance','viewer'] as const){
    const source=fixture(),proposed=structuredClone(visibleState(source,role));
    for(const key of ['customerRefunds','returnSettlements','creditUses','returnInspections'] as const)
      proposed[key].reverse();
    assert.deepEqual(applyRoleChanges(source,proposed,role),source,role);
  }
  const source=fixture(),inventory=visibleState(source,'inventory');
  inventory.returnInspections.reverse();
  assert.deepEqual(applyRoleChanges(source,inventory,'inventory'),source);
});

test('generic workspace replacement cannot create, change or remove posted history for any role',()=>{
  for(const role of roles){
    for(const key of ['customerRefunds','returnSettlements','creditUses','returnInspections'] as const){
      const source=fixture(),proposed=structuredClone(visibleState(source,role));
      const original=proposed[key].length?proposed[key]:source[key];
      // A staff role with a redacted ledger still cannot inject records.
      proposed[key]=[...original.slice(1)] as never;
      assert.throws(()=>applyRoleChanges(source,proposed,role),/dedicated|cannot change/,role+' '+key);
    }
  }
});

test('role policy preserves legitimate inspection and finance actions without broader access',()=>{
  const inspectors=new Set(['owner','admin','inventory']);
  const financeStaff=new Set(['owner','admin','finance']);
  for(const role of roles){
    assert.equal(roleCanInspectReturns(role),inspectors.has(role),role+' inspections');
    assert.equal(roleCanManageFinance(role),financeStaff.has(role),role+' financial settlements');
    assert.equal(roleCanEdit(role,'inventoryHolds'),inspectors.has(role),role+' inventory hold edits');
    assert.equal(roleCanEdit(role,'expenses'),financeStaff.has(role),role+' expense edits');
    assert.equal(roleCanEdit(role,'returnSettlements'),false,role+' cannot directly edit posted settlements');
    assert.equal(roleCanEdit(role,'returnInspections'),false,role+' cannot directly edit posted inspections');
  }
});

test('client reloads a complete domain snapshot after dedicated return actions',()=>{
  const crm=readFileSync(new URL('../app/crm.tsx',import.meta.url),'utf8');
  const from=(start:string,end:string)=>crm.slice(crm.indexOf(start),crm.indexOf(end,crm.indexOf(start)));
  for(const section of [
    from('async function returnAction(', 'async function postRefund('),
    from('async function postRefund(', 'function openOwnerMoney('),
    from('async function inspectReturnedOrder(', 'function changeStatus(')
  ])assert.match(section,/loadLive\(false,false,true\)/);
  assert.match(crm,/expectedSequence!==undefined&&expectedSequence!==loadSequence\.current/);
});
