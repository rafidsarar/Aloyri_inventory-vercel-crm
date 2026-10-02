import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration=readFileSync(new URL('../sql/migrations/003_finance_manager_role.sql',import.meta.url),'utf8');
const baseline=readFileSync(new URL('../sql/migrations/001_baseline.sql',import.meta.url),'utf8');
const teamRoute=readFileSync(new URL('../app/api/team/route.ts',import.meta.url),'utf8');
const migrateRunner=readFileSync(new URL('../scripts/migrate-db.ts',import.meta.url),'utf8');
const vercel=readFileSync(new URL('../vercel.json',import.meta.url),'utf8');

test('versioned role migration includes Finance Manager',()=>{
  assert.match(migration,/DROP CONSTRAINT IF EXISTS crm_users_role_check/);
  assert.match(migration,/CHECK \(role IN \('owner','admin','sales','inventory','finance','viewer'\)\)/);
});

test('baseline schema includes Finance Manager',()=>{
  assert.match(baseline,/role TEXT NOT NULL CHECK \(role IN \('owner','admin','sales','inventory','finance','viewer'\)\)/);
});

test('team requests no longer mutate database schema',()=>{
  assert.doesNotMatch(teamRoute,/ALTER TABLE|ensureWorkspaceRoleConstraint|CREATE TABLE/);
});

test('deployment runner records versioned migrations',()=>{
  assert.match(migrateRunner,/crm_schema_migrations/);
  assert.match(migrateRunner,/INSERT INTO crm_schema_migrations/);
  assert.match(vercel,/pnpm db:migrate && pnpm build/);
});
