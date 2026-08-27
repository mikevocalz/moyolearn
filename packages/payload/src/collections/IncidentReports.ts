import type { CollectionConfig } from 'payload';

// Doc 31 §4 — Incident Reports. Two intake doors, one collection, one lifecycle.
//
// SEPARATE FROM `safetyEvents`, AND THE SPLIT IS THE DESIGN. A safety event is
// what the plane DID: a verdict, a layer, no words, its own 90-day clock, and no
// update path at all. An incident is what a PERSON now owes: a triage state, an
// assignee, an SLA, a guardian acknowledgment, and an audit trail that grows.
// Collapsing them would either give the verdict store an edit path — and a
// verdict that can be edited is not a record — or freeze the case file, which is
// the same as not having one. `relatedEventId` is the join, and it is a pointer
// rather than a foreign key for the same reason `learnerAuthId` is: the two
// stores keep different clocks, and an event that has expired must not take the
// case with it.
//
// NO CONTENT, AGAIN. `transcriptExcerpt` is `{ sessionId, messageIds }` and has
// no field wide enough to hold a sentence — doc 31 §4.1: "permission-gated
// render, never a copy". A copy of a child's words here would be a third copy on
// a third retention schedule, after `sessionTranscripts` (30 days) and the
// deliberate absence of one in `safetyEvents`.
//
// THE ONE DELETER IS THE SWEEP, AND IT REFUSES A HOLD. `delete` access is
// closed, so no route, no admin action and no cascade removes an incident
// through Payload. `packages/payload/src/retention/sweep.sql` deletes on
// `expires_at < now() AND legal_hold IS NULL` — doc 31 §4.1's "retention follows
// the learner-content schedule *except* S4 and abuse-disclosure records". See
// `LEGAL_HOLD_REASON` in `packages/safety/src/incidents.ts` for the counsel
// checkpoint that is deliberately NOT implemented here.
//
// THE CRM CANNOT REACH THIS COLLECTION. Doc 23 §2's wall — "business data and
// learning data never blend" — extends to safety by doc 31 §4.2: "'child had a
// safety incident' must never become a sales signal, structurally."
// `tooling/check-crm-wall.mjs` fails the build if ops/CRM code acquires an
// import path to incidents, so the wall is a property of the module graph rather
// than of everyone's memory.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4 · docs/pack/23-crm-spec.md §2 · docs/pack/19-learning-outcomes-spec.md §S27
// SOT-KEYWORDS: incident reports collection triage lifecycle timeline append only legal hold sla guardian visible anonymous transcript excerpt crm wall

