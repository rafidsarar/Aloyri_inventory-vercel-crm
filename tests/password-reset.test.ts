import test from 'node:test';
import assert from 'node:assert/strict';
import { PASSWORD_RESET_TTL_MS,passwordResetExpiry,passwordResetTokenValid,passwordResetUrl } from '../lib/password-reset.ts';

test('password reset tokens require exactly 64 lowercase hex characters',()=>{
  assert.equal(passwordResetTokenValid('a'.repeat(64)),true);
  assert.equal(passwordResetTokenValid('A'.repeat(64)),false);
  assert.equal(passwordResetTokenValid('a'.repeat(63)),false);
  assert.equal(passwordResetTokenValid('g'.repeat(64)),false);
});

test('password reset expiry is 30 minutes',()=>{
  const now=Date.parse('2026-09-30T00:00:00.000Z');
  assert.equal(Date.parse(passwordResetExpiry(now))-now,PASSWORD_RESET_TTL_MS);
});

test('password reset URL keeps the token only in the reset route',()=>{
  const token='b'.repeat(64);
  const url=new URL(passwordResetUrl('https://crm.example.com',token));
  assert.equal(url.origin,'https://crm.example.com');
  assert.equal(url.pathname,'/reset-password');
  assert.equal(url.searchParams.get('token'),token);
});
