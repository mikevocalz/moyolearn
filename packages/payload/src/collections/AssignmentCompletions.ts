import type { CollectionConfig } from 'payload';

// Assignment completions — the learner's self-reported "I did it" for one
// published assignment: the return half of J1's arrival signal. One row per
// (assignment, learner) — the migration's unique constraint makes a double-tap
// physically unable to double-count — and the row is a fact, not a grade:
// there is no score, no rubric, no teacher override here.
//
// `classId` is DENORMALIZED from the assignment at write (the service copies
// it off the resolved row) so teacher counts can group by class without a join
// back through `assignments` — the same reasoning as Assignments' own `orgId`.
// SOT: packages/payload/src/collections/Assignments.ts · packages/app/features/assignments/learner-assignments.service.ts
// SOT-KEYWORDS: assignment completions collection learner mark done self-report unique classId denormalized
export const AssignmentCompletions: CollectionConfig = {
  slug: 'assignment-completions',
  admin: {
    useAsTitle: 'assignmentId',
    defaultColumns: ['assignmentId', 'learnerAuthId', 'classId', 'completedAt'],
    group: 'Institutional',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
  },
  versions: false,
  fields: [
    {
      name: 'assignmentId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The completed assignment — an `assignments` document id.' },
    },
    {
      name: 'learnerAuthId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The Better Auth user id of the learner who marked it done.' },
    },
    {
      name: 'classId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description:
          'The assignment’s class at the moment of completion, denormalized for teacher counts.',
      },
    },
    {
      name: 'completedAt',
      type: 'date',
      required: true,
      admin: { description: 'When the learner marked it done. Written once; never edited.' },
    },
  ],
};