export const IncidentReports: CollectionConfig = {
  slug: 'incidentReports',
  /*
    VERSIONS OFF — the canary defaults them ON (see Leads.ts), and this
    collection is the worst possible place to inherit that default twice over.

    Payload mirrors every write into `_<table>_v`, and the sweep targets
    `expires_at` on the MAIN table only — so an incident would survive its own
    retention in a shadow table nothing sweeps. Worse, the shadow rows would be
    exempt from the legal-hold rule in the OTHER direction too: a held record's
    history would sit in a table with no `legal_hold` predicate over it.

    The audit trail is not a version history. `timeline` is the record of who did
    what, written by the domain, in the row; `_v` is an editorial feature —
    draft/publish, revert — and none of that applies to a case file.
  */
  versions: false,
  admin: {
    useAsTitle: 'incidentId',
    defaultColumns: ['occurredAt', 'severity', 'category', 'status', 'slaDueAt', 'legalHold'],
    group: 'Safety',
  },
  access: {
    /*
      Authenticated only at the collection level, and everything that actually
      matters is one layer up. Guardians see own-learner rows where
      `guardianVisible`; staff see org-scoped queues. Both need the acting
      identity, and identity is never a parameter (CLAUDE.md §The block) — so the
      scoping lives in `apps/web/lib/incident.repository.ts`, which resolves
      guardianships before it queries and cannot be expressed as a static rule
      here.
    */
    read: ({ req }) => Boolean(req.user),
    /*
      DELETE IS CLOSED, at every door. The retention sweep is raw SQL and does
      not pass through this gate; nothing else is supposed to remove an incident
      at all. A collection whose rows an admin can delete is a collection whose
      legal hold is advisory.
    */
    delete: () => false,
  },
  fields: [
    {
      // Minted by `incidentFromSafetyEvent` / `incidentFromSubmission` before the
      // write, so a retried file collides rather than putting the same case in
      // front of a parent twice.
      name: 'incidentId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      index: true,
      options: ['automated', 'submitted'],
    },
    {
      name: 'reporterRole',
      type: 'select',
      required: true,
      options: ['system', 'tutor', 'staff', 'guardian', 'learner'],
    },
    {
      /*
        Null when anonymous, and null in the ROW rather than merely hidden in the
        UI. §4's anonymous-reporting evidence (the NIJ RCT) is about people
        trusting the promise; a row that still holds the id is a promise broken by
        the first person with a database connection.
      */
      name: 'reporterAuthId',
      type: 'text',
      index: true,
    },
    { name: 'anonymous', type: 'checkbox', required: true, defaultValue: false },
    {
      // Who this is about. Same `*AuthId` pointer convention as consents,
      // guardianships and safetyEvents — learner data never joins itself to an
      // auth row (doc 13 §5).
      name: 'subjectLearnerAuthId',
      type: 'text',
      required: true,
      index: true,
    },
    { name: 'relatedSessionId', type: 'text', index: true },
    {
      // The `safetyEvents.eventId` that filed it, when the plane did. A pointer,
      // not a relationship: the event store keeps 90 days and this one keeps the
      // learner-content window, so the two expire independently by design.
      name: 'relatedEventId',
      type: 'text',
      index: true,
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      index: true,
      options: [
        'profanity',
        'sexual-content',
        'bullying',
        'pii-shared',
        'violence',
        'substances',
        'self-harm',
        'abuse-disclosure',
        'tutor-behavior',
        'safety-concern',
        'other',
      ],
    },
    {
      // Doc 31 §3.2's ladder. The system's judgement — §5.1 is explicit that a
      // reporter never picks this under stress.
      name: 'severity',
      type: 'select',
      required: true,
      index: true,
      options: ['S1', 'S2', 'S3', 'S4'],
    },
    { name: 'occurredAt', type: 'date', required: true, index: true },
    {
      // "What was observed" — behaviour, never inferred intent (§3.2's closing
      // note, and the school-reporting research behind it).
      name: 'summary',
      type: 'textarea',
      required: true,
    },
    {
      /*
        `{ sessionId, messageIds }` and nothing else, ever. JSON rather than a
        group so the shape travels as one value the domain owns, and so there is
        no field on this table a future `text` could be added to by accident.
      */
      name: 'transcriptExcerpt',
      type: 'json',
    },
    {
      /*
        Doc 29's token-auth class, as IDS rather than as a relationship to
        `media`, and the difference is not stylistic: `payload.config.ts` records
        that doc 29 §3's learner and guardian uploads go client-direct to Bunny
        with a server-minted presigned URL and never create a `media` row at all.
        A relationship would point at a collection these objects are not in.

        Ids and never URLs, so the link is minted at read time under permission
        and expires — a stored URL is a token in a database.
      */
      name: 'attachmentIds',
      type: 'text',
      hasMany: true,
    },
    { name: 'immediateActionTaken', type: 'textarea' },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'new',
      options: ['new', 'triaged', 'in-review', 'actioned', 'resolved', 'closed'],
    },
    { name: 'assigneeAuthId', type: 'text', index: true },
    {
      // §4.3, set from severity at creation by `slaDueAt`. Null below S3, which
      // owes no clock — a queue column that is empty because nothing is due
      // reads correctly; one defaulted to a date does not.
      name: 'slaDueAt',
      type: 'date',
      index: true,
    },
    {
      // Stored, not re-derived at read time — the same rule `safetyEvents`
      // records: a row re-judged by a later build would change what a parent was
      // shown about something that already happened.
      name: 'guardianVisible',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      index: true,
    },
    {
      /*
        THE NATURAL KEY behind `safety.alert.guardian` (doc 31 §4.3,
        `docs/design/jobs.md` §3). The `singletonKey` stops a double enqueue; this
        column is what makes a second EXECUTION a no-op, so a pg-boss retry or a
        dead-letter replay cannot tell a parent the same thing twice. Its absence
        is exactly why that queue sat `declared` until this collection existed.
      */
      name: 'guardianNotifiedAt',
      type: 'date',
      index: true,
    },
    {
      // The same, for §4.3's S4 page, behind `safety.review.enqueue`.
      name: 'reviewPagedAt',
      type: 'date',
      index: true,
    },
    { name: 'guardianAcknowledgedAt', type: 'date' },
    { name: 'resolution', type: 'textarea' },
    {
      /*
        APPEND-ONLY, enforced by the only writer. `IncidentTimelineEntry[]`, and
        JSON rather than a Payload array for the same reason
        `tutorSessions.messages` is: the document is read and written whole, and
        an array field gives a join table to migrate every time an entry gains a
        field.

        Append is a property of `packages/safety/src/incidents.ts` —
        `appendTimeline` is the only function that produces a new value and it
        spreads the old one — and of the repository, which refuses a write whose
        trail is shorter than the row's. There is no code path that edits an
        entry, because there is no function that returns one changed.
      */
      name: 'timeline',
      type: 'json',
      required: true,
    },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    {
      /*
        THE MARKER THE SWEEP REFUSES TO CROSS, and a REASON rather than a boolean.

        "Why is this eleven-month-old record still here" is the question a hold
        has to answer, and `true` cannot answer it. Set from
        `LEGAL_HOLD_REASON` for every S4 record and every abuse disclosure
        (doc 31 §4.1), and never cleared by any function in this repository —
        releasing a hold is a decision for counsel, taken outside the code.
      */
      name: 'legalHold',
      type: 'text',
      index: true,
    },
  ],
};
