import type { CollectionConfig } from 'payload';

// The curated misconception taxonomy. Content, like Skills — a shared list of
// specific, named errors ("treats a fraction as two whole numbers"), each with
// the strategy that addresses it.
//
// Curated is the whole design (doc 19 §1, §3). The alternative is a model
// writing free-text notes about a child, which is both unauditable and the exact
// profiling shape doc 07 §4 exists to rule out. `@acme/student-model` holds the
// same taxonomy as an `as const satisfies` map so distillation can reject an
// unknown tag without a database round trip; this collection is where the
// curriculum team edits it, and the two are reconciled at seed time.
// SOT: docs/pack/19-learning-outcomes-spec.md §1 §3
// SOT-KEYWORDS: misconception taxonomy tag strategy curated content skill error

export const Misconceptions: CollectionConfig = {
  slug: 'misconceptions',
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
  admin: { useAsTitle: 'sentence', defaultColumns: ['tag', 'sentence'] },
  access: { read: ({ req }) => Boolean(req.user) },
  fields: [
    { name: 'tag', type: 'text', required: true, unique: true, index: true },
    { name: 'skill', type: 'relationship', relationTo: 'skills', required: true },
    {
      // What S27 shows a guardian, verbatim.
      name: 'sentence',
      type: 'text',
      required: true,
    },
    {
      // Travels with the misconception into the prompt: a tutor told what a
      // child gets wrong and not what to do will correct the answer, and doc 19
      // §1 is explicit that the model is what needs correcting.
      name: 'strategy',
      type: 'textarea',
      required: true,
    },
  ],
};
