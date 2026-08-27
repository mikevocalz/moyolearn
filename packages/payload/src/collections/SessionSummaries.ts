import type { CollectionConfig } from 'payload';

// Doc 34 §3 — the session summary report: the durable record of learning a
// guardian is shown, one row per tutoring session.
//
// ITS OWN RETENTION CLASS, AND THE ABSENCE OF `expiresAt` IS THE DESIGN. Every
// other learner-content collection carries an `expires_at` the sweep acts on;
// this one deliberately does not, because doc 34 §3 says summaries "are the
// durable record of learning and may outlive transcripts". The transcript TTL
// takes the raw conversation; the summary — evidence already distilled into
// blocks a parent was shown — stays until the GUARDIAN erases it: the S27
// forget-all cascade deletes this table by `learner_auth_id`
// (`packages/student-model/src/erasure.ts` names it, and
// `erasure.integration.test.mjs` proves it against real rows). When the
// transcript goes first, `evidenceRefs` degrade to "source expired" at render
// time rather than taking the report with them.
//
// EVIDENCE-FIRST, ENFORCED BY SHAPE. Doc 34 §1's trap is a report that joins
// the B-plus machine — so there is no free-text "recap" field to fill with
// adjectives. The eight blocks of §2 are eight columns in fixed order, the
// narrative fields are short strings written FROM the extracted evidence table
// (§4: the model never sees the transcript), and `evidenceRefs` is what the
// honesty lint checks every claim against before `status` may leave
// `generating`.
//
// `suppressed` IS LOGGED SUPPRESSION, NEVER SILENT DELETION. A summary a human
// reviewer pulls (generation error, safety miss) keeps its row: `status`
// flips, `suppressionReason` says why, and the guardian surface simply stops
// listing it. Deleting the row instead would erase the fact that a bad summary
// was ever generated, which is the audit answer this column exists to keep.
//
// TEACHER SHARING IS GUARDIAN-INITIATED (§3): a revocable, expiring, tokened
// read-only link. `teacherShare` holds a HASH of the token, never the token —
// the same rule IncidentReports states about attachment ids: "a stored URL is
// a token in a database". The raw token is minted once, handed to the
// guardian, and verified by hash at the share door.
//
// THE CRM CANNOT REACH THIS COLLECTION. Doc 34 §3 extends doc 23's wall:
// "CRM sales surfaces never read summaries" — a session report in a renewal
// funnel is the flattery machine §1 warns about, industrialised.
// `tooling/check-crm-wall.mjs` walls this module off from `features/ops`,
// `features/org` and the ops routes, so the rule is a property of the module
// graph rather than of everyone's memory.
//
// No relationship to `users`. Learner identity travels as `learnerAuthId`, the
// same convention Consents, Guardianships, SafetyEvents and IncidentReports
// use (doc 13 §5); `session` is a `sessionId` text pointer for the same
// reason — the summary may outlive the session row, and a foreign key would
// let the transcript's deletion take the report.
// SOT: docs/pack/34-session-summary-reports.md §2 §3 · docs/pack/08-visual-hierarchy-spacing-spec.md · docs/pack/23-crm-spec.md §2
// SOT-KEYWORDS: session summaries collection report eight blocks evidence refs retention class guardian teacher share token suppressed draft queue

