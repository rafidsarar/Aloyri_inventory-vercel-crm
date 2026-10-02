import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authFoundation=readFileSync(new URL('../db/auth-foundation.ts',import.meta.url),'utf8');
const teamRoute=readFileSync(new URL('../app/api/team/route.ts',import.meta.url),'utf8');
const initSql=readFileSync(new URL('../sql/001_init.sql',import.meta.url),'utf8');

test('existing CRM user role constraint is migrated to include Finance Manager',()=>{
  assert.match(authFoundation,/DROP CONSTRAINT IF EXISTS crm_users_role_check/);
  assert.match(authFoundation,/CHECK \(role IN \('owner','admin','sales','inventory','finance','viewer'\)\)/);
  assert.match(authFoundation,/db\.batch\(/);
});

test('team access applies role constraint migration before staff reads and writes',()=>{
  const uses=[...teamRoute.matchAll(/await ensureWorkspaceRoleConstraint\(\)/g)];
  assert.ok(uses.length>=2,'team GET and POST should both ensure the role constraint');
});

test('fresh database setup includes Finance Manager in crm_users constraint',()=>{
  assert.match(initSql,/role TEXT NOT NULL CHECK \(role IN \('owner','admin','sales','inventory','finance','viewer'\)\)/);
});
