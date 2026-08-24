import type { CollectionConfig } from 'payload';

// COPPA consent evidence. Doc 06 §6: records are immutable and versioned —
// a material change is a NEW record, never an edit, because the point of the
// row is what was agreed to at a moment in time.
// SOT: docs/pack/06-auth-onboarding-spec.md §6 §7
// SOT-KEYWORDS: consent coppa guardian evidence version immutable audit

export const Consents: CollectionConfig = {
  slug: 'consents',
  admin: { useAsTitle: 'learnerAuthId' },
  access: {
    read: ({ req }) => Boolean(req.user),
    // Immutability is the whole feature; re-consent writes another row.
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'learnerAuthId', type: 'text', required: true, index: true },
    { name: 'guardianAuthId', type: 'text', required: true, index: true },
    {
      name: 'method',
      type: 'select',
      required: true,
      options: ['email-plus', 'text-plus', 'kba', 'card'],
    },
    { name: 'scope', type: 'text', required: true },
    { name: 'policyVersion', type: 'text', required: true },
    { name: 'evidenceRef', type: 'text' },
    { name: 'grantedAt', type: 'date', required: true },
  ],
};
