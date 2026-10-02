import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth=readFileSync(new URL('../app/local-auth.ts',import.meta.url),'utf8');
const login=readFileSync(new URL('../app/api/auth/login/route.ts',import.meta.url),'utf8');
const password=readFileSync(new URL('../app/api/auth/password/route.ts',import.meta.url),'utf8');
const sessions=readFileSync(new URL('../app/api/auth/sessions/route.ts',import.meta.url),'utf8');
const recovery=readFileSync(new URL('../app/api/recovery/status/route.ts',import.meta.url),'utf8');
const backup=readFileSync(new URL('../app/api/workspace/backup/route.ts',import.meta.url),'utf8');
const headers=readFileSync(new URL('../next.config.ts',import.meta.url),'utf8');
const watchdog=readFileSync(new URL('../.github/workflows/production-watchdog.yml',import.meta.url),'utf8');
const acceptance=readFileSync(new URL('../app/api/acceptance/route.ts',import.meta.url),'utf8');
const smoke=readFileSync(new URL('../.github/workflows/production-smoke.yml',import.meta.url),'utf8');
const migration=readFileSync(new URL('../sql/migrations/006_session_security_recovery.sql',import.meta.url),'utf8');

test('sessions store device metadata and support bounded lifecycle cleanup',()=>{
  assert.match(migration,/ADD COLUMN IF NOT EXISTS user_agent/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS last_seen_at/);
  assert.match(auth,/user_agent,last_seen_at/);
  assert.match(auth,/DELETE FROM crm_sessions WHERE expires_at<=\?/);
  assert.match(auth,/DELETE FROM crm_login_attempts WHERE expires_at<=\?/);
});

test('session API never exposes full token hashes and scopes revocation to the signed-in user',()=>{
  assert.match(sessions,/id:row\.token_hash\.slice\(0,16\)/);
  assert.match(sessions,/WHERE user_id=\? AND LEFT\(token_hash,16\)=\?/);
  assert.doesNotMatch(sessions,/token_hash:row\.token_hash/);
});

test('users can review and revoke only their own active sessions',()=>{
  assert.match(sessions,/WHERE user_id=\? AND expires_at>\?/);
  assert.match(sessions,/action==='revokeOthers'/);
  assert.match(sessions,/action==='revokeOne'/);
  assert.match(sessions,/action==='revokeAll'/);
  assert.match(sessions,/Use Sign out to end your current session/);
});

test('password changes have a separate brute-force limiter and revoke all sessions',()=>{
  assert.match(password,/password-change:/);
  assert.match(password,/attempts>=5/);
  assert.match(password,/Too many password attempts/);
  assert.match(password,/DELETE FROM crm_sessions WHERE user_id=\?/);
  assert.match(password,/auth\.password_changed/);
});

test('auth events and failed logins are audited',()=>{
  assert.match(migration,/CREATE TABLE IF NOT EXISTS crm_security_events/);
  assert.match(login,/auth\.login_failed/);
  assert.match(login,/auth\.login_success/);
  assert.match(auth,/recordSecurityEvent/);
});

test('browser hardening includes cross-origin isolation headers and inline event blocking',()=>{
  assert.match(headers,/Cross-Origin-Resource-Policy/);
  assert.match(headers,/X-DNS-Prefetch-Control/);
  assert.match(headers,/script-src-attr 'none'/);
});

test('verified backup exports establish recovery readiness metadata',()=>{
  assert.match(migration,/CREATE TABLE IF NOT EXISTS crm_backup_events/);
  assert.match(backup,/action==='recordExport'/);
  assert.match(backup,/INSERT INTO crm_backup_events/);
  assert.match(recovery,/recentBackup/);
  assert.match(recovery,/ageHours/);
  assert.match(recovery,/verifyRelationalParity/);
});

test('hourly production watchdog verifies health acceptance and security headers',()=>{
  assert.match(watchdog,/cron: '17 \* \* \* \*'/);
  assert.match(watchdog,/api\/health/);
  assert.match(watchdog,/api\/acceptance/);
  assert.match(watchdog,/content-security-policy/);
  assert.match(watchdog,/cross-origin-resource-policy/);
});

test('production acceptance and smoke require security and recovery infrastructure',()=>{
  assert.match(acceptance,/securityInfrastructureReady/);
  assert.match(acceptance,/recoveryTrackingReady/);
  assert.match(smoke,/securityInfrastructureReady/);
  assert.match(smoke,/recoveryTrackingReady/);
});
