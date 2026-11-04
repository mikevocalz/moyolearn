import test from 'node:test';
import assert from 'node:assert/strict';
import { assessInventory, inspectDatabase } from './payload-adapter-preflight.mjs';

const fixture = [
  ['better_auth', 'user', 'id', 'text'],
  ['better_auth', 'user', 'email', 'text'],
  ['better_auth', 'user', 'emailVerified', 'boolean'],
  ['better_auth', 'user', 'guardianManaged', 'boolean'],
  ['better_auth', 'user', 'aiEnabled', 'boolean'],
  ['better_auth', 'account', 'id', 'text'],
  ['better_auth', 'account', 'userId', 'text'],
  ['better_auth', 'account', 'providerId', 'text'],
  ['better_auth', 'account', 'accountId', 'text'],
  ['better_auth', 'account', 'issuer', 'text'],
  ['better_auth', 'session', 'id', 'text'],
  ['better_auth', 'session', 'userId', 'text'],
  ['better_auth', 'session', 'token', 'text'],
  ['better_auth', 'organization', 'id', 'text'],
  ['better_auth', 'organization', 'slug', 'text'],
  ['better_auth', 'member', 'id', 'text'],
  ['better_auth', 'member', 'organizationId', 'text'],
  ['better_auth', 'member', 'userId', 'text'],
  ['better_auth', 'member', 'role', 'text'],
  ['better_auth', 'subscription', 'id', 'text'],
  ['better_auth', 'subscription', 'referenceId', 'text'],
  ['payload', 'users', 'id', 'integer'],
  ['payload', 'users', 'email', 'text'],
].map(([table_schema, table_name, column_name, data_type]) => ({
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable: 'YES',
}));

test('missing auth schemas stop the preflight; green never approves a cutover', () => {
  const result = assessInventory([], {});
  assert.equal(result.cutoverApproved, false);
  assert.ok(result.blockers.some((item) => item.includes('better_auth.user')));
  assert.ok(result.blockers.some((item) => item.includes('payload.users')));
});

test('populated Moyo schemas flag ID mapping, issuer constraint and child/tenant data', () => {
  const columns = fixture.map((item) =>
    item.column_name === 'issuer' ? { ...item, is_nullable: 'NO' } : item,
  );
  const result = assessInventory(columns, {
    'better_auth.user': 20,
    'payload.users': 5,
    'better_auth.member': 10,
    'better_auth.subscription': 3,
    'better_auth.session': 4,
    'payload.guardianships': 6,
    'better_auth.guardian_managed': 7,
  });

  assert.equal(result.cutoverApproved, false);
  assert.ok(result.blockers.some((item) => item.includes('issuer is NOT NULL')));
  assert.ok(result.blockers.some((item) => item.includes('ID types differ')));
  assert.ok(result.blockers.some((item) => item.includes('Guardian-managed')));
  assert.ok(result.blockers.some((item) => item.includes('Organization memberships')));
  assert.ok(result.blockers.some((item) => item.includes('Stripe subscriptions')));
  assert.ok(!JSON.stringify(result).includes('learners.invalid'));
});

test('read-only inventory issues no mutating SQL and returns only aggregate counts', async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('information_schema.columns')) return { rows: fixture };
      if (sql.includes('guardianManaged')) return { rows: [{ n: '2' }] };
      if (sql.startsWith('SELECT count(')) return { rows: [{ n: '3' }] };
      return { rows: [] };
    },
  };
  const result = await inspectDatabase(client);
  assert.equal(result.counts['better_auth.user'], 3);
  assert.equal(result.counts['better_auth.guardian_managed'], 2);
  assert.equal(queries[0], 'BEGIN READ ONLY');
  assert.equal(queries.at(-1), 'COMMIT');
  assert.ok(queries.every((sql) => /^(BEGIN READ ONLY|SET LOCAL |SELECT |COMMIT)$/.test(sql) ||
    /^(BEGIN READ ONLY|SET LOCAL |SELECT |COMMIT)/.test(sql)));
  assert.ok(!JSON.stringify(result).includes('password'));
});

test('a failed inspection rolls back the read-only transaction', async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('information_schema.columns')) throw new Error('masked database failure');
      return { rows: [] };
    },
  };
  await assert.rejects(inspectDatabase(client), /masked database failure/);
  assert.equal(queries.at(-1), 'ROLLBACK');
});
