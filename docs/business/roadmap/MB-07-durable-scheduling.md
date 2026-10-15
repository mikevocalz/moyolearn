# MB-07: Durable scheduling and Find Slot

<!-- What: Durable scheduling and Find Slot implementation contract. -->
<!-- Why: reviewable end-to-end operations slice built on canonical Moyo services. -->
<!-- SOT-KEYWORDS: moyo business durable scheduling roadmap test gates -->

**Status:** Planning/review draft only. Existing behavior unchanged; no migration, payment, provider write or runtime feature is implemented here.
**Implementation blocked by:** MB-05, MB-06. Architecture: [MB-01 PR #101](https://github.com/mikevocalz/moyolearn/pull/101).

## Source-of-truth files to inspect and extend

- `packages/app/features/schedule/BookingForm.tsx` — inspect currently installed interfaces and tests before editing
- `packages/app/features/schedule/ScheduleGrid.tsx` — inspect currently installed interfaces and tests before editing
- `packages/app/features/schedule/store.ts` — inspect currently installed interfaces and tests before editing
- `packages/payload/src/collections/Sessions.ts` — inspect currently installed interfaces and tests before editing
- `apps/web/lib/sessions.repository.ts` — inspect currently installed interfaces and tests before editing
- `docs/business/noto-schedule-integration.md` — inspect currently installed interfaces and tests before editing

## User-visible tracer bullet

1. Scheduler selects a verified lead/family and subject; `Find Slot` ranks *real* eligible tutors and their resource/room availability.
2. Staff confirms one appointment; a real committed Session ID appears in the calendar and still appears after reload or from another device.
3. Operator reschedules a session, sees conflict feedback or optimistic rollback, and can review attendance-eligible event state; no fixture 'success' toasts.

## Domain and authorization contracts

- Preserve existing human `Sessions` collection and scheduling UI; `TutorSessions` is AI learning data and may not be joined into CRM.
- Use absolute ISO instants plus validated IANA organization timezone; require explicit resolution of DST ambiguous wall time, reject nonexistent time.
- Use half-open intervals and include events intersecting a window even when they start before midnight. Clip visual segments only, never mutate the canonical booking instant.
- Tutor/resource conflicts must be prevented in Postgres at the transaction boundary, not only by local solver reads. Adjacent appointments may touch.
- Create is idempotent with org-scoped key; reschedule requires an optimistic concurrency revision. Unknown results must not encourage blind retries.
- Canceled/missed history is preserved and not busy; scheduled/completed sessions block under the approved policy; room is currently a text label, not a canonical resource.
- Never write `orgId`/actor from client or infer `familyId` from learner display names. Booking drafts survive errors.

## Required implementation acceptance

- [ ] Real Postgres simultaneous overlapping create race accepts at most one; mismatched idempotency replay is rejected.
- [ ] DST spring-forward/fall-back, half-hour offset zones and cross-midnight segment geometry preserve original instants.
- [ ] Create, move, cancel, failure and retry repeat against two devices and account scopes; no fixture events claim production records.
- [ ] Foreign-tenant tutor, org-less session and mismatched lead-family relation fail without leakage.
- [ ] Client failure leaves unsaved draft intact and rolls back only that request's optimistic move.
- [ ] Fold/unfold/RTL/keyboard preserve selected session and booking form; actual devices evaluated separately.

## Review, skills and rollback

**Owners:** Postgres concurrency engineer, scheduling domain engineer, React Native adaptive-layout engineer, QA.

**Required relevant skills:** Root AGENTS.md and CONTRIBUTING.md; mattpocock/skills PR and module design; expo/skills for native changes; coreyhaines31/marketingskills for product/financial UX; impeccable and no-ai-slop; pinned mikevocalz-foldable-layouts for adaptive screens. Re-evaluate current dependency catalog and migrations before implementation.

**Rollback:** Feature-flag durable writes; retain existing Sessions history and use audited corrections. Never replace repository with demo scheduler.

**Evidence now:** GitHub repo inspection and documentation commit only. Runtime code, schema migrations, CI, real Postgres, browser, simulator, physical device, provider sandbox, and production validations were not run. Keep draft until complete behavior, test results and required security/financial reviews appear. Do not merge this document as a substitute for implementation.
