import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const foundation=readFileSync(new URL('../db/relational-foundation.ts',import.meta.url),'utf8');
const cutover=readFileSync(new URL('../db/relational-cutover.ts',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../app/api/workspace/route.ts',import.meta.url),'utf8');
const inventory=readFileSync(new URL('../db/inventory-supplier-records.ts',import.meta.url),'utf8');
const finance=readFileSync(new URL('../db/finance-records.ts',import.meta.url),'utf8');
const domainVersion=readFileSync(new URL('../db/domain-version.ts',import.meta.url),'utf8');
const migrationRoute=readFileSync(new URL('../app/api/relational-migration/route.ts',import.meta.url),'utf8');
const cutoverRoute=readFileSync(new URL('../app/api/relational-cutover/route.ts',import.meta.url),'utf8');
const backup=readFileSync(new URL('../app/api/workspace/backup/route.ts',import.meta.url),'utf8');
const orderRecords=readFileSync(new URL('../db/order-records.ts',import.meta.url),'utf8');
const orderWorkflows=readFileSync(new URL('../db/order-workflows.ts',import.meta.url),'utf8');
const inventoryWorkflows=readFileSync(new URL('../db/inventory-supplier-workflows.ts',import.meta.url),'utf8');
const financeWorkflows=readFileSync(new URL('../db/finance-workflows.ts',import.meta.url),'utf8');
const crm=readFileSync(new URL('../app/crm.tsx',import.meta.url),'utf8');

test('Step 8A adds explicit cutover and independent domain-version storage',()=>{
  assert.match(foundation,/crm_relational_cutover/);
  assert.match(foundation,/crm_domain_versions/);
  assert.match(cutover,/relationalCoreState/);
  assert.match(cutover,/listCustomerRecords/);
  assert.match(cutover,/listOrderRecords/);
  assert.match(cutover,/getInventorySupplierDomain/);
  assert.match(cutover,/getFinanceDomain/);
});

test('Inventory and Finance core reads come from relational tables',()=>{
  assert.match(inventory,/SELECT name FROM crm_rel_product_categories/);
  assert.match(inventory,/SELECT id,name,brand,size,category,price,cost,target_qty,reorder_at,active FROM crm_rel_products/);
  assert.match(inventory,/SELECT id,number,supplier_id,created,expected,status,notes FROM crm_rel_purchase_orders/);
  assert.match(finance,/SELECT id,category,amount,date,notes,vendor,reference,recurring,account FROM crm_rel_finance_expenses/);
  assert.match(finance,/SELECT entry_id,account,matched,reference FROM crm_rel_finance_account_matches/);
});

test('Step 8B workspace uses relational core after verified cutover and blocks legacy core writes',()=>{
  assert.match(workspace,/ensureRelationalCutover/);
  assert.match(workspace,/const workspace=\(await relationalCoreState\(ownerId\)\)\.state/);
  assert.match(workspace,/readSource:'relational'/);
  assert.match(workspace,/readSource:'compatibility-recovery'/);
  assert.match(workspace,/relationalCoreKeys\.find/);
  assert.match(workspace,/core domain is relationally authoritative/);
});

test('Step 8C verifies counts ids and business-critical totals',()=>{
  assert.match(cutover,/verifyRelationalParity/);
  assert.match(cutover,/orderTotal/);
  assert.match(cutover,/receivables/);
  assert.match(cutover,/payables/);
  assert.match(cutover,/inventoryUnits/);
  assert.match(cutover,/cashIn/);
  assert.match(cutover,/cashOut/);
  assert.match(cutover,/accountBalances/);
  assert.match(migrationRoute,/customersOrders,inventorySuppliers,finances/);
});

test('Step 8D Inventory and Finance saves use domain versions rather than client workspace versions',()=>{
  assert.match(domainVersion,/crm_domain_versions/);
  assert.match(inventory,/expectedDomainVersion/);
  assert.match(inventory,/DOMAIN_VERSION_CONFLICT/);
  assert.match(finance,/expectedDomainVersion/);
  assert.match(finance,/DOMAIN_VERSION_CONFLICT/);
  assert.match(crm,/inventorySupplierVersion/);
  assert.match(crm,/financeDomainVersion/);
  assert.match(crm,/domainVersion:inventorySupplierVersion/);
  assert.match(crm,/domainVersion:financeDomainVersion/);
});

test('mixed workflows bump affected relational domain versions',()=>{
  assert.match(inventoryWorkflows,/bumpDomainVersion\(ownerId,INVENTORY_SUPPLIER_DOMAIN\)/);
  assert.match(inventoryWorkflows,/bumpDomainVersion\(ownerId,FINANCE_DOMAIN\)/);
  assert.match(financeWorkflows,/bumpDomainVersion\(ownerId,FINANCE_DOMAIN\)/);
  assert.match(orderWorkflows,/bumpDomainVersion\(ownerId,FINANCE_DOMAIN\)/);
  assert.match(orderWorkflows,/bumpDomainVersion\(ownerId,INVENTORY_SUPPLIER_DOMAIN\)/);
});

test('order cancellation synchronizes generated inventory holds relationally',()=>{
  assert.match(orderRecords,/JSON\.stringify\(state\.inventoryHolds\)!==JSON\.stringify\(merged\.inventoryHolds\)/);
  assert.match(orderRecords,/migrateInventorySupplierShadow/);
  assert.match(orderRecords,/bumpDomainVersion\(ownerId,INVENTORY_SUPPLIER_DOMAIN\)/);
});

test('inventory return restock no longer falls back to generic workspace save',()=>{
  const start=crm.indexOf('async function updateOrder');
  const block=crm.slice(start,crm.indexOf('async function releaseInventoryHold',start));
  assert.match(block,/inspectReturnedOrder\(o,'Sellable'\)/);
  assert.doesNotMatch(block,/else await save\(next\)/);
});

test('Step 8E backup schema 4 exports relational authority and rebuilds relational domains on restore',()=>{
  assert.match(backup,/schemaVersion:4/);
  assert.match(backup,/source:'relational-core\+compatibility'/);
  assert.match(backup,/relationalCoreState\(ownerId\)/);
  assert.match(backup,/migrateCustomersOrdersShadow/);
  assert.match(backup,/migrateInventorySupplierShadow/);
  assert.match(backup,/migrateFinanceShadow/);
  assert.match(backup,/verifyRelationalParity/);
  assert.match(backup,/cutoverEnabled:true/);
});

test('Step 8F cutover only auto-enables after parity and explicit rollback stays distinguishable',()=>{
  assert.match(cutover,/enabled=verification\.ok/);
  assert.match(cutover,/stage-3-step-8-auto-cutover/);
  assert.match(cutover,/existing\.enabled_by/);
  assert.match(cutover,/RELATIONAL_PARITY_FAILED/);
  assert.match(cutoverRoute,/Only the owner can change relational cutover/);
});

test('migration health endpoint covers every migrated core domain',()=>{
  assert.match(migrationRoute,/getCustomersOrdersMigrationStatus/);
  assert.match(migrationRoute,/getInventorySupplierMigrationStatus/);
  assert.match(migrationRoute,/getFinanceMigrationStatus/);
  assert.match(migrationRoute,/verifyRelationalParity/);
});
