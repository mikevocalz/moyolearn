# ADR 108: Tutor↔learner engagement becomes a first-class row
Status: accepted · Date: 2026-09-02
Accepted: 2026-09-02 — lands with this commit.

<!--
What it is: the schema decision the tutor.incidents intake blocker named — whether
a tutor→learner relationship exists as data this codebase can verify a filing
subject against, and where that edge lives.
Why it exists: `submitIncident` verifies a subject against the caller's own
wards, a relationship a tutor does not have; the intake door on tutor.incidents
stayed deliberately undrawn until a verifiable edge existed (the empty state's
own record, scoping B2/B3). Three files independently name the missing edge as
"a schema ADR of its own." This is that ADR.
SOT: docs/pack/36-role-navigation-flows.md §3.3 ·
     docs/pack/31-grade-voice-safety-incidents.md §4.2 §5.1 ·
     packages/payload/src/collections/TutorEngagements.ts
SOT-KEYWORDS: adr tutor learner engagement edge roster subject verification
              incidents intake my learners de-fixture overhaul
-->

## Context

- **Filing needs a verifiable subject.** `subjectLearnerAuthId` is required on `incidentReports`, and the human intake door (`submitIncident`) checks the posted subject against the caller's own active guardianships — a report about a child the caller has no relationship with is a write into somebody else's record. A tutor holds no guardianship, so tutor intake had nothing to verify against and the door was not drawn (`tutor-incidents-content.tsx`'s header, B2/B3).
- **Verified absence, not inferred (step-0 sweep, 2026-09-02):** no `tutorAuthId` exists anywhere in the schema or code outside the comments recording its absence. `tutorSessions` models AI sessions and carries only `learnerAuthId` (doc 23's one-continuing-relationship thread — the "tutor" in that collection is the product). The schedule feature's `BookingForm` persists nothing — its submit writes a zustand override over `DEMO_*` fixtures and says so ("Booking creation is not backed by a collection yet"). Session-prep and My learners run on fixtures. The registered collections hold exactly two person-edges: guardian↔learner (`guardianships`) and learner↔org (`enrollments`). No booking, engagement, or roster row links a tutor to a learner.
- **Doc 36 §3.3 already assumes the edge twice:** the tutor surface is "Incidents (mine + my sessions)" and the sidebar has "My learners" — both need a tutor→learner (or tutor→session) relationship the schema does not hold.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| A — `TutorEngagements` collection | A row per tutor↔learner pair per org: `tutorAuthId` · `learnerAuthId` · `orgId`, `status active\|ended`, `startedAt`/`endedAt` | `packages/payload/src/collections/TutorEngagements.ts` (new, Guardianships' conventions) | The roster edge as its own fact, independent of any session having happened; the wards-intersection shape transfers to tutor intake one relationship over; the future My-learners read | A second roster-ish collection beside `enrollments` (different edge, same idiom) |
| B — `tutorAuthId` column on `tutorSessions` | Derive the roster from who sessioned with whom | `packages/payload/src/collections/TutorSessions.ts` | No new table | **Conflates AI sessions with a human engagement** — that collection is the child's conversation with the product, and a human tutor id on it would misstate what a session row is; no edge before a first session; a roster inferred from activity, guessed on a safety surface |
| C — derive from CRM leads | `leads` already carries family/learner/owner per org | `apps/web/lib/leads.repository.ts` | Data exists today | The CRM wall runs the other way (doc 31 §4.2 / doc 23 §2): a safety surface fed by sales data structurally couples the two stores the wall separates; `owner` is a display name, not an auth id |

## Decision

**The tutor↔learner engagement becomes a first-class row: a `TutorEngagements` collection.** Minimal by design — `tutorAuthId` (indexed), `learnerAuthId` (indexed), `orgId` (indexed), `status active|ended`, `startedAt`, `endedAt?` — with one row per `(tutorAuthId, learnerAuthId, orgId)` held unique: the row is the edge's current state, not its history, so a re-engagement reactivates the row rather than appending a second one. Auth ids are pointers by convention (doc 13 §5), never foreign keys.

This is the roster edge tutor.incidents intake verifies subjects against — `submitTutorIncident` intersects the posted subject with the caller's ACTIVE engagements, the exact shape `submitIncident` runs against wards — and the de-fixturing path for "My learners."

**What this deliberately does NOT solve:** the "my sessions" half of doc 36 §3.3's incident scope still needs a **session→tutor edge**, and this collection is not one. An AI `tutorSessions` row must not be conflated with a human engagement — that is precisely why this is a new collection and not a column on `tutorSessions` — so a session-scoped incident read remains deferred until that edge is its own decision. The tutor incidents list stays reporter-scoped ("mine") with the gap recorded, not papered over.

## Consequences

- Easier: tutor intake opens honestly (subject verified, not trusted); the empty state's deferral notice becomes the contract's real filing affordance; a future My-learners read is one repository away instead of one schema away.
- Harder: **no creation UI exists yet** — engagements are org/scheduling work that has no screen, so rows enter via ops or seed for now (`seed-walkthrough.mts` seeds the tutor cells' engagements so walkthroughs exercise the live path); a booking flow that persists would be the natural writer once one exists.
- The migration is hand-extracted and additive (`tutor_engagements_additive.sql`), for the reason every sibling records: no migration baseline, so `payload migrate:create` re-emits the world.
- Follow-ups: the session→tutor edge ADR when "my sessions" scope is built; an engagement lifecycle surface when scheduling lands.

## Default replaced

The prior default was recorded in three headers as "no edge exists, so the door is not drawn" — a deferral, not a design. This ADR replaces that recorded silence with the edge itself; the B2/B3 decision comments become descriptions.

## Constraints honored
Identity never a parameter (subject checked against `ctx`-scoped engagements) · pointers not FKs (doc 13 §5) · no invented APIs (Guardianships/Enrollments conventions reused) · CRM wall untouched (doc 31 §4.2) · doc references (36 §3.3 · 31 §4.2 §5.1 · 13 §5)
