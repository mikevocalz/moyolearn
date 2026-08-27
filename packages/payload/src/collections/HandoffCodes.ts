import type { CollectionConfig } from 'payload';

// Device-handoff codes (doc 36 §2): the guardian device mints one, the learner
// device redeems it, and redemption is the child's sign-in — a child never
// types an email or password. What lives here is a HASH plus lifecycle facts;
// the code itself exists only on the guardian's screen for its 15-minute TTL.
// SOT: docs/pack/36-role-navigation-flows.md §2 · packages/auth/src/handoff.ts
// SOT-KEYWORDS: handoff code collection hash redeem expiry single-use learner guardian

export const HandoffCodes: CollectionConfig = {
  slug: 'handoff-codes',
  /*
    VERSIONS OFF — same reasoning as Guardianships: an append-only operational
    row needs no draft history, and a shadow `_v` table holding credential
    hashes past their redemption is surface area with no feature behind it.
  */
  versions: false,
  admin: { useAsTitle: 'learnerAuthId' },
  // Identity is never a parameter (doc 11 §3) — scoping happens in the access
  // layer, so nothing here is readable without an authenticated request.
  access: { read: ({ req }) => Boolean(req.user) },
  fields: [
    { name: 'codeHash', type: 'text', required: true, index: true, unique: true },
    { name: 'learnerAuthId', type: 'text', required: true, index: true },
    { name: 'guardianAuthId', type: 'text', required: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
    // Set exactly once, at redemption. A row with a value is dead forever —
    // single-use is a fact of the data, not a flag a query has to remember.
    { name: 'redeemedAt', type: 'date' },
  ],
};
