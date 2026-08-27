import type { CollectionConfig } from 'payload';

// The guardian↔learner link. Doc 06 §2 supports two guardians per learner from
// day one — real families have two households — so this is a row per pair, not
// a `guardianId` column on the learner.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §7
// SOT-KEYWORDS: guardianship guardian learner link family consent

export const Guardianships: CollectionConfig = {
  slug: 'guardianships',
  /*
    VERSIONS OFF — this canary defaults them ON (see Leads.ts), and for a
    collection holding learner content that default silently breaks the erasure
    cascade promised by docs 19 and 24.

    Payload mirrors every write into `_<table>_v`, and the retention sweep
    targets `expires_at` on the MAIN table only. So a transcript survives its own
    deletion in the shadow table: "delete my child's data" does not delete it.
    Disk growth is the symptom; the broken guarantee is the defect, and it is the
    one a district's counsel asks about.

    Measured before turning it off: 1,294 shadow rows across the schema, with
    `_student_model_facts_v_texts` holding 1,119 against 49 live — a 23x copy of
    derived learner facts that nothing was ever going to sweep.

    Versions are an editorial feature: draft/publish, revert, who-changed-what.
    None of that applies to an append-only record of a child's session.
  */
  versions: false,
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
