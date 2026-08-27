// @acme/auth/server — the Better Auth instance of record (doc 06).
// Learners are real Better Auth users with restricted-account flags, never rows
// in a profile table (doc 06 §2). The restricted-account hooks below are the
// enforcement of that decision; §6 requires them to be test-covered.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §6 §7
// SOT-KEYWORDS: auth better-auth session username organization minor guardian restricted

import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';
import { stripe as stripePlugin } from '@better-auth/stripe';
import { haveIBeenPwned, multiSession, organization, username } from 'better-auth/plugins';
import Stripe from 'stripe';
import { Pool } from 'pg';
import { authorizeReference, isBillingRole, isPlanName, resolvePrices } from './billing-plans.ts';

/** Doc 06 §6: learner sessions expire sooner than adult ones. */
const ADULT_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const LEARNER_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Fields a guardian-created learner carries — doc 06 §110's `learnerFlags`.
 * `guardianManaged` is what every restricted-account hook keys off, so it is set
 * at creation and never by the account itself.
 *
 * `input: false` on all three is the load-bearing part: doc 07 §3 layer 1 says
 * the server injects the guardian's policy and "the client never supplies age
 * context". A field a sign-up body could set is a field a child could set.
 */
const learnerFields = {
  isMinor: { type: 'boolean', required: false, defaultValue: false, input: false },
  guardianManaged: { type: 'boolean', required: false, defaultValue: false, input: false },
  /**
   * Doc 07 §3 layer 1's guardian policy: AI tutoring on or off for this child.
   *
   * Defaults ON, and that direction is a decision rather than an oversight. The
   * plane's `refused` branch exists to honour a guardian who turned tutoring
   * OFF; defaulting the column off would refuse every learner who predates it,
   * which is a product outage dressed as a safety posture. Absence means "no
   * guardian has said otherwise", not "assume the worst".
   */
  aiEnabled: { type: 'boolean', required: false, defaultValue: true, input: false },
} as const;

/**
 * The guardian policy the Safety Plane's layer 1 needs, read from the learner's
 * own Better Auth row.
 *
 * Lives beside the auth instance for the same reason `readSubscriptions` does:
 * it reads a table `learnerFields` declares, so declaration and reader cannot
 * drift into two ideas of what a flag is called.
 *
 * It does NOT swallow a lookup failure. A guardian who switched AI off and a
 * database that cannot answer look identical from here, and defaulting to `true`
 * would turn the second into the first — the tutor would run for a child whose
 * parent had switched it off, every time the read failed. So a failure
 * propagates, and the caller wraps it in `safetyLayer('1-identity')`, which is
 * doc 12 §5's pause.
 *
 * A MISSING ROW is different and is not a failure: an account this build cannot
 * find has no guardian policy to honour, so it gets the default.
 */
export interface LearnerFlags {
  aiEnabled: boolean;
}

export async function readLearnerFlags(auth: Auth, userId: string): Promise<LearnerFlags> {
  const context = await auth.$context;
  const user = (await context.internalAdapter.findUserById(userId)) as
    | { aiEnabled?: boolean | null }
    | null
    | undefined;
  // `!== false` rather than `=== true`: null, undefined and a column that has
  // not been backfilled all mean "nobody has switched this off".
  return { aiEnabled: user?.aiEnabled !== false };
}

/**
 * A managed learner may never gain an email, link an OAuth account, or change
 * its own password — doc 06 §2 puts all three under the guardian, and support
 * may trigger a guardian-side reset but never see or set the password.
 *
 * Returning `false` from a `before` hook aborts the write.
 */
export function isRestrictedLearnerUpdate(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): boolean {
  if (!existing.guardianManaged) return false;
  return 'email' in incoming || 'emailVerified' in incoming;
}

/**
 * A managed learner may not link a social account. The credential provider is
 * the username/password row Better Auth writes at creation, so it is the one
 * `providerId` that stays allowed.
 */
export function isRestrictedLearnerAccountLink(
  owner: Record<string, unknown> | null | undefined,
  account: { providerId?: string },
): boolean {
  if (!owner?.guardianManaged) return false;
  return account.providerId !== 'credential';
}

/**
 * Doc 06 §2 puts a managed learner's password under the guardian. The block is
 * on the *learner acting on itself* — a guardian-initiated reset is the
 * supported path and must keep working, as must support triggering a
 * guardian-side reset (which never sets a password directly).
 */
export function isRestrictedLearnerPasswordChange(
  owner: Record<string, unknown> | null | undefined,
  actorId: string | undefined,
  incoming: Record<string, unknown>,
): boolean {
  if (!owner?.guardianManaged) return false;
  if (!('password' in incoming)) return false;
  return actorId === owner.id;
}

