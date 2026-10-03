import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const foundation=readFileSync(new URL('../db/relational-foundation.ts',import.meta.url),'utf8');
const shadow=readFileSync(new URL('../db/finance-shadow.ts',import.meta.url),'utf8');
const records=readFileSync(new URL('../db/finance-records.ts',import.meta.url),'utf8');
const workflows=readFileSync(new URL('../db/finance-workflows.ts',import.meta.url),'utf8');
const route=readFileSync(new URL('../app/api/finances/route.ts',import.meta.url),'utf8');
const ownerRoute=readFileSync(new URL('../app/api/finances/owner-money/route.ts',import.meta.url),'utf8');
const reverseRoute=readFileSync(new URL('../app/api/finances/cash-entries/[id]/reverse/route.ts',import.meta.url),'utf8');
const workspaceRoute=readFileSync(new URL('../app/api/workspace/route.ts',import.meta.url),'utf8');
const orderWorkflows=readFileSync(new URL('../db/order-workflows.ts',import.meta.url),'utf8');
const supplierWorkflows=readFileSync(new URL('../db/inventory-supplier-workflows.ts',import.meta.url),'utf8');
const crm=readFileSync(new URL('../app/crm.tsx',import.meta.url),'utf8');

test('Step 7A finance relational foundation covers all finance entities',()=>{
 for(const table of ['crm_rel_finance_expenses','crm_rel_finance_cash_entries','crm_rel_finance_account_openings','crm_rel_finance_account_matches','crm_rel_finance_closes'])
  assert.ok(foundation.includes(table),table);
});
test('finance shadow migration is tracked and verified',()=>{
 assert.match(shadow,/FINANCE_DOMAIN='finances'/);
 assert.match(shadow,/migrateFinanceShadow/);
 assert.match(shadow,/crm_rel_finance_expenses/);
 assert.match(shadow,/crm_rel_finance_account_matches/);
 assert.match(shadow,/status=\?/);
});
test('Finance API is role protected and versioned',()=>{
 assert.match(records,/financeKeys=\['expenses','cashEntries','accountOpenings','accountMatches','financeCloses','customerRefunds'\]/);
 assert.match(records,/SELECT 1 \/ CASE WHEN EXISTS/);
 assert.match(records,/financeShadowStatements/);
 assert.match(records,/domainVersionBumpStatements/);
 assert.match(records,/\['owner','admin','finance'\]/);
 assert.match(route,/Only the owner, an admin or a finance manager can edit Finance/);
});
test('Step 7C frontend loads and saves Finance through dedicated API',()=>{
 assert.match(crm,/fetch\('\/api\/finances'/);
 assert.match(crm,/async function loadFinanceRecords/);
 assert.match(crm,/async function saveFinanceDomain/);
 assert.match(crm,/if\(financeOnlyMutation\(next\)\)return saveFinanceDomain\(next\)/);
 assert.match(crm,/save:saveFinanceDomain/);
});
test('Step 7D owner money and reversal use server workflows',()=>{
 assert.match(workflows,/postOwnerMoney/);
 assert.match(workflows,/reverseManualCashEntry/);
 assert.match(ownerRoute,/postOwnerMoney/);
 assert.match(reverseRoute,/reverseManualCashEntry/);
 assert.match(crm,/\/api\/finances\/owner-money/);
 assert.match(crm,/\/api\/finances\/cash-entries\//);
});
test('Step 7E Finance reads from relational tables',()=>{
 assert.match(records,/SELECT id,category,amount,date,notes,vendor,reference,recurring,account FROM crm_rel_finance_expenses/);
 assert.match(records,/SELECT id,date,kind,category,description,amount,transfer_id,reversal_of,reversal_reason FROM crm_rel_finance_cash_entries/);
 assert.match(records,/SELECT entry_id,account,matched,reference FROM crm_rel_finance_account_matches/);
});
test('cross-domain customer collections and supplier payments sync Finance shadow atomically',()=>{
 assert.match(orderWorkflows,/financeShadowStatements/);
 assert.match(orderWorkflows,/domainVersionBumpStatements\(ownerId,FINANCE_DOMAIN/);
 assert.match(supplierWorkflows,/financeShadowStatements/);
 assert.match(supplierWorkflows,/domainVersionBumpStatements\(ownerId,FINANCE_DOMAIN/);
});
test('legacy workspace writes maintain Finance shadow compatibility',()=>{
 assert.match(workspaceRoute,/financeSectionsChanged/);
 assert.match(workspaceRoute,/migrateFinanceShadow/);
 assert.match(workspaceRoute,/markFinanceShadowStale/);
});
test('Step 7F removes constant 1\/0 transactional assertions',()=>{
 for(const source of [orderWorkflows,readFileSync(new URL('../db/customer-records.ts',import.meta.url),'utf8'),readFileSync(new URL('../db/order-records.ts',import.meta.url),'utf8')])
  assert.doesNotMatch(source,/ELSE 1\/0/);
 assert.match(orderWorkflows,/SELECT 1 \/ CASE WHEN/);
});

