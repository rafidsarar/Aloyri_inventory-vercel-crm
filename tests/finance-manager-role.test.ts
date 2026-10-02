import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roleCapabilities,roleCanEdit,roleCanManageFinance,roleCanCloseFinance,roleCanViewSection,roleLabels,type WorkspaceRole } from '../lib/roles.ts';

const team=readFileSync(new URL('../app/team.tsx',import.meta.url),'utf8');
const teamApi=readFileSync(new URL('../app/api/team/route.ts',import.meta.url),'utf8');
const crm=readFileSync(new URL('../app/crm.tsx',import.meta.url),'utf8');
const overview=readFileSync(new URL('../app/crm-sections/overview.tsx',import.meta.url),'utf8');
const finances=readFileSync(new URL('../app/crm-sections/finances.tsx',import.meta.url),'utf8');
const financeRoute=readFileSync(new URL('../app/api/finances/route.ts',import.meta.url),'utf8');
const financeRecords=readFileSync(new URL('../db/finance-records.ts',import.meta.url),'utf8');
const financeWorkflows=readFileSync(new URL('../db/finance-workflows.ts',import.meta.url),'utf8');
const orderWorkflows=readFileSync(new URL('../db/order-workflows.ts',import.meta.url),'utf8');
const inventoryWorkflows=readFileSync(new URL('../db/inventory-supplier-workflows.ts',import.meta.url),'utf8');
const inventoryRoute=readFileSync(new URL('../app/api/inventory-suppliers/route.ts',import.meta.url),'utf8');

test('Finance Manager is a first-class workspace role',()=>{
  const role:WorkspaceRole='finance';
  assert.equal(roleLabels[role],'Finance manager');
  assert.ok(roleCanViewSection(role,'Overview'));
  assert.ok(roleCanViewSection(role,'Finances'));
  assert.equal(roleCanManageFinance(role),true);
  assert.equal(roleCanCloseFinance(role),true);
  assert.equal(roleCapabilities.finance.team,false);
  assert.equal(roleCapabilities.finance.settings,false);
  assert.equal(roleCapabilities.finance.reset,false);
  assert.equal(roleCapabilities.finance.backup,false);
});

test('Finance Manager edits only finance domain keys',()=>{
  const allowed=['expenses','cashEntries','accountOpenings','accountMatches','financeCloses'];
  for(const key of allowed)assert.equal(roleCanEdit('finance',key),true,key);
  for(const key of ['orders','customers','products','productCategories','batches','suppliers','purchaseOrders','stockAdjustments','inventoryHolds','tasks','businessName','businessProfile','automationSettings'])
    assert.equal(roleCanEdit('finance',key),false,key);
});

test('Finance Manager has read-only supporting operational sections',()=>{
  for(const section of ['Orders','Inventory','Customers','Suppliers'])assert.equal(roleCanViewSection('finance',section),true,section);
  for(const section of ['Reports','Automation','Follow-ups','Activity'])assert.equal(roleCanViewSection('finance',section),false,section);
  assert.match(inventoryRoute,/\['owner','admin','inventory','finance','viewer'\]/);
});

test('team management can assign the Finance Manager role',()=>{
  assert.match(team,/\['admin','sales','inventory','finance','viewer'\]/);
  assert.match(teamApi,/\['admin','sales','inventory','finance','viewer'\]/);
});

test('Finance Manager is recognized at CRM session load and receives finance alerts',()=>{
  assert.match(crm,/\['owner','admin','sales','inventory','finance','viewer'\]\.includes\(d\.role\)/);
  assert.match(crm,/role==='finance'&&a\.role==='finance'/);
  assert.match(overview,/function FinanceWorkspace/);
  assert.match(overview,/p\.role==='finance'\)return <FinanceWorkspace/);
});

test('Finance Manager can post collections supplier payments and ordinary finance changes',()=>{
  assert.match(financeRecords,/\['owner','admin','finance'\]\.includes\(actor\.role\)/);
  assert.match(orderWorkflows,/\['owner','admin','finance'\]\.includes\(actor\.role\)[\s\S]*FINANCE_FORBIDDEN/);
  assert.match(inventoryWorkflows,/\['owner','admin','finance'\]\.includes\(actor\.role\)[\s\S]*FINANCE_FORBIDDEN/);
  assert.match(financeWorkflows,/reverseManualCashEntry[\s\S]*\['owner','admin','finance'\]\.includes\(actor\.role\)/);
  assert.match(financeRoute,/\['owner','admin','finance','viewer'\]/);
});

test('Owner capital and drawings remain restricted to owner or admin',()=>{
  assert.match(financeWorkflows,/postOwnerMoney[\s\S]*\['owner','admin'\]\.includes\(actor\.role\)/);
  assert.doesNotMatch(financeWorkflows,/postOwnerMoney[\s\S]{0,300}\['owner','admin','finance'\]/);
  assert.match(crm,/const canOwnerMoney=!recoveryMode&&\(role==='owner'\|\|role==='admin'\)/);
  assert.match(finances,/canOwnerMoney&&/);
  assert.match(financeRecords,/FINANCE_OWNER_MONEY_FORBIDDEN/);
  assert.match(financeRoute,/Owner capital and drawings can only be recorded by the owner or an admin/);
});
