# ADR 110: The human-tutoring session becomes a first-class row
Status: accepted · Date: 2026-09-02
Accepted: 2026-09-02 — lands with this commit.

<!--
What it is: the schema decision two files independently recorded as missing —
whether doc 01 §7.1's planned `sessions` collection exists as an org-scoped row,
and whether it carries the session→tutor edge ADR-108 named as its explicit
non-goal.
Why it exists: ops.data.ts holds "today's sessions" as a fixture whose own
comment says the collection is planned but absent, and ADR-108 closed the
tutor→learner edge while recording that "my sessions" incident scope "remains
deferred until that edge is its own decision." This is that decision.
SOT: docs/pack/01-ai-tutoring-platform-plan.md §7.1 ·
     docs/pack/28-crm-spec.md §2 §5 §7 ·
     docs/decisions/adr-108-tutor-learner-edge.md ·
     packages/payload/src/collections/Sessions.ts
SOT-KEYWORDS: adr sessions object calendar event human tutoring session tutor
              edge ops hero today my sessions incident scope booking de-fixture
-->

## Context

- **Two recorded gaps, one missing object.** `ops.data.ts` ships "today's
  sessions" as `SESSIONS_BY_ORG`, "and honestly so: doc 01 §7.1 plans a
  `sessions` collection … but neither exists" (its own words). And ADR-108,
  having built the tutor→learner roster edge, recorded its deliberate limit:
  doc 36 §3.3's "Incidents (mine + my sessions)" still needs a **session→tutor
  edge**, and `tutorEngagements` is not one — "a session-scoped incident read
  remains deferred until that edge is its own decision."
