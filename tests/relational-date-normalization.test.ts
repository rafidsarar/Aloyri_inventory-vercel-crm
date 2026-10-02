import test from 'node:test';
import assert from 'node:assert/strict';
import { optionalRelationalDate, relationalDate } from '../db/relational-date.ts';

test('relationalDate preserves CRM YYYY-MM-DD values',()=>{
  assert.equal(relationalDate('2026-10-02'),'2026-10-02');
});

test('relationalDate normalizes database DATE timestamps',()=>{
  assert.equal(relationalDate('2026-10-02T00:00:00.000Z'),'2026-10-02');
  assert.equal(relationalDate(new Date('2026-10-02T00:00:00.000Z')),'2026-10-02');
});

test('optionalRelationalDate keeps nullable dates optional',()=>{
  assert.equal(optionalRelationalDate(null),undefined);
  assert.equal(optionalRelationalDate(''),undefined);
  assert.equal(optionalRelationalDate('2026-10-03T00:00:00.000Z'),'2026-10-03');
});
