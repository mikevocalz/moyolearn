// Reviewed release command; the deployment's DB secret stays in its environment.
// SOT: docs/pack/06-auth-onboarding-spec.md §4
// SOT-KEYWORDS: billing stripe organization additive migration schema preflight
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';

const modeSchema = z.enum(['--preflight', '--apply']);
const readinessSchema = z.object({
  organizationTableExists: z.boolean(),
  stripeCustomerIdPresent: z.boolean(),
  stripeCustomerIdCompatible: z.boolean(),
  readOnly: z.boolean(),
});

async function readReadiness(client: PoolClient) {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'better_auth' AND table_name = 'organization'
          AND table_type = 'BASE TABLE'
      ) AS "organizationTableExists",
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'better_auth' AND table_name = 'organization'
          AND column_name = 'stripeCustomerId'
      ) AS "stripeCustomerIdPresent",
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'better_auth' AND table_name = 'organization'
          AND column_name = 'stripeCustomerId'
          AND data_type = 'text' AND udt_schema = 'pg_catalog'
          AND udt_name = 'text' AND domain_name IS NULL
          AND is_nullable = 'YES' AND column_default IS NULL
          AND is_generated = 'NEVER' AND is_identity = 'NO'
      ) AS "stripeCustomerIdCompatible",
      current_setting('transaction_read_only') = 'on' AS "readOnly"
  `);
  return readinessSchema.parse(result.rows[0]);
}

async function main() {
  const mode = modeSchema.parse(process.argv[2]);
  if (process.argv.length !== 3) throw new Error('Use --preflight or --apply.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

  // Matches the existing marketing migration connection policy.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    const client = await pool.connect();
    try {
      await client.query(
        mode === '--preflight'
          ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
          : 'BEGIN',
      );
      await client.query("SET LOCAL statement_timeout = '5s'");
      await client.query("SET LOCAL lock_timeout = '5s'");

      if (mode === '--apply') {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('moyo-billing-organization-schema-v1', 0))",
        );
        await client.query(
          await readFile(
            new URL(
              '../../../packages/payload/migrations/better_auth_stripe_organization.sql',
              import.meta.url,
            ),
            'utf8',
          ),
        );
      }

      const readiness = await readReadiness(client);
      const ready =
        readiness.organizationTableExists &&
        readiness.stripeCustomerIdCompatible &&
        (mode !== '--preflight' || readiness.readOnly);
      console.log(
        JSON.stringify({
          mode: mode.slice(2),
          schema: 'better_auth',
          table: 'organization',
          column: 'stripeCustomerId',
          ...readiness,
          ready,
        }),
      );
      if (!ready) throw new Error('The organization billing schema is incompatible.');
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error('The billing schema command did not complete.');
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

// Raw driver errors can contain connection details; never print them in build logs.
try {
  await main();
} catch {
  console.error('Billing schema command failed. Use --preflight or --apply with the deployment database configured.');
  process.exitCode = 1;
}