export function createAuth(options?: { connectionString?: string; schema?: string }) {
  const schema = options?.schema ?? 'auth';
  const connectionString = options?.connectionString ?? process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString,
    // Better Auth's kysely dialect has no schema option; pg's own search_path
    // is the native lever, and it keeps auth tables off the payload schema.
    options: `-c search_path=${schema}`,
    ssl: connectionString?.includes('supabase.co')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  return betterAuth({
    database: pool,
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    user: { additionalFields: learnerFields },
    session: { expiresIn: ADULT_SESSION_MAX_AGE },
    emailAndPassword: {
      enabled: true,
      // Doc 06 §6: 12+ chars, strength-estimated, no composition theater.
      minPasswordLength: 12,
      // Dev can sign up and sign in without an email adapter; verification is
      // still enforced in production builds.
      requireEmailVerification: process.env.NODE_ENV !== 'development',
    },
    databaseHooks: {
      user: {
        update: {
          before: async (user, ctx) => {
            const existing = (ctx?.context?.session?.user ?? {}) as Record<string, unknown>;
            if (isRestrictedLearnerUpdate(existing, user as Record<string, unknown>)) return false;
          },
        },
      },
      account: {
        create: {
          before: async (account, ctx) => {
            const owner = await ctx?.context?.internalAdapter?.findUserById(account.userId);
            if (isRestrictedLearnerAccountLink(owner as Record<string, unknown> | null, account)) {
              return false;
            }
          },
        },
        update: {
          before: async (account, ctx) => {
            if (!account.userId) return;
            const owner = await ctx?.context?.internalAdapter?.findUserById(account.userId);
            const actorId = ctx?.context?.session?.user?.id;
            if (
              isRestrictedLearnerPasswordChange(
                owner as Record<string, unknown> | null,
                actorId,
                account as Record<string, unknown>,
              )
            ) {
              return false;
            }
          },
        },
      },
      session: {
        create: {
          before: async (session, ctx) => {
            // A Session row carries userId, not the user's flags, so the owner
            // has to be read before the shorter learner expiry can be applied.
            const owner = await ctx?.context?.internalAdapter?.findUserById(session.userId);
            if (!(owner as Record<string, unknown> | null | undefined)?.guardianManaged) return;
            return {
              data: {
                ...session,
                expiresAt: new Date(Date.now() + LEARNER_SESSION_MAX_AGE * 1000),
              },
            };
          },
        },
      },
    },
    plugins: [
      // Child credentials are username-only: a learner account never carries an
      // email, so a non-identifying username is the whole credential (doc 06 §2).
      username(),
      // Orgs are born through ops onboarding, never self-serve (doc 06 §10).
      organization({ allowUserToCreateOrganization: false }),
      // The family shared-device switcher: guardian authenticates once, learner
      // sessions coexist, one tap swaps active (doc 06 §10).
      multiSession(),
      // Doc 06 §6 breached-password rejection.
      haveIBeenPwned(),
      expo(),
      ...billingPlugin(pool),
    ],
  });
}

/**
 * Doc 06 §4's config of record, wired. Returned as a TUPLE so Better Auth's
 * plugin inference survives the spread (same reason as the Expo fork), and
 * omitted entirely without keys: a dev machine with no Stripe account should run
 * the app, not fail to construct auth.
 */
function billingPlugin(pool: Pool): [] | [ReturnType<typeof stripePlugin>] {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) return [];

  const { priced } = resolvePrices();
  if (priced.length === 0) return [];

  return [
    stripePlugin({
      stripeClient: new Stripe(secret),
      stripeWebhookSecret: webhookSecret,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: priced.map(({ plan, priceId, annualPriceId }) => ({
          name: plan.name,
          priceId,
          ...(annualPriceId ? { annualDiscountPriceId: annualPriceId } : {}),
          freeTrial: { days: plan.trialDays },
          ...(plan.limits.payoutAutomation > 0 ? { limits: { ...plan.limits } } : {}),
        })),
        // The only thing between a member and their employer's billing page.
        // The rule itself is in billing-plans.ts, where it is tested without a
        // network; this is the adapter onto the plugin's callback shape.
        authorizeReference: async ({ user, referenceId, action }) => {
          const plan = typeof action === 'string' && isPlanName(action) ? action : null;
          // An organisation reference is never the acting user's own id, and the
          // role has to be READ — without it every ops purchase is refused,
          // including the owner's, which is the failure mode this lookup exists
          // to prevent.
          const membershipRole =
            referenceId === user.id ? undefined : await memberRole(pool, referenceId, user.id);

          if (!plan) {
            // Not a plan-scoped action (billing portal, cancel): the same two
            // ways through, so a member cannot open their employer's portal.
            return referenceId === user.id || isBillingRole(membershipRole);
          }
          return authorizeReference({ plan, referenceId, user: { id: user.id }, membershipRole }).ok;
        },
      },
    }),
  ];
}

/**
 * The acting user's role in an organisation, straight from the org plugin's own
 * table. Read here rather than passed in because `authorizeReference` is called
 * by the plugin, not by us — there is no call site to thread it through.
 *
 * Unqualified table name: the pool's search_path already points at the auth
 * schema. Quoted columns: Better Auth's kysely adapter writes camelCase.
 */
async function memberRole(pool: Pool, organizationId: string, userId: string) {
  const { rows } = await pool.query<{ role: string }>(
    'SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1',
    [organizationId, userId],
  );
  return rows[0]?.role;
}

export type Auth = ReturnType<typeof createAuth>;

/*
  The entitlement read lives beside the auth instance because it reads the auth
  instance's own tables. Re-exported HERE and not from the package barrel: the
  barrel is imported by screens, and a subscription read has no business in a
  client bundle.
*/
export {
  readSubscriptions,
  readSessionSubscriptions,
  toSubscriptionState,
  type SubscriptionRow,
} from './subscription-reader.ts';
