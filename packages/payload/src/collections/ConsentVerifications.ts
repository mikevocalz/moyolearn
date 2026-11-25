import type { CollectionConfig } from 'payload';

// Server-side consent verification (doc 06 §3.1, security finding H3): one
// row per attempt, from "code sent" to "record written". What lives here is a
// HASH of the code plus lifecycle timestamps; the code itself exists only in
// the guardian's inbox for its fifteen-minute TTL. Once `recordedAt` is set the
// row IS the verified consent, and /api/family/learners reads the grant from
// it by id — never from a request body.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1 §6 · packages/auth/src/consent-verification.ts
// SOT-KEYWORDS: consent verification collection code hash email-plus record guardian h3

export const ConsentVerifications: CollectionConfig = {
  slug: 'consent-verifications',
  /*
    VERSIONS OFF — same reasoning as HandoffCodes: an operational row with a
    credential hash needs no draft history, and a shadow `_v` table is surface
    area with no feature behind it.
  */
  versions: false,
  admin: { useAsTitle: 'guardianAuthId' },
  // Identity is never a parameter (doc 11 §3) — scoping happens in the access
  // layer, so nothing here is readable without an authenticated request.
  access: { read: ({ req }) => Boolean(req.user), delete: () => false },
  fields: [
    { name: 'guardianAuthId', type: 'text', required: true, index: true },
    {
      name: 'method',
      type: 'select',
      required: true,
      options: ['email-plus', 'text-plus', 'kba', 'card'],
    },
    // The guardian's own contact, never the child's. Kept in full because the
    // confirmation message goes to it; the consent record's evidence reference
    // carries the redacted form.
    { name: 'sentTo', type: 'text', required: true },
    { name: 'codeHash', type: 'text', required: true, index: true },
    { name: 'sentAt', type: 'date', required: true },
    { name: 'attempts', type: 'number', required: true, defaultValue: 0 },
    { name: 'codeVerifiedAt', type: 'date' },
    { name: 'confirmationSentAt', type: 'date' },
    { name: 'confirmedAt', type: 'date' },
    // Set exactly once. A row with a value here is a consent record.
    { name: 'recordedAt', type: 'date' },
    { name: 'scope', type: 'text' },
    { name: 'policyVersion', type: 'text' },
    { name: 'evidenceRef', type: 'text' },
  ],
};
