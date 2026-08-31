import type { CollectionConfig } from 'payload';

// Enrollments — the canonical learner-to-organization roster.
//
// This is the missing institutional foundation. Tutor sessions, learning data,
// and safety events are keyed by `learnerAuthId`; enrollments are the bridge
// that maps a learner to the school (and district) that can report on them.
// It is intentionally minimal: a roster row, not a materialized report.
// SOT: packages/payload/src/collections/Organizations.ts · docs/pack/01-ai-tutoring-platform-plan.md §(auth mapping)
// SOT-KEYWORDS: enrollment roster learner orgId school district institutional foundation

export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  admin: {
    useAsTitle: 'learnerAuthId',
    defaultColumns: ['learnerAuthId', 'orgId', 'districtId', 'status', 'enrolledAt'],
    group: 'Institutional',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
  },
  versions: false,
  fields: [
    {
      name: 'learnerAuthId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The Better Auth user id of the learner.' },
    },
    {
      name: 'orgId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The school or district slug the learner is enrolled in.' },
    },
    {
      name: 'districtId',
      type: 'text',
      index: true,
      admin: { description: 'The district slug, denormalized for district-level rollups.' },
    },
    {
      name: 'program',
      type: 'text',
      admin: { description: 'Optional program or cohort name.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: ['active', 'inactive'],
    },
    {
      name: 'enrolledAt',
      type: 'date',
      required: true,
      admin: { description: 'When the learner began enrollment.' },
    },
    {
      name: 'exitedAt',
      type: 'date',
      admin: { description: 'When the learner left the program, if applicable.' },
    },
  ],
};
