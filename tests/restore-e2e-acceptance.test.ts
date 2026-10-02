import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backup=readFileSync(new URL('../app/api/workspace/backup/route.ts',import.meta.url),'utf8');
const customerShadow=readFileSync(new URL('../db/customer-order-shadow.ts',import.meta.url),'utf8');
const restoreMigration=readFileSync(new URL('../sql/migrations/004_restore_infrastructure.sql',import.meta.url),'utf8');
const e2ePage=readFileSync(new URL('../app/e2e/page.tsx',import.meta.url),'utf8');
const e2eFixture=readFileSync(new URL('../app/api/e2e/fixture/route.ts',import.meta.url),'utf8');
const acceptance=readFileSync(new URL('../app/api/acceptance/route.ts',import.meta.url),'utf8');
const smoke=readFileSync(new URL('../.github/workflows/production-smoke.yml',import.meta.url),'utf8');
const ci=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');

test('restore commits workspace relational domains versions cutover snapshot and audit in one batch',()=>{
  assert.match(backup,/const statements:any\[\]=\[/);
  assert.match(backup,/customerOrderShadowStatements/);
  assert.match(backup,/inventorySupplierShadowStatements/);
  assert.match(backup,/financeShadowStatements/);
  assert.match(backup,/domainVersionBumpStatements/);
  assert.match(backup,/crm_restore_snapshots/);
  assert.match(backup,/crm_relational_cutover/);
  assert.match(backup,/crm_audit_log/);
  assert.match(backup,/await db\.batch\(statements\)/);
  assert.doesNotMatch(backup,/await migrateCustomersOrdersShadow|await migrateInventorySupplierShadow|await migrateFinanceShadow/);
  assert.doesNotMatch(backup,/CREATE TABLE IF NOT EXISTS crm_restore_snapshots|CREATE TABLE IF NOT EXISTS crm_audit_log/);
});

test('customer-order shadow can participate in a larger transaction',()=>{
  assert.match(customerShadow,/export function customerOrderShadowStatements/);
  assert.match(customerShadow,/database\(\)\.batch\(customerOrderShadowStatements/);
});

test('restore infrastructure is deployment-managed',()=>{
  assert.match(restoreMigration,/CREATE TABLE IF NOT EXISTS crm_restore_snapshots/);
  assert.match(restoreMigration,/CREATE TABLE IF NOT EXISTS crm_audit_log/);
});

test('browser E2E routes are unavailable unless explicit test mode is enabled',()=>{
  assert.match(e2ePage,/process\.env\.E2E_TEST_MODE!=='1'\)notFound\(\)/);
  assert.match(e2eFixture,/process\.env\.E2E_TEST_MODE!=='1'/);
});

test('CI runs real browser role tests',()=>{
  assert.match(ci,/browser-e2e:/);
  assert.match(ci,/playwright install --with-deps chromium/);
  assert.match(ci,/playwright test/);
});

test('production acceptance verifies cutover relational domains versions and restore infrastructure',()=>{
  assert.match(acceptance,/disabled_cutovers/);
  assert.match(acceptance,/unverified_domains/);
  assert.match(acceptance,/missing_domain_versions/);
  assert.match(acceptance,/restoreInfrastructureReady/);
  assert.match(smoke,/ACCEPTANCE_URL/);
  assert.match(acceptance,/staffAccessReady/);
  assert.match(acceptance,/dailyUseAcceptance/);
  assert.match(smoke,/restoreInfrastructureReady/);
  assert.match(smoke,/staffAccessReady/);
  assert.match(smoke,/dailyUseAcceptance/);
});
