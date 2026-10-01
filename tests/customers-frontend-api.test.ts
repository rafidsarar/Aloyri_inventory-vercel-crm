import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const crm=readFileSync(new URL('../app/crm.tsx',import.meta.url),'utf8');
const listRoute=readFileSync(new URL('../app/api/customers/route.ts',import.meta.url),'utf8');
const detailRoute=readFileSync(new URL('../app/api/customers/[id]/route.ts',import.meta.url),'utf8');
const persistence=readFileSync(new URL('../db/customer-records.ts',import.meta.url),'utf8');

test('Customers frontend loads record-level customer data',()=>{
  assert.match(crm,/fetch\('\/api\/customers'/);
  assert.match(crm,/customerRecordVersions/);
  assert.match(crm,/recordVersion/);
});

test('customer-only form saves use record APIs while other form saves can fall back',()=>{
  assert.match(crm,/function customerOnlyMutation/);
  assert.match(crm,/async function saveCustomerRecord/);
  assert.match(crm,/if\(!mutation\)return save\(next\)/);
  assert.match(crm,/onSave=\{saveRecordAware\}/);
});

test('customer create update and delete map to the expected HTTP methods',()=>{
  assert.match(crm,/mutation\.kind==='create'\?'POST':mutation\.kind==='update'\?'PUT':'DELETE'/);
  assert.match(crm,/recordVersion/);
  assert.match(crm,/encodeURIComponent\(id\)/);
});

test('customer conflict path refreshes safe workspace state',()=>{
  assert.match(crm,/res\.status===409/);
  assert.match(crm,/await loadLive\(false,false\)/);
  assert.match(crm,/setModal\(null\)/);
});

test('customer APIs return workspace versions for compatibility resync',()=>{
  assert.match(listRoute,/version:result\.workspaceVersion/);
  assert.match(detailRoute,/version:result\.workspaceVersion/);
  assert.match(persistence,/workspaceVersion:nextVersion/);
  assert.match(persistence,/workspaceVersion:nextWorkspaceVersion/);
});