- **Doc 01 §7.1 is the plan, terse by design:** `sessions` ("human/AI/hybrid;
  the calendar engine's core event") sits in the initial-24 list beside
  `availabilities`, `services` and `rooms`. It names no fields — no
  `learnerAuthId`, no shape — so the shape follows the schema's own precedents.
- **ADR-108's reasoning binds here.** `tutorSessions` models the child's AI
  conversation with the product — "the tutor" in that collection is the product
  itself — and ADR-108 rejected putting a human tutor id on it precisely
  because it "would misstate what a session row is." Whatever doc 01 §7.1's
  "human/AI/hybrid" gloss suggests, an AI conversation must never become a row
  in a scheduling table, and a scheduled human session must never be written
  into a child's conversation log.
- **The wall places the object.** Doc 28 §2 lists **Session (scheduling)**
  among the CRM objects — "CRM rows hold relationship, scheduling, attendance,
  and billing context — never learning content" — so scheduling context is
  CRM-permitted, and the collection lives on the ops side of the wall with the
  Leads/Families conventions.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| A — `Sessions` collection | An org-scoped row per scheduled human session: `orgId` · `tutorAuthId` · learner as display text + `learnerRef` pointer · `scheduledAt`/`endsAt` · `status` · `subject` · `mode` | `packages/payload/src/collections/Sessions.ts` (new, Leads' conventions) | The calendar event as its own fact; the session→tutor edge ADR-108 deferred; the ops hero's real read; the future booking write target | A third ops-side collection; a translation layer at the repository edge |
| B — widen `tutorSessions` | Add `tutorAuthId`/`scheduledAt` to the AI conversation row | `packages/payload/src/collections/TutorSessions.ts` | No new table | **Rejected by ADR-108's own reasoning** — that collection is the child's conversation with the product; a calendar field set on it conflates a retention-scheduled learner-content record with a business scheduling object |
| C — derive from `leads.nextSessionAt` | The pipeline already stores one next-session timestamp per lead | `apps/web/lib/leads.repository.ts` | Data exists today | A single timestamp on a funnel row is not a calendar: no tutor edge, no end time, no status, no second session per family; the hero would render the pipeline's guess and "my sessions" would still have no edge |

## Decision

**The human-tutoring session becomes a first-class org-scoped row: a
`sessions` collection (option A), per doc 01 §7.1.** Fields: `orgId` (indexed)
· `tutorAuthId` (indexed — a Better Auth pointer by convention, never a
relationship, doc 13 §5) · `learner` display text + `learnerRef` (optional text
pointer to the identity docs) · `subject?` · `scheduledAt` and `endsAt`
(indexed) · `status` (`scheduled | completed | canceled | missed` — the enum
doc 28 §4's `session.missed` trigger and attendance-driven billing will read) ·
`mode` (`virtual | in-person`, doc 10 §2.3's lowercase literals) with optional
`joinUrl`/`room` · `needsAttention` (the doc 28 §6 scorer's flag, same as
Leads). The row is **distinct from AI `tutorSessions` by design** — that
distinction is ADR-108's reasoning carried forward, and it is why this is a new
collection rather than a widened one. "Hybrid" (doc 01 §7.1) is two records
coexisting: the scheduled human session here, the AI conversation there,
joined by nothing.

**The learner linkage follows the Leads/Families precedent: text refs.**
Doc 01 §7.1 does not specify `learnerAuthId`, so the row carries display text
plus a `learnerRef` pointer, exactly as `leads` does — a session is a CRM
scheduling object and must not hand ops queries a join into learner identity.
**The identity the tutor incident join needs is the TUTOR's, not the
learner's**, and it lives here as `tutorAuthId`: "incidents on my sessions"
must verify *my* against `ctx`, which only an auth-id pointer can do. The
learner side of an incident is already identified on the incident row itself
(`subjectLearnerAuthId`), behind the wall where it belongs.

**What this closes:**
- The ops hero's "Today's sessions" reads real rows (`loadSessions` →
  `listSessions` → `GET /api/ops/sessions`); `SESSIONS_BY_ORG` dies keeping its
  own comment's promise.
- Doc 31 §4.2 / doc 36 §3.3's full tutor incident scope: "mine + my sessions"
  — `loadTutorIncidents` widens to `reporterAuthId = me OR relatedSessionId IN
  (my sessions)`, with the two-layer law intact. ADR-108's recorded gap gets
  its closure note.
- The future booking-persistence path has a write target: when a scheduling
  surface reads real org tutors and availability, its create writes here.

**What this deliberately does NOT solve:**
- **Revenue.** Doc 28 §7 routes revenue through doc 19 §5's rollup tables into
  the doc 27 chart layer. No rollup exists, so `REVENUE_BY_ORG` stays an honest
  fixture, its comment now citing this ADR's scoping rather than a vague
  future.
- **The BookingForm write path — deferred, and the deferral is recorded.** The
  form's instructor chips and slot list run entirely on `DEMO_RESOURCES` /
  `DEMO_DAY` fixtures; wiring its submit to a real create would first need an
  org-tutor roster read and a real availability read (neither exists), and the
  write path is where doc 28 §5's zero-double-booking invariant must be
  enforced — a conflict-naive create shipped ahead of those reads would post
  demo resource ids into a real calendar. The form stays a zustand override
  over fixtures, its comment updated to cite this ADR.
- **Attendance capture.** `status: missed` is writable data, but nothing marks
  it yet; attendance-driven billing (doc 28's table stakes) is its own slice.
- **Scheduling assist / conflict detection** (doc 28 §5): the solver and its
  invariant arrive with the write path, not with this read-mostly slice.

**One assumption, stated:** `incidentReports.relatedSessionId` today holds AI
`tutorSessions` ids (UUIDs minted by `openSession`); human session rows are
Payload serials. The "my sessions" join treats the column as one id namespace —
safe because the two mints cannot collide in practice — and the repository
comments the assumption where the query runs.

## Consequences

- Easier: the ops Overview stops lying politely; tutor incident scope matches
  its contract in full; walkthroughs exercise a live sessions read
  (`seed-walkthrough.mts` seeds sessions mirroring the engagement roster —
  Rosa, James and Ingrid × their engaged learners, today and this week).
- Harder: **no creation UI exists yet** — sessions enter via ops or seed for
  now, the same posture as `tutorEngagements`; the display translation (row →
  "09:00–09:45" view) lives in the repository, the Leads money/clock idiom.
- The migration is hand-extracted and additive (`sessions_additive.sql`), for
  the reason every sibling records: no migration baseline, so
  `payload migrate:create` re-emits the world.
- The new `sessions.repository.ts` registers in `check-crm-wall.mjs`'s
  `CRM_ROOTS` in the same commit — ADR-109's rule: a CRM file outside the
  roots is silently unwalled. The incident repository reading the `sessions`
  collection is the ALLOWED direction: the wall bans CRM→incidents, never
  safety→scheduling.
- Follow-ups: the booking write path (with doc 28 §5's conflict invariant) when
  the scheduling surface de-fixtures; attendance capture; the doc 19 rollups
  that finally retire the revenue fixture.

## Default replaced

The prior default was recorded twice — ops.data.ts's "sessions and revenue are
still fixtures, and honestly so" and ADR-108's "the tutor incidents list stays
reporter-scoped ('mine') with the gap recorded, not papered over." This ADR
replaces the sessions half of both with the object itself; the revenue half
stays deliberately open, now citing doc 19 by name.

## Constraints honored
Identity never a parameter (`orgId`/`tutorAuthId` predicates run against `ctx`
at every seam) · pointers not FKs or relationships (doc 13 §5; learnerRef per
doc 28 §2) · AI/human sessions never conflated (ADR-108) · CRM wall untouched
and one-directional (doc 31 §4.2 · doc 23 §2) · no invented APIs
(Leads/TutorEngagements conventions reused) · doc references (01 §7.1 · 28 §2
§5 §7 · 31 §4.2 · 36 §3.3 · 10 §2.3 · 13 §5 · 19 §5)
