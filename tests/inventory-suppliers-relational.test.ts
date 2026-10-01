import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const foundation=readFileSync(new URL('../db/relational-foundation.ts',import.meta.url),'utf8');
const shadow=readFileSync(new URL('../db/inventory-supplier-shadow.ts',import.meta.url),'utf8');
const records=readFileSync(new URL('../db/inventory-supplier-records.ts',import.meta.url),'utf8');
const workflows=readFileSync(new URL('../db/inventory-supplier-workflows.ts',import.meta.url),'utf8');
const domainRoute=readFileSync(new URL('../app/api/inventory-suppliers/route.ts',import.meta.url),'utf8');
const receiptRoute=readFileSync(new URL('../app/api/purchase-orders/[id]/receive/route.ts',import.meta.url),'utf8');
const paymentRoute=readFileSync(new URL('../app/api/inventory-batches/[id]/supplier-payment/route.ts',import.meta.url),'utf8');
const workspaceRoute=readFileSync(new URL('../app/api/workspace/route.ts',import.meta.url),'utf8');
const crm=readFileSync(new URL('../app/crm.tsx',import.meta.url),'utf8');

test('Step 6A relational foundation covers inventory and purchasing entities',()=>{
  for(const table of ['crm_rel_product_categories','crm_rel_products','crm_rel_suppliers','crm_rel_purchase_orders','crm_rel_purchase_order_items','crm_rel_batches','crm_rel_batch_payments','crm_rel_stock_adjustments','crm_rel_inventory_holds'])
    assert.ok(foundation.includes(table),table);
});

test('inventory supplier shadow migration is owner scoped and verified',()=>{
  assert.match(shadow,/INVENTORY_SUPPLIER_DOMAIN='inventory-suppliers'/);
  assert.match(shadow,/DELETE FROM/);
  assert.match(shadow,/status=\?/);
  assert.match(shadow,/verified/);
  assert.match(shadow,/migrateInventorySupplierShadow/);
});

test('Step 6B domain API limits writes to inventory supplier sections',()=>{
  assert.match(records,/inventorySupplierKeys=\['products','productCategories','suppliers','purchaseOrders','batches','stockAdjustments','inventoryHolds'\]/);
  assert.match(records,/stateSchema\.pick/);
  assert.match(records,/applyRoleChanges/);
  assert.match(records,/WORKSPACE_VERSION_CONFLICT/);
  assert.match(domainRoute,/\['owner','admin','inventory'\]/);
});

test('Step 6C frontend loads and saves Inventory Suppliers via domain endpoint',()=>{
  assert.match(crm,/fetch\('\/api\/inventory-suppliers'/);
  assert.match(crm,/async function saveInventorySupplierDomain/);
  assert.match(crm,/inventorySupplierOnlyMutation/);
  assert.match(crm,/if\(inventorySupplierOnlyMutation\(next\)\)return saveInventorySupplierDomain\(next\)/);
});

test('Step 6D purchase receiving is server side and updates PO plus batches',()=>{
  assert.match(workflows,/receivePurchaseOrderWorkflow/);
  assert.match(workflows,/applyPurchaseOrderReceipt/);
  assert.match(workflows,/\['purchaseOrders','batches'\]/);
  assert.match(receiptRoute,/receivePurchaseOrderWorkflow/);
  const start=crm.indexOf('async function submitPurchaseOrderReceipt');
  const block=crm.slice(start,crm.indexOf('function openOwnerMoney',start));
  assert.match(block,/\/api\/purchase-orders\//);
  assert.doesNotMatch(block,/applyPurchaseOrderReceipt\(s/);
});

test('Step 6D supplier payment is server side and reconciled',()=>{
  assert.match(workflows,/postSupplierPaymentWorkflow/);
  assert.match(workflows,/Supplier payment cannot exceed the outstanding purchase amount/);
  assert.match(workflows,/accountMatches\.push/);
  assert.match(paymentRoute,/postSupplierPaymentWorkflow/);
  const start=crm.indexOf('async function submitPayment');
  const block=crm.slice(start,crm.indexOf('function reverseCashEntry',start));
  assert.match(block,/\/supplier-payment/);
  assert.match(block,/paymentDialog\.kind==='collection'/);
});

test('Inventory hold and purchasing direct actions use domain saver',()=>{
  assert.match(crm,/releaseInventoryHold[\s\S]*saveInventorySupplierDomain/);
  assert.match(crm,/markInventoryHoldDamaged[\s\S]*saveInventorySupplierDomain/);
  assert.match(crm,/bulkSendPurchaseOrders[\s\S]*saveInventorySupplierDomain/);
  assert.match(crm,/createPurchaseOrder[\s\S]*saveInventorySupplierDomain/);
});

test('Step 6E legacy workspace saves maintain inventory supplier shadow',()=>{
  assert.match(workspaceRoute,/inventorySupplierSectionsChanged/);
  assert.match(workspaceRoute,/migrateInventorySupplierShadow/);
  assert.match(workspaceRoute,/markInventorySupplierShadowStale/);
  assert.match(workspaceRoute,/inventorySupplierSync/);
});
