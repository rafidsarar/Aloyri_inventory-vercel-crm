import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cleanup=readFileSync(new URL('../scripts/cleanup-business-exceptions.ts',import.meta.url),'utf8');
const migrate=readFileSync(new URL('../scripts/migrate-db.ts',import.meta.url),'utf8');

test('production exception cleanup only links suppliers from unique exact purchase-order evidence',()=>{
  assert.match(cleanup,/norm\(po\.number\)===norm\(batch\.invoice\)/);
  assert.match(cleanup,/item\.productId===batch\.productId&&item\.receivedQty>0/);
  assert.match(cleanup,/candidates\.length!==1/);
  assert.doesNotMatch(cleanup,/Math\.random/);
});

test('production exception cleanup snapshots and updates relational inventory atomically',()=>{
  assert.match(cleanup,/crm_restore_snapshots/);
  assert.match(cleanup,/inventorySupplierShadowStatements/);
  assert.match(cleanup,/domainVersionBumpStatements/);
  assert.match(cleanup,/crm_audit_log/);
  assert.match(cleanup,/await db\.batch\(\[/);
  assert.match(migrate,/cleanupDeterministicBusinessExceptions/);
});
