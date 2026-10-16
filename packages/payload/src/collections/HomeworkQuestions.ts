import type { CollectionConfig } from 'payload';

// One question of one worksheet, with every transcription anyone confirmed.
//
// `revisions` is APPEND-ONLY and JSON, not a Payload `array` field, for the
// reason `tutorSessions.messages` records: the list is always read and written
// as one unit, and an array field costs a join table to migrate every time a
// revision gains a column. The newest entry is `currentRevision`, and that id
// is what `edu.questions` holds as the revision a graded turn would have to
// quote (ADR-119). A revise appends, moves `currentRevision`, and re-issues the
// edu row under the new revision with `evaluation_ready = false`: a confirmed
// transcription of a photographed page is still not server-composed, so the
// evaluator keeps refusing it. There is no path here that sets it true.
//
// `crop` is the child's source image. It carries `cropExpiresAt`, seven days
// from capture (`MEDIA_TTL_DAYS`), and the retention sweep nulls the column
// when that passes while the row and its text stay (contract decision 4). The
// row is therefore durable and the image is not, in one table, and the partial
// index on `cropExpiresAt` keeps the sweep's predicate the size of the crops
// still alive.
//
// `outcome` has no graded arm. Six states (unattempted, skipped, attempted,
// supported-with-hints, solved-independently, unresolved) are what the
// acceptance contract distinguishes, and none of them is a score shown to a
// child. The guardian report maps them to `ProblemStatus`; it never maps them to
// a grade.
// SOT: docs/design/homework-end-to-end-2026.md · docs/work/pr-100/contract.md §Data · docs/decisions/adr-119-graded-turns-need-a-locked-revision.md · docs/decisions/adr-124-homework-submissions-persistence.md
// SOT-KEYWORDS: homework question revision append-only current revision crop expiry outcome attempts hints misconception tags evidence binding

export const HomeworkQuestions: CollectionConfig = {
  slug: 'homeworkQuestions',
  /*
    VERSIONS OFF — the canary defaults them ON (see Leads.ts). A `_v` copy of
    this table would hold the child's source crop past `cropExpiresAt` and past
    the account cascade, which is the retention promise inverted.
  */
  versions: false,
  admin: {
    useAsTitle: 'questionId',
    defaultColumns: ['submissionId', 'orderIndex', 'outcome', 'cropExpiresAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  indexes: [
    // Ten questions, ten ordered rows. A retried create that raced its first
    // attempt collides here instead of putting an eleventh question in front of
    // a child. The migration names it as Families.ts's pair is named.
    { fields: ['submissionId', 'orderIndex'], unique: true },
  ],
  fields: [
    {
      // Server-minted. Unique because `edu.questions.question_id` points at it
      // and a duplicate would let one edu row authorise two questions.
      name: 'questionId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    // Pointer to `homeworkSubmissions.submissionId`. `(submissionId, orderIndex)`
    // is UNIQUE (collection `indexes` above); the repository writes questions in
    // one pass per submission, so the constraint is a backstop.
    { name: 'submissionId', type: 'text', required: true, index: true },
    // Denormalised from the submission so the account cascade can delete this
    // table by `learnerAuthId` without a join, as every entry in
    // `SUBJECT_COLLECTIONS` must.
    { name: 'learnerAuthId', type: 'text', required: true, index: true },
    { name: 'orderIndex', type: 'number', required: true },
    { name: 'sourcePage', type: 'number', required: true },
    { name: 'sourceNumber', type: 'number' },
    { name: 'currentRevision', type: 'text', required: true },
    // The current text, duplicated out of `revisions` so the tutor's read is
    // one column rather than a JSON walk.
    { name: 'text', type: 'textarea', required: true },
    // `QuestionRevision[]`, oldest first. Append-only by repository discipline.
    { name: 'revisions', type: 'json', required: true, defaultValue: [] },
    // `QuestionCrop | null`. Nulled by the sweep once `cropExpiresAt` passes.
    { name: 'crop', type: 'json' },
    { name: 'cropExpiresAt', type: 'date', index: true },
    {
      name: 'outcome',
      type: 'select',
      required: true,
      defaultValue: 'unattempted',
      index: true,
      options: [
        'unattempted',
        'skipped',
        'attempted',
        'supported-with-hints',
        'solved-independently',
        'unresolved',
      ],
    },
    { name: 'attempts', type: 'number', required: true, defaultValue: 0 },
    { name: 'hintsUsed', type: 'number', required: true, defaultValue: 0 },
    // `string[]` of misconception tags recorded against this question.
    { name: 'misconceptionTags', type: 'json', required: true, defaultValue: [] },
    { name: 'startedAt', type: 'date' },
    { name: 'completedAt', type: 'date' },
  ],
};
