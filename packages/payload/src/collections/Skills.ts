import type { CollectionConfig } from 'payload';

// The subject knowledge graph: the nodes a mastery estimate hangs on.
//
// This is CONTENT, not learner data, and the separation is the point. Doc 19 §3
// splits the world into "embed content, tag children" — skills are curriculum
// authored by experts and shared across every learner, so they carry no
// relationship to a person and live outside the erasure cascade entirely. A
// learner's connection to a skill exists only as a row in `studentModelFacts`.
// SOT: docs/pack/19-learning-outcomes-spec.md §1 §3
// SOT-KEYWORDS: skills knowledge graph curriculum node prerequisite subject band content

export const Skills: CollectionConfig = {
  slug: 'skills',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'subject', 'band'] },
  access: { read: ({ req }) => Boolean(req.user) },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      // Parent language, because this string is what S27 and the guardian
      // digest render. A skill titled "CCSS.MATH.5.NF.A.1" is a skill no parent
      // can read, and doc 07 §S27 requires the model be readable by one.
      name: 'title',
      type: 'text',
      required: true,
    },
    { name: 'subject', type: 'select', required: true, options: ['math', 'reading', 'writing', 'science'] },
    {
      name: 'band',
      type: 'select',
      required: true,
      options: ['elementary', 'junior-high', 'high-school'],
    },
    {
      // The graph edges. Ordering the path (doc 09 §4) is a walk over these.
      name: 'prerequisites',
      type: 'relationship',
      relationTo: 'skills',
      hasMany: true,
    },
    {
      // Doc 18 ships tutoring capability fail-closed per subject × band. A skill
      // the eval suite has not passed is authorable but not tutorable, and the
      // default is off so a new node cannot reach a child by being forgotten.
      name: 'tutorable',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
};
