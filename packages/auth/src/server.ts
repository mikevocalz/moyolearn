// @acme/auth/server — the Better Auth instance of record (doc 06).
// Learners are real Better Auth users with restricted-account flags, never rows
// in a profile table (doc 06 §2). The restricted-account hooks below are the
// enforcement of that decision; §6 requires them to be test-covered.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §6 §7
// SOT-KEYWORDS: auth better-auth session username organization minor guardian restricted

import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';
import { haveIBeenPwned, multiSession, organization, username } from 'better-auth/plugins';
import { Pool } from 'pg';

/** Doc 06 §6: learner sessions expire sooner than adult ones. */
const ADULT_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const LEARNER_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Fields a guardian-created learner carries. `guardianManaged` is what every
 * restricted-account hook keys off, so it is set at creation and never by the
 * account itself.
 */
const learnerFields = {
  isMinor: { type: 'boolean', required: false, defaultValue: false, input: false },
  guardianManaged: { type: 'boolean', required: false, defaultValue: false, input: false },
} as const;

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
  const pool = new Pool({
    connectionString: options?.connectionString ?? process.env.DATABASE_URL,
    // Better Auth's kysely dialect has no schema option; pg's own search_path
    // is the native lever, and it keeps auth tables off the payload schema.
    options: `-c search_path=${schema}`,
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
      requireEmailVerification: true,
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
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
