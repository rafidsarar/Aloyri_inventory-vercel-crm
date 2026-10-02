import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const intelligence=readFileSync(new URL('../db/operational-intelligence.ts',import.meta.url),'utf8');
const route=readFileSync(new URL('../app/api/operational-intelligence/route.ts',import.meta.url),'utf8');
const reports=readFileSync(new URL('../app/crm-sections/reports.tsx',import.meta.url),'utf8');
const foundation=readFileSync(new URL('../db/relational-foundation.ts',import.meta.url),'utf8');

test('Stage 4 intelligence uses relational core as the source of truth',()=>{
  assert.match(intelligence,/relationalCoreState\(ownerId\)/);
  assert.doesNotMatch(intelligence,/SELECT data,version FROM crm_workspaces/);
  assert.match(intelligence,/source:\{architecture:'relational-core'/);
});

test('Step 1 Management Reports 2.0 exposes current and prior performance windows',()=>{
  assert.match(intelligence,/managementReports:\{windowDays:30,current,previous,revenueDelta,profitDelta\}/);
  assert.match(intelligence,/repeatRate/);
  assert.match(intelligence,/returnRate/);
});

test('Step 2 Retention and Replenishment Intelligence predicts customer return and stock cover',()=>{
  assert.match(intelligence,/predictedNextPurchase/);
  assert.match(intelligence,/averageGapDays/);
  assert.match(intelligence,/coverDays/);
  assert.match(intelligence,/suggestedReorderQty/);
});

test('Step 3 Automation Layer remains signal-based and staff controlled',()=>{
  assert.match(intelligence,/automationSignals\(state\)/);
  assert.match(intelligence,/activeRules/);
  assert.match(intelligence,/actionNeeded/);
});

test('Steps 4 and 5 provide operational dashboard and audit-control data',()=>{
  assert.match(intelligence,/dashboard:\{openOrders,lowStock:lowStock.length,outOfStock:outOfStock.length/);
  assert.match(intelligence,/auditControl:\{controls:control,recent:/);
  assert.match(intelligence,/duplicateOrderNumbers/);
  assert.match(intelligence,/brokenTransfers/);
});

test('Steps 6 and 7 expose scale pressure and hardening checks',()=>{
  assert.match(intelligence,/approximateBytes/);
  assert.match(intelligence,/pressure/);
  assert.match(intelligence,/hardeningChecks/);
  assert.match(intelligence,/relational-cutover/);
  assert.match(intelligence,/last-parity/);
});

test('Operational intelligence endpoint is protected for management roles',()=>{
  assert.match(route,/roleCanViewAudit/);
  assert.match(route,/Only the owner or an admin/);
  assert.match(route,/private, no-store/);
});

test('Management Reports UI consumes the Stage 4 operational intelligence endpoint',()=>{
  assert.match(reports,/\/api\/operational-intelligence/);
  assert.match(reports,/Operational control center/);
  assert.match(reports,/Retention \& replenishment/);
});

test('Stage 4 adds scale-oriented composite indexes',()=>{
  assert.match(foundation,/crm_stage4_orders_status_created_idx/);
  assert.match(foundation,/crm_stage4_purchase_orders_status_expected_idx/);
  assert.match(foundation,/crm_stage4_batches_product_expiry_idx/);
  assert.match(foundation,/crm_stage4_domain_versions_updated_idx/);
});
