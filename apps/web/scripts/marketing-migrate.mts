// Reviewed release command. Uses the deployment's DB secret without exporting it.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing migration release preflight owner organization entitlement
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { z } from 'zod';
import { can, entitlementsFor } from '@acme/auth/entitlements';
import { readBillingPreflight, toSubscriptionState } from '@acme/auth/server';

const mode = process.argv[2];
if (!['--apply', '--preflight', '--billing-preflight'].includes(mode))
  throw new Error('Use --apply, --preflight or --billing-preflight.');
if (mode === '--billing-preflight') {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new Error('Stripe is not configured.');
  try {
    console.log(
      JSON.stringify(
        await readBillingPreflight(
          process.env.STRIPE_SECRET_KEY,
          'https://app.moyolearn.com/api/auth/stripe/webhook',
          process.env.STRIPE_PRICE_OPS_STUDIO ??
            process.env.STRIPE_PRICE_OPS_SOLO ??
            process.env.STRIPE_PRICE_OPS_SCALE,
        ),
      ),
    );
  } catch {
    throw new Error(
      'Stripe billing preflight could not complete. No changes made.',
    );
  }
  process.exit(0);
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10000,
});
try {
  if (mode === '--preflight') {
    const email = z
      .email()
      .parse(process.env.MOYO_MARKETING_OWNER_EMAIL?.trim().toLowerCase());
    const account = await pool.query(
      'SELECT id FROM better_auth."user" WHERE lower(email)=$1 AND "emailVerified"=true AND coalesce("guardianManaged",false)=false AND coalesce("isMinor",false)=false',
      [email],
    );
    if ((account.rowCount ?? 0) > 1)
      throw new Error('The owner account is ambiguous. No changes made.');
    const organizations =
      account.rowCount === 1
        ? await pool.query(
            `SELECT o.id,o.name,m.role FROM better_auth.organization o JOIN better_auth.member m ON m."organizationId"=o.id WHERE m."userId"=$1 AND m.role IN ('owner','manager') ORDER BY o.id`,
            [account.rows[0].id],
          )
        : { rows: [] };
    const results = [];
    for (const org of organizations.rows) {
      const subscriptions = await pool.query(
        'SELECT plan,status FROM better_auth.subscription WHERE "referenceId"=$1',
        [org.id],
      );
      const states = subscriptions.rows.map((row) =>
        z
          .object({
            plan: z.string(),
            status: z.enum([
              'trialing',
              'active',
              'past_due',
              'canceled',
              'incomplete',
              'incomplete_expired',
              'unpaid',
              'paused',
            ]),
          })
          .parse(row),
      );
      results.push({
        id: z.string().parse(org.id),
        name: z.string().parse(org.name),
        role: z.string().parse(org.role),
        subscriptions: states,
        writeGranted: states.some((subscription) =>
          can(
            entitlementsFor(
              toSubscriptionState({
                ...subscription,
                referenceId: org.id,
                periodEnd: undefined,
                seats: undefined,
              }),
            ),
            'write',
          ),
        ),
      });
    }
    const usersTable = await pool.query(
      "SELECT to_regclass('payload.users') AS relation",
    );
    const internal = usersTable.rows[0]?.relation
      ? await pool.query(
          "SELECT id,to_jsonb(u)->>'role' AS role FROM payload.users u WHERE lower(email)=$1 LIMIT 2",
          [email],
        )
      : { rows: [] };
    if (internal.rows.length > 1)
      throw new Error(
        'The internal owner account is ambiguous. No changes made.',
      );
    const internalAccount = internal.rows[0]
      ? {
          id: String(internal.rows[0].id),
          role:
            typeof internal.rows[0].role === 'string' &&
            /^[a-zA-Z0-9_-]{1,64}$/.test(internal.rows[0].role)
              ? internal.rows[0].role
              : 'not-modeled',
        }
      : null;
    console.log(
      JSON.stringify({
        verifiedAdultAccount: account.rowCount === 1,
        organizations: results,
        internalAccount,
      }),
    );
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('moyo-marketing-schema-v1',0))",
      );
      await client.query(
        await readFile(
          new URL(
            '../../../packages/payload/migrations/signaliq_marketing_additive.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      await client.query('COMMIT');
      console.log('Moyo marketing additive schema is ready.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
