// The consent-verification store and mailer (doc 06 §3.1), as a repository.
//
// Rows are matched by ID and then by the guardian the service passes from the
// session; the code never reaches this module, only its hash. The mailer is
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
  async create(row) {
    const payload = await getPayload({ config });
    const doc = await payload.create({ collection: 'consent-verifications', data: { ...row } });
    return { id: String(doc.id) };
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
