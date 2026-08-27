import type { CollectionConfig } from 'payload';

// The guarded safety-event store (doc 07 §3 layer 7, doc 07 §7, doc 12 §5).
//
// Deliberately NOT a column on `sessionTranscripts` and not a fact in
// `studentModelFacts`. Doc 07 §3 layer 7 is explicit that safety events are
// "excluded from the pedagogical student model — a crisis is never a
// personalization feature" and that they "live only in the guarded `safetyEvents`
// store with their own short retention". A separate store is what makes both
// halves of that sentence enforceable rather than aspirational: nothing that
// reads the model can reach this table, and this table's clock is its own.
//
// RETENTION IS ITS OWN, AND IS NOT THE TRANSCRIPT'S. `SAFETY_EVENT_TTL_DAYS` in
// `packages/safety/src/events.ts` is 90 days against the transcript's 30 and a
// derived fact's 400, and the reasoning lives beside the constant. The short
// version: 30 days is a minimisation clock on a child's WORDS, and there are no
// words in here — doc 07 §3 layer 4 wants repeated boundary-testing logged, and
// a pattern across a term cannot form inside a 30-day window.
//
// NO CONTENT. `trace` is `PlaneLog[]`: layer ids and verdict labels, never a
// fragment of what was said. Doc 07 §S26's "view conversation excerpt" reads the
// words from `sessionTranscripts`, where they are already on the transcript's
// clock — copying an excerpt here would be a second copy of a child's words on a
// second schedule, which is the failure `tooling/check-versions-off.mjs` exists
// to stop one layer down.
//
// Identity travels as `learnerAuthId`, never as a relationship to `users` — the
// same convention as Consents, Guardianships, TutorSessions and
// StudentModelFacts, so learner data never joins itself to an auth row (doc 13 §5).
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3 §7 · docs/pack/12-systems-design-prompt.md §5 §7
// SOT-KEYWORDS: safety events collection guardian alert crisis boundary pause retention trace review queue

export const SafetyEvents: CollectionConfig = {
  slug: 'safetyEvents',
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
  admin: {
    useAsTitle: 'eventId',
    defaultColumns: ['occurredAt', 'category', 'learnerAuthId', 'stoppedAt', 'expiresAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    /*
      No update path, for the same reason `sessionTranscripts` has none: a
      verdict that can be edited is not a record, and a window that can be
      extended is not retention. Guardian scoping happens in
      `apps/web/lib/safety-event.repository.ts`, which resolves the acting
      guardian's active guardianships before it queries — identity is never a
      parameter (CLAUDE.md §The block), so it cannot be expressed here.
    */
    update: () => false,
  },
  fields: [
    {
      // Minted by `safetyEventFor`, so the writer is idempotent without a round
      // trip: a retried write of the same turn collides rather than duplicating
      // an alert in front of a parent.
      name: 'eventId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'learnerAuthId', type: 'text', required: true, index: true },
    {
      // Nullable: the coaching boundary knows the conversation, but a turn can
      // legitimately be screened before a session row exists.
      name: 'sessionId',
      type: 'text',
      index: true,
    },
    {
      // Doc 07 §S26's three alert categories, plus doc 12 §5's `paused`, which
      // is a fact about the SYSTEM rather than about the child's turn.
      name: 'category',
      type: 'select',
      required: true,
      index: true,
      options: ['crisis', 'safety', 'boundary', 'paused'],
    },
    {
      /*
        Doc 31 §3.2's ladder, and the field that now decides what happens next.

        It REPLACES `category` as the severity dimension rather than sitting
        beside it: `guardianVisible` below used to be `category !== 'boundary'`
        and is now read off the rung, which answers identically for every row
        that exists — the migration in `incident_reports_additive.sql` backfills
        crisis→S4, safety→S3, boundary→S1 for exactly that reason. What the
        ladder can express and the category could not is a rung a child reaches
        by REPEATING (§3.2's rolling window), an SLA, and a paging rule.

        NULLABLE, and the null is load-bearing: doc 12 §5's `paused` row is a
        fact about a classifier that could not answer, and there is no severity
        of child behaviour to assign to it.
      */
      name: 'tier',
      type: 'select',
      index: true,
      options: ['S1', 'S2', 'S3', 'S4'],
    },
    {
      name: 'disposition',
      type: 'select',
      required: true,
      options: ['crisis', 'blocked', 'redirect', 'paused'],
    },
    {
      // `PlaneLog.layer` of the last entry — '3-input', '5-output', '6-crisis'.
      // Kept as text rather than a select so a layer added to the plane records
      // correctly on the day it is added, not on the day someone remembers this
      // file.
      name: 'stoppedAt',
      type: 'text',
      required: true,
    },
    {
      // `PlaneLog[]`, verbatim. JSON rather than an array field for the same
      // reason `tutorSessions.messages` is: the document is only ever read and
      // written whole, and an array-in-array gives two join tables to migrate.
      name: 'trace',
      type: 'json',
      required: true,
    },
    {
      // Whether a guardian sees it, or only the review queue. Stored rather than
      // re-derived at read time: the rule that decided it is versioned code, and
      // a row re-judged by a later build would change what a parent was shown
      // about something that already happened.
      name: 'guardianVisible',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      index: true,
    },
    { name: 'occurredAt', type: 'date', required: true, index: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
};
