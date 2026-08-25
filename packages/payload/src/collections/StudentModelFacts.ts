import type { CollectionConfig } from 'payload';

// The student knowledge graph, per learner. Everything the tutor "remembers",
// and every line S27 renders.
//
// `sentence` is stored rather than formatted at render, and that is a privacy
// decision before it is a UI one: doc 07 §S27 promises a guardian sees exactly
// what the model says, so the row a parent reads must be the row the prompt
// gets. A sentence composed at render time is a second source of truth, and the
// one on screen would be the one nobody audits.
//
// `derivedFrom` is what makes erasure real. Doc 07 §4 promises the cascade;
// provenance is how it stops being a best-effort sweep — deleting a transcript
// deletes every fact it is the sole source of, mechanically, by walking this
// field (`eraseTranscript` in `@acme/student-model`).
//
// No relationship to `users`. Learner identity travels as `learnerAuthId`, the
// same convention Guardianships and Consents use, so this collection never joins
// itself to an auth row and never appears on a machine-readable surface (doc 13
// §5: learner learning data has no public endpoints in any version).
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 · docs/pack/19-learning-outcomes-spec.md §1
// SOT-KEYWORDS: student model facts knowledge graph mastery misconception review interest provenance erasure

export const StudentModelFacts: CollectionConfig = {
  slug: 'studentModelFacts',
  admin: { useAsTitle: 'sentence', defaultColumns: ['sentence', 'kind', 'learnerAuthId'] },
  access: { read: ({ req }) => Boolean(req.user) },
  fields: [
    {
      // `learnerAuthId:kind:subject` — the deterministic key that makes
      // distillation an upsert. An append log would regrow a deleted line on the
      // next session and call it a new fact.
      name: 'factId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'learnerAuthId', type: 'text', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['mastery', 'misconception', 'review', 'interest', 'scaffolding'],
    },
    { name: 'skill', type: 'relationship', relationTo: 'skills' },
    { name: 'sentence', type: 'text', required: true },
    {
      // The variant payload — `p`/`attempts`, `tag`/`active`, `dueAt`, and so on.
      // Typed as a discriminated union in `@acme/student-model`; JSON here
      // because Payload has no union field and five near-empty collections would
      // be five erasure cascades to keep in step instead of one.
      name: 'detail',
      type: 'json',
      required: true,
    },
    {
      name: 'derivedFrom',
      type: 'text',
      hasMany: true,
      required: true,
      index: true,
    },
    { name: 'observedAt', type: 'date', required: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
};
