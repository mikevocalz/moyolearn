/**
 * Read-only inventory for the Moyo Learn Better Auth -> Payload adapter move.
 *
 * Run from @acme/auth with DATABASE_URL set:
 *   pnpm --filter @acme/auth auth:adapter:preflight
 *
 * No schema changes, no credentials, no email addresses or user IDs are logged.
 * A green result is ONLY an inventory result, never permission to cut over.
 */
import { pathToFileURL } from 'node:url';
import { Client } from 'pg';

const AUTH_TABLES = ['user', 'account', 'session', 'verification', 'organization', 'member', 'invitation', 'subscription'];
const PAYLOAD_TABLES = ['users', 'guardianships', 'consents', 'families', 'organizations'];
const REQUIRED = {
  'better_auth.user': ['id', 'email', 'emailVerified', 'guardianManaged', 'aiEnabled'],
  'better_auth.account': ['id', 'userId', 'providerId', 'accountId'],
  'better_auth.session': ['id', 'userId', 'token'],
  'better_auth.organization': ['id', 'slug'],
  'better_auth.member': ['id', 'organizationId', 'userId', 'role'],
  'better_auth.subscription': ['id', 'referenceId'],
  'payload.users': ['id', 'email'],
};

const key = (schema, table) => schema + '.' + table;

/**
 * Pure assessment function, separately testable without a database.
 * Column names are deliberately case-sensitive: Better Auth uses camelCase,
 * whereas Payload commonly maps fields to snake_case in PostgreSQL.
 */
export function assessInventory(columns, counts) {
  const present = new Map();
  for (const column of columns) {
    const name = key(column.table_schema, column.table_name);
    if (!present.has(name)) present.set(name, new Map());
    present.get(name).set(column.column_name, column);
  }

  const blockers = [];
  const findings = [];
  const neededTables = Object.keys(REQUIRED);
  for (const table of neededTables) {
    const fields = present.get(table);
    if (!fields) {
      blockers.push('Missing or inaccessible table: ' + table);
      continue;
    }
    for (const column of REQUIRED[table]) {
      if (!fields.has(column)) blockers.push('Missing required column: ' + table + '.' + column);
    }
  }

  const accountIssuer = present.get('better_auth.account')?.get('issuer');
  if (accountIssuer?.is_nullable === 'NO') {
    blockers.push(
      'better_auth.account.issuer is NOT NULL (1.7.2-era schema); do not upgrade Better Auth ' +
      'until its issuer index/constraint migration is generated, reviewed, and rehearsed.',
    );
  }

  const authIdType = present.get('better_auth.user')?.get('id')?.data_type;
  const payloadIdType = present.get('payload.users')?.get('id')?.data_type;
  if (authIdType && payloadIdType && authIdType !== payloadIdType) {
    blockers.push(
      'Identity ID types differ (' + authIdType + ' versus ' + payloadIdType +
      '); a verified ID mapping and all dependent reference rewrites are mandatory.',
    );
  }

  if ((counts['better_auth.user'] ?? 0) > 0) {
    blockers.push('Existing Better Auth identities require a one-to-one migration and sign-in rehearsal.');
  }
  if ((counts['payload.users'] ?? 0) > 0) {
    blockers.push('Existing Payload users require collision and admin-access reconciliation.');
  }
  if ((counts['better_auth.member'] ?? 0) > 0) {
    blockers.push('Organization memberships and tenant/host sign-in gates need equivalence tests.');
  }
  if ((counts['better_auth.subscription'] ?? 0) > 0) {
    blockers.push('Stripe subscriptions and entitlement lookups require reference preservation.');
  }
  if ((counts['better_auth.session'] ?? 0) > 0) {
    findings.push('Active/persisted sessions exist; plan a documented continuity or revocation window.');
  }
  if ((counts['payload.guardianships'] ?? 0) > 0) {
    blockers.push('Guardian-to-learner references need mapping and child-access regression tests.');
  }
  if ((counts['better_auth.guardian_managed'] ?? 0) > 0) {
    blockers.push('Guardian-managed learner flags and credential restrictions require an explicit backfill and tests.');
  }

  findings.push('This is a read-only structural inventory, NOT migration validation or permission to cut over.');
  findings.push('Preserve the Supabase-managed auth schema; do not point Better Auth at Supabase GoTrue.');
  return {
    cutoverApproved: false,
    blockerCount: blockers.length,
    blockers,
    findings,
    counts,
    types: { betterAuthUserId: authIdType ?? null, payloadUserId: payloadIdType ?? null },
  };
}

const QUERIES = [
  ['better_auth', 'user', 'better_auth."user"'],
  ['better_auth', 'account', 'better_auth."account"'],
  ['better_auth', 'session', 'better_auth."session"'],
  ['better_auth', 'organization', 'better_auth."organization"'],
  ['better_auth', 'member', 'better_auth."member"'],
  ['better_auth', 'subscription', 'better_auth."subscription"'],
  ['payload', 'users', 'payload.users'],
  ['payload', 'guardianships', 'payload.guardianships'],
];

/** All queries run in a read-only transaction. Table identifiers are hard-coded. */
export async function inspectDatabase(client) {
  await client.query('BEGIN READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout = '8000ms'");
    await client.query("SET LOCAL lock_timeout = '1000ms'");
    const columnResult = await client.query(
      "SELECT table_schema, table_name, column_name, data_type, is_nullable " +
      "FROM information_schema.columns WHERE table_schema IN ('better_auth', 'payload') " +
      'ORDER BY table_schema, table_name, ordinal_position',
    );
    const columns = columnResult.rows;
    const exists = new Set(columns.map((row) => key(row.table_schema, row.table_name)));
    const counts = {};

    for (const [schema, table, quoted] of QUERIES) {
      const name = key(schema, table);
      if (!exists.has(name)) continue;
      const result = await client.query('SELECT count(*)::bigint AS n FROM ' + quoted);
      counts[name] = Number(result.rows[0].n);
    }

    if (exists.has('better_auth.user')) {
      const fields = new Set(columns
        .filter((row) => row.table_schema === 'better_auth' && row.table_name === 'user')
        .map((row) => row.column_name));
      if (fields.has('guardianManaged')) {
        const result = await client.query(
          'SELECT count(*)::bigint AS n FROM better_auth."user" WHERE "guardianManaged" = TRUE',
        );
        counts['better_auth.guardian_managed'] = Number(result.rows[0].n);
      }
    }

    await client.query('COMMIT');
    return assessInventory(columns, counts);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required. No database was contacted.');
    process.exitCode = 1;
    return;
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await inspectDatabase(client);
    console.log(JSON.stringify(result, null, 2));
    if (result.blockerCount > 0) process.exitCode = 2;
  } catch (error) {
    // Do not print connection details, SQL parameters, credentials, or user data.
    console.error('Read-only auth preflight failed:', error instanceof Error ? error.name : 'UnknownError');
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
