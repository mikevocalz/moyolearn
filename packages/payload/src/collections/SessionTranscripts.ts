import type { CollectionConfig } from 'payload';

// Raw session transcripts, on a clock from the moment they land.
//
// Doc 07 §4 and plan ADR-006: transcripts expire on a published schedule after
// distillation. `expiresAt` is written once at capture and is not extendable —
// there is no update access on this collection at all, so no code path exists
// that quietly renews a child's retention window. The sweep that acts on it is
// `expireTranscripts` in `@acme/student-model`, which deletes the row AND every
// derived fact the row is the sole source of.
//
// Delete is open (unlike Consents, which are immutable evidence) because
// deletion is the feature here: a guardian erasing a session is doc 07 §4's
// promise, and a collection you cannot delete from cannot keep it.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4
// SOT-KEYWORDS: transcript session raw retention ttl expiry distillation erasure learner

export const SessionTranscripts: CollectionConfig = {
  slug: 'sessionTranscripts',
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
  admin: { useAsTitle: 'sessionId', defaultColumns: ['sessionId', 'learnerAuthId', 'expiresAt'] },
  access: {
    read: ({ req }) => Boolean(req.user),
    // Retention windows are set at capture. Nothing renews one.
    update: () => false,
  },
  fields: [
    { name: 'sessionId', type: 'text', required: true, index: true },
    { name: 'learnerAuthId', type: 'text', required: true, index: true },
    {
      // The turns, in `SessionTurn` shape. `storable` per turn is the Safety
      // Plane's own layer-7 verdict carried verbatim — distillation reads it and
      // never re-derives it, because a second classifier that can disagree with
      // the first would win by being downstream.
      name: 'turns',
      type: 'json',
      required: true,
    },
    { name: 'capturedAt', type: 'date', required: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    {
      // Set by the distillation job. A transcript that expires undistilled took
      // its facts with it, which is the correct outcome and a visible one.
      name: 'distilledAt',
      type: 'date',
    },
  ],
};
