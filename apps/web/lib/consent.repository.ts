// The consent-verification store and mailer (doc 06 §3.1), as a repository.
//
// Rows are matched by ID and then by the guardian the service passes from the
// session; the code never reaches this module, only its hash. The two limits
// (sends per guardian, guesses per code) are enforced in SQL here so that
// concurrent requests cannot race past them; see `create` and `claimAttempt`. The mailer is
// the same Resend sender Better Auth's verification and reset mails use, with
// the same loud failure when it is not configured: a server with no sender
// cannot verify consent, and it has to say so rather than mint codes nobody
// receives.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1 §6 · packages/auth/src/consent-verification.ts
// SOT-KEYWORDS: consent repository payload verification store mailer resend hash
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import {
  consentCodeEmail,
  consentConfirmationEmail,
  readAuthEmailConfig,
  sendAuthEmail,
  ConsentVerificationError,
  type ConsentMailer,
  type ConsentVerificationRow,
  type ConsentVerificationStore,
} from '@acme/auth/server';
import type { ConsentVerification } from '@acme/payload';

const toRow = (doc: ConsentVerification): ConsentVerificationRow => ({
  id: String(doc.id),
  guardianAuthId: doc.guardianAuthId,
  method: doc.method,
  sentTo: doc.sentTo,
  codeHash: doc.codeHash,
  sentAt: doc.sentAt,
  attempts: doc.attempts,
  codeVerifiedAt: doc.codeVerifiedAt ?? null,
  confirmationSentAt: doc.confirmationSentAt ?? null,
  confirmedAt: doc.confirmedAt ?? null,
  recordedAt: doc.recordedAt ?? null,
  scope: doc.scope ?? null,
  policyVersion: doc.policyVersion ?? null,
  evidenceRef: doc.evidenceRef ?? null,
});

export const consentVerificationStore: ConsentVerificationStore = {
  /*
    COUNT AND INSERT UNDER ONE LOCK, IN SQL. The send limit is a
    read-then-write: through Payload's Local API (a `count` then a `create`)
    concurrent challenges would all count the same number and all insert. A
    transaction-scoped advisory lock keyed on the guardian serialises exactly
    those requests — the pattern `marketing.repository.ts` uses for its own
    per-key writes — and `payload.db.pool` is the one pool, as
    `jobs-health.repository.ts` notes. The collection has no hooks, so the
    insert skips nothing Payload would have run.
  */
  async create(row, limit) {
    const payload = await getPayload({ config });
    const client = await payload.db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `consent-send:${row.guardianAuthId}`,
      ]);
      const sent = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM payload.consent_verifications WHERE guardian_auth_id = $1 AND sent_at >= $2',
        [row.guardianAuthId, limit.since],
      );
      if ((sent.rows[0]?.n ?? 0) >= limit.max) {
        await client.query('ROLLBACK');
        return null;
      }
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO payload.consent_verifications
           (guardian_auth_id, method, sent_to, code_hash, sent_at, attempts, code_verified_at,
            confirmation_sent_at, confirmed_at, recorded_at, scope, policy_version, evidence_ref)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          row.guardianAuthId,
          row.method,
          row.sentTo,
          row.codeHash,
          row.sentAt,
          row.attempts,
          row.codeVerifiedAt,
          row.confirmationSentAt,
          row.confirmedAt,
          row.recordedAt,
          row.scope,
          row.policyVersion,
          row.evidenceRef,
        ],
      );
      await client.query('COMMIT');
      const id = inserted.rows[0]?.id;
      if (id === undefined) throw new Error('consent-verifications insert returned no id');
      return { id: String(id) };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  },

  async find(id) {
    // Ids are serials; a non-numeric claim matches nothing rather than erroring.
    if (!/^\d+$/.test(id)) return null;
    const payload = await getPayload({ config });
    const doc = await payload.findByID({ collection: 'consent-verifications', id: Number(id), disableErrors: true });
    return doc ? toRow(doc) : null;
  },

  async update(id, patch) {
    const payload = await getPayload({ config });
    await payload.update({ collection: 'consent-verifications', id: Number(id), data: { ...patch } });
  },

  /*
    ONE CONDITIONAL INCREMENT. Payload's `update` writes a value the caller
    computed from an earlier read, which is how concurrent guesses overwrote
    each other's counts; this lets Postgres do the arithmetic and the bound in
    the same statement, so no more than `max` guesses are ever paid for.
    `attempts` is `numeric` (the migration), hence the cast back.
  */
  async claimAttempt(id, max) {
    if (!/^\d+$/.test(id)) return null;
    const payload = await getPayload({ config });
    const result = await payload.db.pool.query<{ attempts: string }>(
      `UPDATE payload.consent_verifications
          SET attempts = attempts + 1, updated_at = now()
        WHERE id = $1 AND attempts < $2
        RETURNING attempts::text AS attempts`,
      [Number(id), max],
    );
    const attempts = result.rows[0]?.attempts;
    return attempts === undefined ? null : Number(attempts);
  },
};

/** Resend, through the auth-email module, or a 503 that names the gap. */
export const consentMailer: ConsentMailer = {
  async sendCode(to, code, idempotencyKey) {
    const sender = readAuthEmailConfig();
    if (!sender) {
      throw new ConsentVerificationError(
        'This server cannot send email yet, so permission cannot be verified. Set RESEND_API_KEY and AUTH_EMAIL_FROM.',
        503,
      );
    }
    await sendAuthEmail(sender, consentCodeEmail(to, code), { purpose: 'consent-code', idempotencyKey });
  },

  async sendConfirmation(to, idempotencyKey) {
    const sender = readAuthEmailConfig();
    if (!sender) {
      throw new ConsentVerificationError(
        'This server cannot send email yet, so permission cannot be verified. Set RESEND_API_KEY and AUTH_EMAIL_FROM.',
        503,
      );
    }
    await sendAuthEmail(sender, consentConfirmationEmail(to), { purpose: 'consent-confirm', idempotencyKey });
  },
};

export const consentDeps = { store: consentVerificationStore, mailer: consentMailer };
