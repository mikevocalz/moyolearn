// Server-side consent verification — the channel the consent machine in
// consent-flow.ts was written to be driven by, and the record it ends in.
//
// The machine decides whether a verified code still COUNTS (not expired, not
// burnt). Only whatever issued the code can say whether it is RIGHT, and until
// this file the issuer was the guardian's own device: the client minted a code,
// compared it, and then posted a consent record it had written itself. A
// consent record is evidence a regulator reads, and evidence the person being
// verified authored is not evidence (security finding H3).
//
// So the code is minted here, stored as a HASH with the handoff codes' domain
// separation, mailed by the server, compared by the server, and the record is
// written by the server with the guardian's identity taken from the session.
// Ordered like create-managed-learner next door: ports are structural so every
// rule runs without a database, and the only IO is the two port calls.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1 §6 · docs/pack/07-security-child-ai-safety-spec.md §2
// SOT-KEYWORDS: consent verification server code hash email-plus record guardian evidence h3

import { createHash, randomInt } from 'node:crypto';
import type { ConsentMethod } from './create-learner.ts';
import {
  completeConsent,
  isCodeExpired,
  verifyCode,
  CODE_TTL_MINUTES,
  MAX_CODE_ATTEMPTS,
  type CodeVerdict,
  type ConsentChallenge,
  type ConsentRecord,
} from './consent-flow.ts';

export const CONSENT_CODE_LENGTH = 6;

/**
 * How many codes one guardian may have sent in a rolling window. The target is
 * an address the guardian types, so without a ceiling a signed-in account is a
 * way to make Moyo mail anyone, repeatedly. Five an hour leaves room for a
 * typo, an expired code and a burnt one, which is every honest reason to ask
 * again; the same five-per-hour the marketing inquiry limit uses.
 */
export const CONSENT_SENDS_PER_WINDOW = 5;
export const CONSENT_SEND_WINDOW_MINUTES = 60;

/** The ceiling `create` enforces: fewer than `max` rows sent at or after `since`. */
export interface ConsentSendLimit {
  since: string;
  max: number;
}

/**
 * One row per verification attempt, from "code sent" to "record written". The
 * row IS the consent record once `recordedAt` is set: the learner route reads
 * `method`, `scope`, `policyVersion` and `evidenceRef` from here by id, never
 * from a request body.
 */
export interface ConsentVerificationRow {
  id: string;
  guardianAuthId: string;
  method: ConsentMethod;
  /** The guardian's own contact — never the child's. */
  sentTo: string;
  /** The HASH; the code lives only in the guardian's inbox for its TTL. */
  codeHash: string;
  sentAt: string;
  attempts: number;
  codeVerifiedAt: string | null;
  /** The "plus": the second message went out. */
  confirmationSentAt: string | null;
  confirmedAt: string | null;
  recordedAt: string | null;
  scope: string | null;
  policyVersion: string | null;
  evidenceRef: string | null;
}

/**
 * Only the reads and writes verification needs, so it runs without a database.
 *
 * The two limits are enforced by the store, not around it, because each is a
 * read-then-write that concurrent requests would otherwise race: `create`
 * counts this guardian's recent sends and inserts under one lock, and
 * `claimAttempt` spends a guess with one conditional increment. A check here
 * followed by a separate write lets N parallel requests all pass the check.
 */
export interface ConsentVerificationStore {
  /** Inserts the row, or answers null when its guardian has already hit `limit`. */
  create(row: Omit<ConsentVerificationRow, 'id'>, limit: ConsentSendLimit): Promise<{ id: string } | null>;
  find(id: string): Promise<ConsentVerificationRow | null>;
  update(id: string, patch: Partial<Omit<ConsentVerificationRow, 'id'>>): Promise<void>;
  /**
   * Atomically `attempts + 1` where `attempts < max`; the new count, or null
   * when the budget was already spent.
   */
  claimAttempt(id: string, max: number): Promise<number | null>;
}

/** The two mails, sent by whoever holds the sender config (apps/web does). */
export interface ConsentMailer {
  sendCode(to: string, code: string, idempotencyKey: string): Promise<void>;
  sendConfirmation(to: string, idempotencyKey: string): Promise<void>;
}

export interface ConsentVerificationDeps {
  store: ConsentVerificationStore;
  mailer: ConsentMailer;
}

/** Refusals carry the status the route should answer with; a 500 is a bug, not a refusal. */
export class ConsentVerificationError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Digits only — read off one device, typed into another, often across a kitchen. */
export function generateConsentCode(random: (max: number) => number = randomInt): string {
  let code = '';
  for (let i = 0; i < CONSENT_CODE_LENGTH; i += 1) code += String(random(10));
  return code;
}

/** What the table stores. Domain-separated from the handoff hash, which shares the alphabet. */
export function hashConsentCode(code: string): string {
  return createHash('sha256').update(`moyo-consent-code:${code.trim()}`).digest('hex');
}

