import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const crm=readFileSync(new URL('../app/crm.tsx',import.meta.url),'utf8');
const preferences=readFileSync(new URL('../app/api/workspace/preferences/route.ts',import.meta.url),'utf8');

test('Follow-ups and compatibility actions use the dedicated preferences endpoint',()=>{
  assert.match(crm,/const compatibilityKeys=\['tasks','businessName','businessProfile','automationSettings'\]/);
  assert.match(crm,/fetch\('\/api\/workspace\/preferences'/);
  assert.match(crm,/if\(compatibilityOnlyMutation\(next\)\)return saveCompatibilityPreferences\(next\)/);
  assert.match(crm,/await saveRecordAware\(next\);\s*\}\s*async function updateFollowUp/);
  assert.match(crm,/next\.tasks=next\.tasks\.filter\(t=>t\.id!==task\.id\);void saveRecordAware\(next\)/);
});

test('bulk follow-up actions no longer write through the legacy whole-workspace endpoint',()=>{
  assert.match(crm,/follow-ups created[\s\S]{0,1600}saveRecordAware\(next\)/);
  assert.match(crm,/Complete follow-ups[\s\S]{0,600}saveRecordAware\(next\)/);
});

test('automation and business settings share the safe compatibility action route',()=>{
  assert.match(crm,/updateAutomationRule[\s\S]{0,500}saveRecordAware\(next\)/);
  assert.match(crm,/<Form[\s\S]{0,500}onSave=\{saveRecordAware\}/);
});

test('compatibility endpoint only permits non-core sections and preserves optimistic concurrency',()=>{
  assert.match(preferences,/allowedKeys=\['tasks','businessName','businessProfile','automationSettings'\]/);
  assert.match(preferences,/SELECT data,version FROM crm_workspaces/);
  assert.match(preferences,/row\.version!==body\.version/);
  assert.match(preferences,/UPDATE crm_workspaces SET data=\?,version=version\+1/);
  assert.doesNotMatch(preferences,/relationalCoreKeys/);
});

test('compatibility endpoint enforces role boundaries and audits successful changes',()=>{
  assert.match(preferences,/canManageBusinessSettings\(role\)/);
  assert.match(preferences,/roleCanEdit\(role,key\)/);
  assert.match(preferences,/crm_audit_log/);
  assert.match(preferences,/Updated '\+label/);
});
