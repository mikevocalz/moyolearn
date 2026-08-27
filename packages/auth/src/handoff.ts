// Device handoff — doc 36 §2's "a child never types an email or password".
// The guardian's device mints a short code; the learner device redeems it and
// the redemption IS the sign-in: the code maps to a one-time credential this
// module rotates onto the learner account, so Better Auth's own username
// sign-in issues the session and no second auth path exists.
//
// Ordered like create-managed-learner next door: ports are structural so the
// logic runs without a database, and the code at rest is a HASH — a leaked
// handoff table must not be a list of live child credentials.
// SOT: docs/pack/36-role-navigation-flows.md §2 · docs/pack/06-auth-onboarding-spec.md §2
// SOT-KEYWORDS: device handoff code redeem qr short code learner session one-time credential rotate

import { createHash, randomInt } from 'node:crypto';
import type { Auth } from './server';
import {
  HANDOFF_CODE_ALPHABET,
  HANDOFF_CODE_LENGTH,
  HANDOFF_TTL_MS,
  handoffUrl,
  isWellFormedHandoffCode,
  normalizeHandoffCode,
} from './handoff-code.ts';

export {
  HANDOFF_CODE_ALPHABET,
  HANDOFF_CODE_LENGTH,
  HANDOFF_TTL_MS,
  handoffUrl,
  isWellFormedHandoffCode,
  normalizeHandoffCode,
} from './handoff-code.ts';

export function generateHandoffCode(): string {
  let code = '';
  for (let i = 0; i < HANDOFF_CODE_LENGTH; i++) {
    code += HANDOFF_CODE_ALPHABET[randomInt(HANDOFF_CODE_ALPHABET.length)];
  }
  return code;
}

/** What the table stores. Never the code itself. */
export function hashHandoffCode(code: string): string {
  return createHash('sha256').update(`moyo-handoff-lookup:${normalizeHandoffCode(code)}`).digest('hex');
}

/**
 * The one-time credential the code stands for. Domain-separated from the
 * lookup hash so the stored hash can never be replayed as the password.
 */
export function handoffSecret(code: string): string {
  return createHash('sha256').update(`moyo-handoff-secret:${normalizeHandoffCode(code)}`).digest('hex');
}

/** Only the reads/writes handoff needs, so it runs without a database. */
export interface HandoffStore {
  create(row: {
    codeHash: string;
    learnerAuthId: string;
    guardianAuthId: string;
    expiresAt: string;
  }): Promise<void>;
  /** The unredeemed, unexpired row for a hash — or null, which is every failure. */
  findActive(codeHash: string, now: Date): Promise<{ id: string; learnerAuthId: string } | null>;
  markRedeemed(id: string, at: Date): Promise<void>;
}

export interface GuardianshipReader {
  isActiveGuardian(guardianAuthId: string, learnerAuthId: string): Promise<boolean>;
}

export class HandoffError extends Error {}

export interface HandoffIssue {
  code: string;
  url: string;
  expiresAt: string;
}

/**
 * Mint a code for one of the caller's own wards. The guardian id comes from
 * `ctx` at the service boundary (identity is never a parameter a client fills);
 * `learnerAuthId` is a RESOURCE claim and is verified here against the active
 * guardianship rows — and against `guardianManaged`, so a code can never be
 * minted onto an adult account.
 */
export async function createDeviceHandoff(
  auth: Auth,
  deps: { store: HandoffStore; guardianships: GuardianshipReader },
  input: { guardianAuthId: string; learnerAuthId: string },
  now: Date = new Date(),
): Promise<HandoffIssue> {
  const isGuardian = await deps.guardianships.isActiveGuardian(input.guardianAuthId, input.learnerAuthId);
  if (!isGuardian) throw new HandoffError('Not an active guardian of this learner.');

  const ctx = await auth.$context;
  const learner = await ctx.internalAdapter.findUserById(input.learnerAuthId);
  const managed = (learner as { guardianManaged?: boolean } | null)?.guardianManaged;
  if (!managed) throw new HandoffError('Handoff codes exist only for guardian-managed learners.');

  const code = generateHandoffCode();
  /*
    Rotating the credential BEFORE writing the row: a row whose secret was never
    set is a code that can never sign anyone in (fail closed); the reverse order
    would leave a window where the account's password is the derived secret with
    no expiry record governing it.
  */
  const hashed = await ctx.password.hash(handoffSecret(code));
  await ctx.internalAdapter.updatePassword(input.learnerAuthId, hashed);

  const expiresAt = new Date(now.getTime() + HANDOFF_TTL_MS).toISOString();
  await deps.store.create({
    codeHash: hashHandoffCode(code),
    learnerAuthId: input.learnerAuthId,
    guardianAuthId: input.guardianAuthId,
    expiresAt,
  });

  return { code, url: handoffUrl(code), expiresAt };
}

/**
 * Redeem a code: burn it, then sign the learner in through Better Auth's own
 * username path. Returns the sign-in `Response` (session cookie and all) or
 * null for ANY failure — malformed, expired, redeemed, unknown. One outcome
 * for every miss, so the endpoint cannot become an oracle for which codes
 * exist.
 */
export async function redeemDeviceHandoff(
  auth: Auth,
  deps: { store: HandoffStore },
  rawCode: string,
  now: Date = new Date(),
): Promise<Response | null> {
  if (!isWellFormedHandoffCode(rawCode)) return null;
  const code = normalizeHandoffCode(rawCode);

  const row = await deps.store.findActive(hashHandoffCode(code), now);
  if (!row) return null;

  /*
    Burned BEFORE the sign-in attempt, not after: single-use means a failed
    sign-in consumes the code too. The alternative leaves a retryable credential
    alive for the rest of its TTL, which is a brute-force budget.
  */
  await deps.store.markRedeemed(row.id, now);

  const ctx = await auth.$context;
  const learner = await ctx.internalAdapter.findUserById(row.learnerAuthId);
  const username = (learner as { username?: string } | null)?.username;
  if (!username) return null;

  return auth.api.signInUsername({
    body: { username, password: handoffSecret(code) },
    asResponse: true,
  });
}