/**
 * A retry key per (purpose, challenge, hash) that is useless to whoever holds
 * it — the same property `idempotencyKeyFor` in auth-email.ts has.
 */
export function consentIdempotencyKey(purpose: 'code' | 'confirm', challengeId: string, codeHash: string): string {
  return `consent-${purpose}-${createHash('sha256').update(`${challengeId}:${codeHash}`).digest('hex')}`;
}

const EMAIL_SHAPE = /.+@.+\..+/;

export interface ConsentChallengeIssue {
  challengeId: string;
  sentTo: string;
  expiresAt: string;
}

/**
 * Mint, store, mail. Email-plus only: it is the one method the server can
 * actually deliver. Text-plus has no SMS provider behind it, KBA has no bought
 * question source, and card needs billing — refusing them here is what keeps a
 * client that offers them from producing a record naming a method nobody ran.
 */
export async function startConsentChallenge(
  deps: ConsentVerificationDeps,
  input: { guardianAuthId: string; method: ConsentMethod; target: string },
  options: { now?: Date; random?: (max: number) => number } = {},
): Promise<ConsentChallengeIssue> {
  if (input.method !== 'email-plus') {
    throw new ConsentVerificationError(
      `${input.method} consent is not available on this server; verify by email instead.`,
      400,
    );
  }
  const sentTo = input.target.trim();
  if (!EMAIL_SHAPE.test(sentTo)) {
    throw new ConsentVerificationError('We need an email address to send the code to.', 400);
  }

  const now = options.now ?? new Date();
  const code = generateConsentCode(options.random);
  const codeHash = hashConsentCode(code);
  const created = await deps.store.create({
    guardianAuthId: input.guardianAuthId,
    method: input.method,
    sentTo,
    codeHash,
    sentAt: now.toISOString(),
    attempts: 0,
    codeVerifiedAt: null,
    confirmationSentAt: null,
    confirmedAt: null,
    recordedAt: null,
    scope: null,
    policyVersion: null,
    evidenceRef: null,
  }, {
    since: new Date(now.getTime() - CONSENT_SEND_WINDOW_MINUTES * 60_000).toISOString(),
    max: CONSENT_SENDS_PER_WINDOW,
  });
  if (!created) {
    throw new ConsentVerificationError(
      'You’ve asked for several codes in a short time. Wait a little while, then send a new one.',
      429,
    );
  }
  const { id } = created;
  await deps.mailer.sendCode(sentTo, code, consentIdempotencyKey('code', id, codeHash));
  return {
    challengeId: id,
    sentTo,
    expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString(),
  };
}

/**
 * The row as the machine sees it. The machine's shape is what every limit is
 * written against, so the row is projected onto it rather than the limits
 * being restated here.
 */
function toChallenge(row: ConsentVerificationRow): ConsentChallenge {
  return {
    method: row.method,
    sentTo: row.sentTo,
    sentAt: row.sentAt,
    attempts: row.attempts,
    codeVerified: row.codeVerifiedAt !== null,
    confirmed: row.confirmedAt !== null,
    askedIds: [],
    correct: 0,
    spentIds: [],
  };
}

/**
 * The row for this guardian, or a 404. The id is a resource CLAIM from the
 * client; the guardian is whoever the session says. A row another guardian
 * owns is reported absent, not forbidden, so ids cannot be probed.
 */
async function ownRow(
  store: ConsentVerificationStore,
  challengeId: string,
  guardianAuthId: string,
): Promise<ConsentVerificationRow> {
  const row = await store.find(challengeId);
  if (!row || row.guardianAuthId !== guardianAuthId) {
    throw new ConsentVerificationError('That verification was not found. Send a new code.', 404);
  }
  return row;
}

export interface ConsentVerifyResult {
  verdict: CodeVerdict;
  matched: boolean;
}

/**
 * Claim, then compare. The verdict is the machine's — expired and burnt refuse
 * a correct code, which is the whole point of having limits.
 *
 * THE GUESS IS PAID FOR BEFORE IT IS CHECKED. Reading `attempts`, comparing,
 * then writing the new count back let concurrent guesses all read the same
 * count and each write `count + 1`, so a burst of parallel requests got far
 * more than MAX_CODE_ATTEMPTS tries. `claimAttempt` is one conditional
 * increment, so at most MAX_CODE_ATTEMPTS requests ever reach the comparison,
 * however many arrive at once. A correct guess spends its slot too; once the
 * code is verified the count no longer matters.
 */
