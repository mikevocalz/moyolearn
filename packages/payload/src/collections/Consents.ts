import type { CollectionConfig } from 'payload';

// COPPA consent evidence. Doc 06 §6: records are immutable and versioned —
// a material change is a NEW record, never an edit, because the point of the
// row is what was agreed to at a moment in time.
// SOT: docs/pack/06-auth-onboarding-spec.md §6 §7
// SOT-KEYWORDS: consent coppa guardian evidence version immutable audit

export const Consents: CollectionConfig = {
  slug: 'consents',
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
