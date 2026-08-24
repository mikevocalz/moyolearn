import type { CollectionConfig } from 'payload';

// The guardian↔learner link. Doc 06 §2 supports two guardians per learner from
// day one — real families have two households — so this is a row per pair, not
// a `guardianId` column on the learner.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §7
// SOT-KEYWORDS: guardianship guardian learner link family consent

export const Guardianships: CollectionConfig = {
  slug: 'guardianships',
  admin: { useAsTitle: 'learnerAuthId' },
  // Identity is never a parameter (doc 11 §3) — scoping happens in the access
  // layer, so nothing here is readable without an authenticated request.
  access: { read: ({ req }) => Boolean(req.user) },
  fields: [
    { name: 'guardianAuthId', type: 'text', required: true, index: true },
    { name: 'learnerAuthId', type: 'text', required: true, index: true },
    {
      name: 'relationship',
      type: 'select',
      required: true,
      defaultValue: 'guardian',
      options: ['guardian', 'parent', 'carer'],
    },
    {
      // The first guardian invites the second (doc 06 §2); an invited row is
      // not yet load-bearing for consent.
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: ['active', 'invited', 'revoked'],
    },
  ],
};
