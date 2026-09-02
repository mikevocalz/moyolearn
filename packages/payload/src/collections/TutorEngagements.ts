import type { CollectionConfig } from 'payload';

// The tutor↔learner engagement — ADR-108's first-class roster edge.
//
// A row per pair per org, NOT a `tutorAuthId` column on `tutorSessions`: that
// collection models the child's AI sessions (doc 23's one continuing thread,
// where "the tutor" is the product) and a human tutor id on it would misstate
// what a session row is. The engagement is its own fact — it exists before any
// session has happened and survives between them — and it is what tutor
// incident intake verifies a filing subject against (the wards-intersection
// shape, one relationship over) and what "My learners" will read.
//
// THE ROW IS THE EDGE'S CURRENT STATE, not its history: `(tutorAuthId,
// learnerAuthId, orgId)` is unique (constraint in the migration — Payload has
// no compound-unique field syntax), so a re-engagement flips `status` back to
// `active` rather than appending a second row. History is not this table's
// job; "is this tutor engaged with this learner" must be a one-row question,
// because a safety check reads it.
//
// No relationship to `users`. Identity travels as `*AuthId` text pointers, the
// same convention Consents, Guardianships and TutorSessions use — learner data
// never joins itself to an auth row (doc 13 §5).
// SOT: docs/decisions/adr-108-tutor-learner-edge.md · docs/pack/36-role-navigation-flows.md §3.3
// SOT-KEYWORDS: tutor engagement roster edge learner org active ended intake subject verification my learners
export const TutorEngagements: CollectionConfig = {
  slug: 'tutorEngagements',
  /*
    VERSIONS OFF — this canary defaults them ON (see Leads.ts). A roster edge
    is not learner content, but the shadow-table rule still applies: nothing
    editorial happens to an engagement row, and a `_tutor_engagements_v` copy
    would be rows nothing ever sweeps.
  */
  versions: false,
  admin: {
    useAsTitle: 'learnerAuthId',
    defaultColumns: ['tutorAuthId', 'learnerAuthId', 'orgId', 'status', 'startedAt'],
    group: 'Institutional',
  },
  // Identity is never a parameter (doc 11 §3) — scoping happens in the access
  // layer, so nothing here is readable without an authenticated request.
  access: { read: ({ req }) => Boolean(req.user) },
  fields: [
    {
      name: 'tutorAuthId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The Better Auth user id of the tutor.' },
    },
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
      admin: { description: 'The org slug the engagement is held in.' },
    },
    {
      // `ended`, never deleted: an ended engagement still explains why a past
      // incident's subject was once verifiable. Only `active` rows count for
      // anything forward-looking (intake verification, My learners).
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: ['active', 'ended'],
    },
    {
      name: 'startedAt',
      type: 'date',
      required: true,
      admin: { description: 'When the engagement began (or last resumed).' },
    },
    {
      name: 'endedAt',
      type: 'date',
      admin: { description: 'When the engagement ended, if it has.' },
    },
  ],
};
