import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { customerSchema } from '../lib/crm.ts';
import { roleCanEdit, roleCanViewSection } from '../lib/roles.ts';

const persistence=readFileSync(new URL('../db/customer-records.ts',import.meta.url),'utf8');
const listRoute=readFileSync(new URL('../app/api/customers/route.ts',import.meta.url),'utf8');
const detailRoute=readFileSync(new URL('../app/api/customers/[id]/route.ts',import.meta.url),'utf8');

test('customer record API validates the existing CRM customer shape',()=>{
  const parsed=customerSchema.parse({
    id:'c1',name:'Customer',phone:'01700000000',address:'Dhaka',city:'Dhaka',
    preference:'Sensitive skin',notes:'',consent:true,created:'2026-10-02'
  });
  assert.equal(parsed.id,'c1');
  assert.throws(()=>customerSchema.parse({...parsed,name:''}));
});

test('customer API access follows the existing role matrix',()=>{
  for(const role of ['owner','admin','sales'] as const)assert.equal(roleCanEdit(role,'customers'),true);
  for(const role of ['inventory','viewer'] as const)assert.equal(roleCanEdit(role,'customers'),false);
  for(const role of ['owner','admin','sales','viewer'] as const)assert.equal(roleCanViewSection(role,'Customers'),true);
  assert.equal(roleCanViewSection('inventory','Customers'),false);
});

test('customer updates use per-record optimistic version checks',()=>{
  assert.match(persistence,/record_version=record_version\+1/);
  assert.match(persistence,/WHERE owner_id=\? AND id=\? AND record_version=\?/);
  assert.match(persistence,/CUSTOMER_VERSION_CONFLICT/);
  assert.ok(detailRoute.includes('409'));
});

test('customer persistence keeps relational and JSON compatibility writes in one transaction',()=>{
  assert.match(persistence,/db\.batch\(\[/);
  assert.match(persistence,/UPDATE crm_rel_customers/);
  assert.match(persistence,/UPDATE crm_workspaces SET data=\?,version=version\+1/);
  assert.match(persistence,/crm_relational_migrations/);
  assert.match(persistence,/crm_audit_log/);
  assert.doesNotMatch(persistence,/ELSE 1\/0/);
  assert.match(persistence,/SELECT 1 \/ CASE WHEN/);
});

test('customer deletion protects referenced records',()=>{
  assert.match(persistence,/linked to existing orders and cannot be deleted/);
  assert.match(persistence,/linked to follow-ups and cannot be deleted/);
});

test('customer mutation routes require origin checks and edit permission',()=>{
  assert.match(listRoute,/checkOrigin\(request\)/);
  assert.match(listRoute,/roleCanEdit\(role,'customers'\)/);
  assert.match(detailRoute,/checkOrigin\(request\)/);
  assert.match(detailRoute,/roleCanEdit\(role,'customers'\)/);
});