export const SessionSummaries: CollectionConfig = {
  slug: 'sessionSummaries',
  /*
    VERSIONS OFF — the canary defaults them ON (see Leads.ts), and here the
    default would be doubly wrong: Payload would mirror every lifecycle write
    into `_session_summaries_v`, and because this table deliberately has no
    `expires_at`, NOTHING would ever sweep the shadow copies — including the
    guardian's erasure, which deletes by `learner_auth_id` on the main table.
    "Delete my child's data" must not leave eight blocks about that child in a
    table nobody queries.
  */
  versions: false,
  admin: {
    useAsTitle: 'sessionId',
    defaultColumns: ['sessionId', 'learnerAuthId', 'status', 'sessionKind', 'publishedAt'],
  },
  access: {
    /*
      Authenticated only at the collection level; everything that matters is one
      layer up, exactly as IncidentReports records: guardians see own-ward rows
      through `apps/web/lib/summary.repository.ts`, which resolves ACTIVE
      guardianships before it queries, tutors see their org's draft queue, and
      the teacher-share door authenticates on the token hash, not a session.
      Identity is never a parameter (CLAUDE.md §The block), so none of that can
      be a static rule here.
    */
    read: ({ req }) => Boolean(req.user),
    // The lifecycle is the feature: generating → draft → published, a tutor
    // editing a draft, a guardian's viewedAt, a share being minted or revoked.
    update: ({ req }) => Boolean(req.user),
    /*
      Delete stays open, unlike IncidentReports, because deletion is a promise
      here: the guardian-controlled erasure cascade is what removes a summary,
      and a collection you cannot delete from cannot keep S27's "forget
      everything". Reviewer takedowns do NOT use it — they set `suppressed`.
    */
  },
  fields: [
    {
      /*
        THE NATURAL KEY. One session, one summary — unique so the pipeline job
        is idempotent by the database rather than by discipline: a pg-boss
        retry or a dead-letter replay that regenerates finds the row and
        updates it in place, and two racing executions collide here instead of
        putting two reports about one session in front of a parent.
      */
      name: 'sessionId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'learnerAuthId', type: 'text', required: true, index: true },
    {
      name: 'sessionKind',
      type: 'select',
      required: true,
      defaultValue: 'ai-tutor',
      options: ['ai-tutor', 'human-tutor', 'hybrid'],
    },
    {
      // Band affects CONTENT EXAMPLES, never the report's voice — doc 34 §2 is
      // explicit that the register is adult. Stored rather than re-derived so a
      // child changing bands does not rewrite what a parent was already shown.
      // Values are the codebase's VoiceBand casing ('k-2', not the doc sketch's
      // 'K-2') — packages/student-model/src/voice-band.ts owns band spelling.
      name: 'band',
      type: 'select',
      required: true,
      options: ['k-2', '3-5', '6-8', '9-12'],
    },
    /*
      ── The eight blocks, §2's fixed order, as columns ──────────────────────
      Structured fields, not an essay: "3–6 sentence recap" is named bad
      practice by the doc, and a schema with one text column would regrow one.
      The JSON columns carry shapes owned by
      `packages/app/features/summary/summary.types.ts`; JSON rather than
      Payload arrays for the reason `tutorSessions.messages` records — each is
      read and written as one unit, and nested array fields cost a join table
      per shape change.
    */
    // Block 1 — the headline accomplishment. The screen's single display moment.
    { name: 'headline', type: 'text', required: true },
    // Block 2 — `WorkedOnSkill[]`: { skillId, parentLabel, whyItMatters }.
    { name: 'workedOn', type: 'json', required: true, defaultValue: [] },
    /*
      Block 3 — `ProblemRow[]`, deterministic from session events, never
      generated: { subject, skillId, questionRef, childAnswer, attempts,
      status, submittedIncorrect?, orderInSession }. `questionRef` is
      `{ kind: 'capture-crop', mediaId }` or `{ kind: 'problem-text', text }` —
      an id, not a URL, so the crop is signed at read time under permission
      (doc 29 §5) and degrades to text, then to "source expired", when its TTL
      passes.
    */
    { name: 'problems', type: 'json', required: true, defaultValue: [] },
    // Block 4 — `MasteryMovement[]`: { skillId, before, after, gradePosition,
    // positionCopy }. Movement and position ride one row but render as two
    // axes, never conflated (§2.4).
    { name: 'mastery', type: 'json', required: true, defaultValue: [] },
    // Block 5 — { copy, evidenceRef } or null. Omitted-when-unevidenced is the
    // anti-sycophancy rule made a nullable column.
    { name: 'effortMoment', type: 'json' },
    // Block 6 — the continuity trail.
    { name: 'nextUp', type: 'text', required: true },
    // Block 7 — { conversationStarter, activity }. Exactly two items, by shape.
    { name: 'homeSupport', type: 'json', required: true },
    // Block 8 — { durationMin, attempted, solvedIndependently, solvedWithHelp }.
    // Context, never the story: minutes are not learning (doc 19).
    { name: 'facts', type: 'json', required: true },
    /*
      `EvidenceRef[]`: { kind: 'message' | 'event' | 'problem', id }. The
      grounding — every narrative claim maps into this list or the honesty lint
      refuses to publish. Ids only, permission-gated render, so the summary
      never holds a second copy of a child's words on a second clock.
    */
    { name: 'evidenceRefs', type: 'json', required: true, defaultValue: [] },
    // Provenance: { model, promptVersion, schemaVersion }. Auditable — "which
    // generator wrote what a parent read" is a question with a stored answer.
    { name: 'generator', type: 'json', required: true },
    // Must be true before `status` may become `published` — the service
    // enforces it; the column keeps the enforcement auditable.
    { name: 'safetyScreened', type: 'checkbox', required: true, defaultValue: false },
    /*
      ── Human-tutor path (§4 step 5, the LearnSpeed pattern) ────────────────
      The AI drafts, the human owns. `tutorDraft` is a `textarea` rather than
      the doc sketch's `richText` because this Payload config has no lexical
      editor anywhere and a session note is prose, not layout — adding an
      editor stack for one column would be a second way to store text.
    */
    { name: 'tutorDraft', type: 'textarea' },
    // Who approved a human/hybrid session's report. `*AuthId` pointer, doc 13 §5.
    { name: 'tutorApprovedByAuthId', type: 'text', index: true },
    // ── Lifecycle & sharing ─────────────────────────────────────────────────
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'generating',
      index: true,
      options: ['generating', 'draft', 'published', 'suppressed'],
    },
    { name: 'publishedAt', type: 'date' },
    // The visibility loop — written on first open, which is also what makes
    // viewed-rate (not sent-rate) the honest org metric (§5).
    { name: 'guardianViewedAt', type: 'date' },
    /*
      Suppression is LOGGED, never silent: the reason rides the row, and the
      absence of a delete on this path is deliberate. Required-by-service when
      `status` is `suppressed` — a takedown nobody can explain is a takedown
      that gets repeated.
    */
    { name: 'suppressionReason', type: 'textarea' },
    { name: 'suppressedAt', type: 'date' },
    /*
      `{ enabled, tokenHash, expiresAt, revokedAt }` or null. Guardian-initiated
      (§3): the guardian owns consent, which keeps the FERPA posture clean.
      HASH, never the token — see the file header.
    */
    { name: 'teacherShare', type: 'json' },
    // Weekly rollup membership (§5). Null until a digest claims the row.
    { name: 'digestBatchId', type: 'text', index: true },
  ],
};
