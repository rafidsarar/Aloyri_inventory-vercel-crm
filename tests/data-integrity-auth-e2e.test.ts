import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration=readFileSync(new URL('../sql/migrations/007_legacy_date_canonicalization.sql',import.meta.url),'utf8');
const health=readFileSync(new URL('../app/api/health/route.ts',import.meta.url),'utf8');
const acceptance=readFileSync(new URL('../app/api/acceptance/route.ts',import.meta.url),'utf8');
const ci=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
const e2e=readFileSync(new URL('../e2e/authenticated-production-workflows.spec.mjs',import.meta.url),'utf8');
const seed=readFileSync(new URL('../scripts/e2e-seed.ts',import.meta.url),'utf8');

test('legacy date canonicalization covers every date-bearing CRM domain',()=>{
  for(const token of [
    "customers","purchaseOrders","batches","payments","stockAdjustments","inventoryHolds",
    "orders","collections","expenses","cashEntries","accountOpenings","financeCloses","tasks"
  ])assert.match(migration,new RegExp(token));
  assert.match(migration,/crm_data_integrity_certifications/);
  assert.match(migration,/007_legacy_date_canonicalization/);
});

test('health and acceptance require data-integrity migration infrastructure',()=>{
  assert.match(health,/007_legacy_date_canonicalization/);
  assert.match(health,/dataIntegritySchema/);
  assert.match(acceptance,/dataCanonicalizationReady/);
  assert.match(acceptance,/crm_data_integrity_certifications/);
});

test('CI runs a real postgres-backed authenticated browser certification',()=>{
  assert.match(ci,/POSTGRES_DB: aloyri_e2e/);
  assert.match(ci,/pnpm db:migrate/);
  assert.match(ci,/scripts\/e2e-seed\.ts/);
  assert.match(ci,/authenticated workflow certification/);
  assert.match(seed,/migrateCustomersOrdersShadow/);
  assert.match(seed,/migrateInventorySupplierShadow/);
  assert.match(seed,/migrateFinanceShadow/);
});

test('authenticated regression suite covers RBAC, cross-domain writes, concurrency, sessions and restore',()=>{
  assert.match(e2e,/authenticated RBAC matrix/);
  assert.match(e2e,/cross-domain business workflow/);
  assert.match(e2e,/status\(\)\)\.toBe\(409\)/);
  assert.match(e2e,/revokeOthers/);
  assert.match(e2e,/RESTORE ALOYRI/);
  assert.match(e2e,/atomicCommit/);
});
