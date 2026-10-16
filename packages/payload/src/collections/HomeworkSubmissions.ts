import type { CollectionConfig } from 'payload';

// One captured worksheet, owned by the server so a second device can resume it.
//
// The first slice kept the worksheet in a device-local Zustand store keyed by
// owner (`packages/app/features/capture/worksheet-session.ts`), which made
// "resume Q4/10 on the family laptop" impossible by construction. This row is
// the worksheet; the store becomes a cache of it (ADR-124). The questions live
// one row each in `homeworkQuestions`, keyed back by `submissionId`, because a
// question has its own append-only revision list and its own outcome, and the
// report (doc 34) reads questions without the submission.
//
// THE CURSOR LIVES HERE, not in a separate table and not on the client.
// `currentIndex` is the one value `advance` moves, and it moves inside the same
// transaction that records the outgoing question's outcome, so two devices
// pressing Next cannot both win: the loser's `expectedIndex` no longer matches
// and the route answers 409 with the row as it now stands.
//
// NO `expiresAt`. A submission is the learner's own record of work, erased by
// the account cascade (`SUBJECT_COLLECTIONS` in account-deletion.repository.ts)
// and by nothing else, the retention class `sessionSummaries` established. The
// source crops are the child image and they carry their own seven-day clock on
// the question row; the confirmed text outlives them (contract decision 4).
//
// Identity columns are `*AuthId` text pointers, never relationships to `users`,
// the convention every learner collection here follows (doc 13 §5).
// `createdByAuthId` differs from `learnerAuthId` when a guardian uploads for a
// ward; the service accepts that only against an ACTIVE guardianship.
// SOT: docs/design/homework-end-to-end-2026.md · docs/work/pr-100/contract.md §Data · docs/decisions/adr-124-homework-submissions-persistence.md
// SOT-KEYWORDS: homework submission worksheet cursor server-owned resume guardian upload pipeline status retention cascade

export const HomeworkSubmissions: CollectionConfig = {
  slug: 'homeworkSubmissions',
  /*
    VERSIONS OFF — the canary defaults them ON (see Leads.ts), and a shadow copy
    of a child's worksheet in `_homework_submissions_v` would survive the account
    cascade, which deletes by `learner_auth_id` on the main table only.
  */
  versions: false,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'learnerAuthId', 'localDate', 'status', 'currentIndex'],
  },
  /*
    Signed-in at the collection level; the scoping is in
    `apps/web/lib/homework.repository.ts`, where every query carries the
    learner id the service proved (own, or an active ward). Identity is never a
    parameter (CONTRIBUTING.md §The block), so no static rule here can say it.
  */
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      // Client-minted UUID. Unique so a retried POST lands on the existing row
      // instead of making a second homework record (design doc §Accuracy:
      // "failed uploads must retry without a second homework record").
      name: 'submissionId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'learnerAuthId', type: 'text', required: true, index: true },
    { name: 'createdByAuthId', type: 'text', required: true, index: true },
    { name: 'subject', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'instructions', type: 'textarea', required: true, defaultValue: '' },
    // The learner's local calendar date, `YYYY-MM-DD`. Text, not `date`: the
    // guardian timeline groups by the day the child worked, and a timestamp
    // would move that day across a timezone.
    { name: 'localDate', type: 'text', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'reviewing',
      index: true,
      options: ['reviewing', 'ready', 'in-progress', 'complete', 'abandoned'],
    },
    // OCR pipeline state. `failed` keeps the pages for retry rather than
    // deleting the submission, so an error never masquerades as zero work.
    {
      name: 'pipelineStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'extracting', 'extracted', 'failed'],
    },
    { name: 'pipelineError', type: 'text' },
    // The server-owned cursor. The only writer is `advanceSubmission`, inside
    // its transaction.
    { name: 'currentIndex', type: 'number', required: true, defaultValue: 0 },
    { name: 'currentQuestionId', type: 'text', required: true },
    // Text pointer into `tutorSessions.sessionId`, set by `start`. Nullable
    // because a submission exists before Natalie is opened on it.
    { name: 'tutorSessionId', type: 'text', index: true },
  ],
};
