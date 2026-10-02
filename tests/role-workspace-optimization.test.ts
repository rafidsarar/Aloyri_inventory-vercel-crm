import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState } from '../lib/crm.ts';
import { roleCapabilities,roleCanEdit,roleCanViewSection,type WorkspaceRole } from '../lib/roles.ts';
import { visibleState } from '../lib/role-data.ts';

const crm=readFileSync(new URL('../app/crm.tsx',import.meta.url),'utf8');
const overview=readFileSync(new URL('../app/crm-sections/overview.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const customersRoute=readFileSync(new URL('../app/api/customers/route.ts',import.meta.url),'utf8');
const ordersRoute=readFileSync(new URL('../app/api/orders/route.ts',import.meta.url),'utf8');
const inventoryRoute=readFileSync(new URL('../app/api/inventory-suppliers/route.ts',import.meta.url),'utf8');
const financeRoute=readFileSync(new URL('../app/api/finances/route.ts',import.meta.url),'utf8');
const auditRoute=readFileSync(new URL('../app/api/audit/route.ts',import.meta.url),'utf8');
const growthRoute=readFileSync(new URL('../app/api/growth-control/route.ts',import.meta.url),'utf8');

test('every role has a dedicated Overview landing workspace',()=>{
  for(const role of ['owner','admin','sales','inventory','finance','viewer'] as WorkspaceRole[])
    assert.ok(roleCanViewSection(role,'Overview'),role+' should see Overview');
  assert.doesNotMatch(crm,/nextRole==='sales'\)setView\('Orders'\)/);
  assert.doesNotMatch(crm,/nextRole==='inventory'\)setView\('Inventory'\)/);
  assert.match(crm,/setView\('Overview'\)/);
  assert.match(crm,/role=\{role\}[\s\S]{0,120}alertCritical/);
});

test('sales permissions stay focused on orders customers and follow-ups',()=>{
  assert.deepEqual([...roleCapabilities.sales.edit],['orders','customers','tasks']);
  for(const section of ['Overview','Alerts','Orders','Customers','Follow-ups'])assert.ok(roleCanViewSection('sales',section));
  for(const section of ['Finances','Inventory','Suppliers','Reports','Automation','Activity'])assert.equal(roleCanViewSection('sales',section),false);
  for(const key of ['expenses','cashEntries','suppliers','purchaseOrders','batches'])assert.equal(roleCanEdit('sales',key),false);
});

test('inventory permissions stay focused on stock purchasing and returns',()=>{
  for(const section of ['Overview','Alerts','Inventory','Suppliers'])assert.ok(roleCanViewSection('inventory',section));
  for(const section of ['Orders','Customers','Finances','Reports','Automation','Activity'])assert.equal(roleCanViewSection('inventory',section),false);
  for(const key of ['products','productCategories','batches','suppliers','purchaseOrders','stockAdjustments','inventoryHolds'])assert.ok(roleCanEdit('inventory',key));
  for(const key of ['customers','expenses','cashEntries','tasks'])assert.equal(roleCanEdit('inventory',key),false);
});

test('viewer remains broad read-only while owner and admin retain management controls',()=>{
  assert.equal(roleCapabilities.viewer.edit.length,0);
  assert.equal(roleCapabilities.viewer.settings,false);
  assert.equal(roleCapabilities.viewer.finance,false);
  assert.equal(roleCapabilities.owner.audit,true);
  assert.equal(roleCapabilities.admin.audit,true);
  assert.equal(roleCapabilities.owner.team,true);
  assert.equal(roleCapabilities.admin.team,false);
});

test('operational staff data is still privacy filtered before reaching their browser',()=>{
  const state=initialState();
  state.customers=[{id:'c1',name:'Private Name',phone:'017',address:'Secret',city:'Dhaka',preference:'x',notes:'note',consent:true,created:'2026-01-01'}];
  state.suppliers=[{id:'s1',name:'Supplier',contact:'Person',phone:'018',email:'s@example.com',address:'Dhaka',leadDays:7,paymentTermsDays:30,notes:'',verified:true}];
  state.expenses=[{id:'e1',category:'Other',amount:100,date:'2026-01-01',notes:'',vendor:'',reference:'',recurring:'none',account:'cash'}];
  const sales=visibleState(state,'sales');
  const inventory=visibleState(state,'inventory');
  assert.equal(sales.suppliers.length,0);
  assert.equal(sales.expenses.length,0);
  assert.equal(inventory.customers[0].name,'Private customer');
  assert.equal(inventory.customers[0].phone,'');
  assert.equal(inventory.expenses.length,0);
});

test('role-specific overview never links staff into forbidden sections',()=>{
  const salesStart=overview.indexOf('function SalesWorkspace');
  const inventoryStart=overview.indexOf('function InventoryWorkspace');
  const financeStart=overview.indexOf('function FinanceWorkspace');
  const viewerStart=overview.indexOf('function ViewerWorkspace');
  const salesBlock=overview.slice(salesStart,inventoryStart);
  const inventoryBlock=overview.slice(inventoryStart,financeStart);
  assert.doesNotMatch(salesBlock,/changeView\('(Finances|Inventory|Suppliers|Reports|Automation|Activity)'\)/);
  assert.match(salesBlock,/changeView\('Orders'\)/);
  assert.match(salesBlock,/changeView\('Customers'\)/);
  assert.match(salesBlock,/changeView\('Follow-ups'\)/);
  assert.doesNotMatch(inventoryBlock,/changeView\('(Orders|Customers|Finances|Reports|Automation|Activity|Follow-ups)'\)/);
  assert.match(inventoryBlock,/changeView\('Inventory'\)/);
  assert.match(inventoryBlock,/changeView\('Suppliers'\)/);
});

test('viewer overview is explicitly read-only and contains no mutation callback props',()=>{
  const start=overview.indexOf('function ViewerWorkspace');
  const end=overview.indexOf('function SalesTrend',start);
  const block=overview.slice(start,end);
  assert.match(block,/Read-only overview/);
  assert.doesNotMatch(block,/openModal|save|update|delete|create|onNew/);
});

test('server APIs enforce the same role boundaries as the workspace UI',()=>{
  assert.match(customersRoute,/roleCanViewSection\(role,'Customers'\)/);
  assert.match(customersRoute,/roleCanEdit\(role,'customers'\)/);
  assert.match(ordersRoute,/roleCanViewSection\(role,'Orders'\)/);
  assert.match(ordersRoute,/roleCanEdit\(role,'orders'\)/);
  assert.match(inventoryRoute,/\['owner','admin','inventory','finance','viewer'\]/);
  assert.match(inventoryRoute,/\['owner','admin','inventory'\]/);
  assert.match(financeRoute,/\['owner','admin','finance','viewer'\]/);
  assert.match(financeRoute,/Only the owner, an admin or a finance manager can edit Finance/);
  assert.match(auditRoute,/roleCanViewAudit\(role\)/);
  assert.match(growthRoute,/roleCanViewAudit\(role\)/);
});

test('role workspaces reuse responsive dashboard grids for tablet and mobile',()=>{
  assert.match(css,/@media\(max-width:1000px\)\{\.overview-priority-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*\.overview-priority-grid,\.overview-work-grid\{grid-template-columns:1fr\}/);
});

test('production-facing business control API does not expose development-stage wording',()=>{
  assert.doesNotMatch(growthRoute,/Stage\s*\d/i);
});
