# MB-08: Services, programs, staffing and resource capacity

<!-- What: Services, programs, staffing and resource capacity implementation contract. -->
<!-- Why: reviewable end-to-end operations slice built on canonical Moyo services. -->
<!-- SOT-KEYWORDS: moyo business program resources roadmap test gates -->

**Status:** Planning/review draft only. Existing behavior unchanged; no migration, payment, provider write or runtime feature is implemented here.
**Implementation blocked by:** MB-07. Architecture: [MB-01 PR #101](https://github.com/mikevocalz/moyolearn/pull/101).

## Source-of-truth files to inspect and extend

- `packages/app/features/institution` — inspect currently installed interfaces and tests before editing
- `packages/app/features/org` — inspect currently installed interfaces and tests before editing
- `packages/app/features/schedule` — inspect currently installed interfaces and tests before editing
- `packages/payload/src/collections/Organizations.ts` — inspect currently installed interfaces and tests before editing
- `packages/payload/src/collections/Enrollments.ts` — inspect currently installed interfaces and tests before editing

## User-visible tracer bullet

1. Owner creates a tutoring service with subject, duration, eligibility and policy, associates qualified tutors, and optionally assigns a canonical room.
2. Center operator creates a group program with dates, capacity and location, then puts an applicant on a verified waitlist.
3. Scheduler can book a lesson only when tutor eligibility, location, staffing and room/group capacity permit it.

## Domain and authorization contracts

- Introduce service/program/resource objects through existing Payload module and generated type patterns; no independent business catalog database.
- Group enrollment/waitlist is an operational program relationship; institutional Enrollments retain separate school-learning semantics.
- A price/policy change affects new bookings only; historical financial obligations later snapshot their approved policy in MB-09.
- Capacity changes use atomic transactions and prevent double allocation. Resources have stable IDs; legacy `Sessions.room` string remains a display label until explicitly reconciled.
- Staff access is scoped to assigned location/program; employees managing room inventory are not finance approvers.
- External calendar availability may inform scheduling but does not become the canonical owner of resource capacity.

## Required implementation acceptance

- [ ] Atomic concurrent group admission cannot exceed capacity; newly freed seat promotes only authorized next candidate.
- [ ] Two tenants can share identical service/room names without linking records or exposing counts.
- [ ] Booking against ineligible tutor/room, closed program, or stale capacity is refused and does not update lead stage.
- [ ] Program pricing changes do not rewrite previous session snapshots.
- [ ] Accessible web/tablet/phone program editor uses existing responsive pane conventions.
- [ ] Partial migrations retain old sessions and never fabricate room IDs from free text.

## Review, skills and rollback

**Owners:** Domain modeling lead, institutional operations expert, Postgres engineer, design QA.

**Required relevant skills:** Root AGENTS.md and CONTRIBUTING.md; mattpocock/skills PR and module design; expo/skills for native changes; coreyhaines31/marketingskills for product/financial UX; impeccable and no-ai-slop; pinned mikevocalz-foldable-layouts for adaptive screens. Re-evaluate current dependency catalog and migrations before implementation.

**Rollback:** New catalog module is additive; disable new bookings and preserve existing records when rolling back.

**Evidence now:** GitHub repo inspection and documentation commit only. Runtime code, schema migrations, CI, real Postgres, browser, simulator, physical device, provider sandbox, and production validations were not run. Keep draft until complete behavior, test results and required security/financial reviews appear. Do not merge this document as a substitute for implementation.