export async function verifyConsentCode(
  deps: ConsentVerificationDeps,
  input: { guardianAuthId: string; challengeId: string; code: string },
  options: { now?: Date } = {},
): Promise<ConsentVerifyResult> {
  const row = await ownRow(deps.store, input.challengeId, input.guardianAuthId);
  const now = options.now ?? new Date();
  const challenge = toChallenge(row);
  if (challenge.codeVerified) return { verdict: 'verified', matched: true };

  // Burnt and expired answer without spending anything, in the machine's order.
  if (challenge.attempts >= MAX_CODE_ATTEMPTS) return { verdict: 'burnt', matched: false };
  if (isCodeExpired(challenge, now)) return { verdict: 'expired', matched: false };

  const claimed = await deps.store.claimAttempt(row.id, MAX_CODE_ATTEMPTS);
  if (claimed === null) return { verdict: 'burnt', matched: false };

  // Judged against the count this request claimed, not the one it read.
  const matched = hashConsentCode(input.code) === row.codeHash;
  const result = verifyCode({ ...challenge, attempts: claimed - 1 }, matched, now);
  if (result.verdict === 'verified') {
    await deps.store.update(row.id, { codeVerifiedAt: now.toISOString() });
    return { verdict: 'verified', matched: true };
  }
  return { verdict: result.verdict, matched: false };
}

/**
 * The "plus": a SECOND, separate message after the first is verified. Refused
 * before verification, because a confirmation that did not follow a verified
 * first contact is one contact wearing a hat (consent-flow.ts, `confirm`).
 * Sent once; a repeat call is a no-op, not a second mail.
 */
export async function sendConsentConfirmation(
  deps: ConsentVerificationDeps,
  input: { guardianAuthId: string; challengeId: string },
  options: { now?: Date } = {},
): Promise<void> {
  const row = await ownRow(deps.store, input.challengeId, input.guardianAuthId);
  if (row.codeVerifiedAt === null) {
    throw new ConsentVerificationError('Verify the code before we send the confirmation.', 409);
  }
  if (row.confirmationSentAt !== null) return;
  const now = options.now ?? new Date();
  await deps.mailer.sendConfirmation(row.sentTo, consentIdempotencyKey('confirm', row.id, row.codeHash));
  await deps.store.update(row.id, { confirmationSentAt: now.toISOString() });
}

export interface RecordedConsent {
  consentId: string;
  record: ConsentRecord;
}

/**
 * Write the record. Requires the code verified AND the confirmation sent; the
 * guardian's "I confirmed it" is the acknowledgement the machine's `confirm`
 * models, and it is accepted only once the second message exists to confirm.
 * `completeConsent` mints the evidence reference, so the row says how consent
 * was obtained in the same words every other record uses. Idempotent: a
 * recorded row answers with its own id again rather than a second record.
 */
export async function recordConsent(
  deps: ConsentVerificationDeps,
  input: { guardianAuthId: string; challengeId: string; scope: string; policyVersion: string },
  options: { now?: Date } = {},
): Promise<RecordedConsent> {
  const row = await ownRow(deps.store, input.challengeId, input.guardianAuthId);
  const now = options.now ?? new Date();

  if (row.recordedAt !== null && row.scope && row.policyVersion && row.evidenceRef) {
    return {
      consentId: row.id,
      record: {
        method: row.method,
        scope: row.scope,
        policyVersion: row.policyVersion,
        evidenceRef: row.evidenceRef,
        verifiedAt: row.recordedAt,
      },
    };
  }
  if (row.codeVerifiedAt === null) {
    throw new ConsentVerificationError('That code has not been verified yet.', 409);
  }
  if (row.confirmationSentAt === null) {
    throw new ConsentVerificationError(
      'We still need to send the confirmation message before permission can be recorded.',
      409,
    );
  }
  if (isCodeExpired(toChallenge(row), now) && row.codeVerifiedAt === null) {
    throw new ConsentVerificationError('That code has expired. Send a new one.', 409);
  }

  const result = completeConsent(
    { ...toChallenge(row), codeVerified: true, confirmed: true },
    { scope: input.scope, policyVersion: input.policyVersion, now },
  );
  if (!result.ok) throw new ConsentVerificationError(result.reason, 400);

  await deps.store.update(row.id, {
    confirmedAt: now.toISOString(),
    recordedAt: result.record.verifiedAt,
    scope: result.record.scope,
    policyVersion: result.record.policyVersion,
    evidenceRef: result.record.evidenceRef,
  });
  return { consentId: row.id, record: result.record };
}

/** What `createManagedLearner` needs from a recorded row. */
export interface VerifiedConsent {
  method: ConsentMethod;
  scope: string;
  policyVersion: string;
  evidenceRef: string;
  verificationId: string;
}

/**
 * The record for this guardian, or null. The learner route calls this with
 * the id the client sent and the guardian the session says, and refuses the
 * child when it answers null — a consent record is read, never received.
 */
export async function readVerifiedConsent(
  store: ConsentVerificationStore,
  consentId: string,
  guardianAuthId: string,
): Promise<VerifiedConsent | null> {
  const row = await store.find(consentId);
  if (!row || row.guardianAuthId !== guardianAuthId) return null;
  if (row.recordedAt === null || !row.scope || !row.policyVersion || !row.evidenceRef) return null;
  return {
    method: row.method,
    scope: row.scope,
    policyVersion: row.policyVersion,
    evidenceRef: row.evidenceRef,
    verificationId: row.id,
  };
}

export { CODE_TTL_MINUTES, MAX_CODE_ATTEMPTS };
