import type { CollectionConfig } from 'payload';

// Assignments — the object teacher.assign publishes and learner.plan will
// surface: J1's missing arrival signal gets a producer side here.
//
// Work items reuse FD-23's `AssignmentTemplate` shape (steps.ts) — title,
// description, minutes — plus the template id they were seeded from, so a
// duplicate-to-another-class keeps its provenance. Lifecycle is a one-way
// ladder (draft → published → closed) with `publishedAt` written exactly once:
// "never half-published" (contract failure path) is a fact of the row, not a
// flag the UI has to remember.
// SOT: design/screens/teacher/teacher.assign/contract.md · packages/app/features/onboarding/teacher/steps.ts (FD-23)
// SOT-KEYWORDS: assignments collection teacher publish draft closed due work items classId

export const Assignments: CollectionConfig = {
  slug: 'assignments',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'classId', 'teacherAuthId', 'orgId', 'status', 'dueAt'],
    group: 'Institutional',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
  },
  versions: false,
  fields: [
    {
      name: 'classId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The class this assignment targets — a `classes` document id.' },
    },
    {
      name: 'teacherAuthId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The Better Auth user id of the authoring teacher.' },
    },
    {
      name: 'orgId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The school slug, denormalized from the class for tenant scoping.' },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'subject',
      type: 'text',
      admin: { description: 'Optional subject label.' },
    },
    {
      name: 'dueAt',
      type: 'date',
      required: true,
      index: true,
      admin: { description: 'When the work is due. Indexed for "due this week" reads.' },
    },
    {
      // The FD-23 template shape, as rows a teacher can edit after seeding.
      name: 'workItems',
      type: 'array',
      fields: [
        {
          name: 'templateId',
          type: 'text',
          admin: { description: 'ASSIGNMENT_TEMPLATES id this item was seeded from, if any.' },
        },
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text', required: true },
        { name: 'minutes', type: 'number', required: true },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ['draft', 'published', 'closed'],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: { description: 'Set exactly once, at publish. A draft has none.' },
    },
  ],
};
