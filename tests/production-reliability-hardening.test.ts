import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace=readFileSync(new URL('../app/api/workspace/route.ts',import.meta.url),'utf8');
const crm=readFileSync(new URL('../app/crm.tsx',import.meta.url),'utf8');
const roles=readFileSync(new URL('../lib/roles.ts',import.meta.url),'utf8');
const dates=readFileSync(new URL('../db/relational-date.ts',import.meta.url),'utf8');

test('workspace read falls back to synchronized compatibility data when relational read fails',()=>{
  assert.match(workspace,/try\{\s*const workspace=\(await relationalCoreState\(ownerId\)\)\.state/);
  assert.match(workspace,/serving compatibility recovery snapshot/);
  assert.match(workspace,/data:visibleState\(compatibility\(\),role\)/);
  assert.match(workspace,/recoveryMode:true/);
  assert.match(workspace,/readSource:'compatibility-recovery'/);
});

test('recovery mode is explicitly read-only in the CRM',()=>{
  assert.match(crm,/const canEdit=\(key:string\)=>!recoveryMode&&roleCanEdit\(role,key\)/);
  assert.match(crm,/Recovery mode is read-only/);
  assert.match(crm,/if\(!recovery\)\{[\s\S]*const wantsCustomers=visibleSections\(nextRole\)\.includes\('Customers'\)/);
  assert.match(crm,/editing is paused until relational checks recover/);
});

test('failed initial reads never masquerade as a new empty workspace',()=>{
  assert.match(crm,/Saved records temporarily unavailable/);
  assert.match(crm,/Your records remain stored/);
  assert.match(crm,/Retry loading records/);
});

test('relational date normalization remains part of the production read path',()=>{
  assert.match(dates,/^export function relationalDate/m);
  assert.match(dates,/^export function optionalRelationalDate/m);
  assert.match(dates,/\^\\d\{4\}-\\d\{2\}-\\d\{2\}/);
});

test('existing edit boundaries remain unchanged while staff gain Overview access',()=>{
  assert.match(roles,/sales:\{\s*sections:\['Overview','Alerts','Orders','Customers','Follow-ups'\],\s*edit:\['orders','customers','tasks'\]/);
  assert.match(roles,/inventory:\{\s*sections:\['Overview','Alerts','Inventory','Suppliers'\],\s*edit:\['products','productCategories','batches','suppliers','purchaseOrders','stockAdjustments','inventoryHolds'\]/);
  assert.match(roles,/viewer:\{\s*sections:\['Overview','Alerts','Orders','Inventory','Customers','Suppliers','Finances','Follow-ups'\],\s*edit:\[\]/);
  assert.match(roles,/owner:\{[\s\S]*audit:true/);
  assert.match(roles,/admin:\{[\s\S]*audit:true/);
});
