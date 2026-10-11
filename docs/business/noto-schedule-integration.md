# Schedule integration contract

<!--
What: bounded contract for replacing the existing schedule's fixtures with durable human-session scheduling.
Why: a live ops summary and a local booking form do not yet constitute a persisted calendar.
SOT: packages/payload/src/collections/Sessions.ts; docs/decisions/adr-110-sessions-object.md.
SOT-KEYWORDS: business schedule sessions booking calendar timezone concurrency resource tenant contract
-->

Status: design contract only. This change adds no routes, collections, migrations, booking writes or runtime UI. The implementation and its acceptance tests remain outstanding. Source observations below were checked against `5db18da79ed0e4cd8d66ec86917b4d52c6fd6354`.

## Existing system to extend

- [ScheduleScreen](../../packages/app/features/schedule/screen.tsx) supplies `DEMO_DAY`; [Schedule](../../packages/app/features/schedule/Schedule.tsx), [ScheduleGrid](../../packages/app/features/schedule/ScheduleGrid.tsx), [BookingForm](../../packages/app/features/schedule/BookingForm.tsx), and [the Zustand store](../../packages/app/features/schedule/store.ts) already own rendering, selection and local move overrides. Keep their public feature exports and existing route hosts.
- [Sessions](../../packages/payload/src/collections/Sessions.ts) is the Payload **human-tutoring** calendar object: tenant `orgId`, `tutorAuthId`, learner display text / optional text pointer, `scheduledAt`, `endsAt`, `status`, `mode`, `joinUrl` and `room`. It is distinct from AI `tutorSessions`; do not join CRM into learner content.
- [The sessions repository](../../apps/web/lib/sessions.repository.ts), [ops service](../../packages/app/features/ops/ops.service.ts) and [GET /api/ops/sessions](../../apps/web/app/api/ops/sessions/route.ts) serve today's ops summary. The response has display strings, uses the server's day/time zone and caps its query at 200 rows. It does not supply the grid's absolute event times, stable resource IDs, arbitrary range or availability.
- [ADR 110](../decisions/adr-110-sessions-object.md) explicitly leaves the booking write path, availability, conflict enforcement and attendance open. BookingForm currently stores local fixture overrides and shows a success toast; it does not persist a booking. A mobile sheet opening successfully is not evidence of a durable create.
- [The screen contract](../../design/screens/org/org.schedule/contract.md) keeps resource-major columns, rollback, offline read-only behavior and cross-device server truth. Its historical navigation wording must be reconciled with current repository instructions before UI work; do not introduce a second calendar or shell.

## Proposed read contract

1. Extend the existing service/repository boundary with a calendar-specific read model. Preserve the ops-summary response for existing consumers rather than replacing it with an incompatible shape. Domain types derive from generated Payload types; features use public exports and type-only cross-boundary imports.
2. Accept a bounded date/range selection, never a caller-supplied tenant or acting identity. Resolve membership and `orgId` from `protectedOperation()` context, then apply the tenant predicate in every repository query. Reject invalid dates, reversed ranges, unsupported ranges and invalid zones before querying. No org must never mean an unscoped read.
3. Return absolute ISO start/end instants, stable session IDs, stable tutor/resource IDs and an explicit IANA calendar zone. The adapter converts instants to the existing `ScheduleDay` / `ScheduleEvent` model. Tutor display names are labels, never resource keys; no fixture IDs enter production writes.
4. Include every event intersecting the half-open window: `scheduledAt < to` and `endsAt > from`. A lesson starting before midnight and ending inside the displayed day must remain visible. Paginate to completion or surface an explicit incomplete result; never silently inherit the summary's 200-row truncation.
5. Establish the organization's authoritative calendar-zone setting and tutor/availability source as part of the implementation. [Organizations](../../packages/payload/src/collections/Organizations.ts) has no calendar-zone field today. Do not silently use the device or server zone. Resolve wall-clock selection to an instant using that date's zone rules; reject nonexistent DST times and require explicit disambiguation for repeated local times. Test 23-hour and 25-hour days.
6. Model room identity/availability before promising room conflict detection: `Sessions.room` is currently text, not a canonical room resource. Preserve tutor-major scheduling without inventing room IDs or booking unschedulable resources.

## Proposed create and move contract

- Keep all writes behind `protectedOperation()` → service → server-only repository. Read/export and write capabilities are separate; preserve the existing ability to read a lapsed organization's own data. Verify membership and the chosen tutor's eligibility in this org server-side. A target tutor/resource selection is untrusted business input, never an acting identity or proof of access.
- Validate an existing in-scope family/lead context when supplied, tutor, duration (`endsAt > scheduledAt`), permitted status and mode-specific fields. An unavailable or cross-tenant object is a failure without disclosure of the other tenant. Do not accept arbitrary client `orgId`, actor IDs, saved status or financial state.
- Enforce overlap in the same atomic write boundary as persistence. Two concurrent creates or moves onto one tutor's overlapping interval must yield at most one success. A client-side free-slot check or a read-then-create check alone is insufficient. Document and test the chosen PostgreSQL transaction/locking or constraint strategy against the existing Payload adapter; this document does not claim one is installed.
- Use half-open intervals so adjacent bookings can touch. Scheduled and completed sessions block overlaps; canceled and missed sessions remain history. Moves apply only to scheduled sessions. Any future group-capacity or room policy must be explicit rather than weakening this invariant by accident.
- Require an org-scoped idempotency key for create and a concurrency precondition for move. Same key and same request returns the original committed result; reuse with a different request is rejected. A stale move is rejected instead of overwriting a newer device's edit. Retrying an uncertain network response must not make another session.
- Return the canonical persisted session on success. Only then show “Booking created” and dismiss the form. On a failed create keep the draft; on a failed move remove only that request's optimistic override, restore server truth and show the reason. Refetch after success or conflict and after reconnect. Late responses for an old org, range or edit must not overwrite newer state.
- Keep viewing state device-local and clear tenant-scoped cached records/drafts on org or identity changes. Selection, form input and scroll intent must survive ordinary resizing/folding without recreating the store. Offline writes remain disabled until a separately tested durable retry protocol exists.

## UI and integration acceptance

Reuse `@acme/ui`, semantic components, tokens, Zustand/refs, existing BookingSheet and the current layout adapters. No duplicate components, raw HTML feature screens, decorative dashboards or fabricated availability. Load CONTRIBUTING, relevant React/Expo and design skills, plus the [pinned tailored foldable skill](https://github.com/mikevocalz/universal-spatial-starter/blob/256a97b132803fd2fb8049f7a120cef9cb641f41/.agents/skills/mikevocalz-foldable-layouts/SKILL.md) before adaptive work. Native hardware family controls navigation; usable pane space controls content. Web retains its web shell. Do not apply the generic SwiftUI source as a React Native architecture.

Implementation acceptance requires recorded evidence for:

1. A real in-scope Payload session appears with identical times and tutor identity in the grid and on refresh/another device. Date switches, cross-midnight events and all pages are covered.
2. Create and move persist; concurrent overlap, idempotent replay, mismatched replay and stale update behave as specified. Tests use a real transactional test database as well as pure interval tests.
3. Missing membership, another tenant's IDs, invalid input and lapsed-plan writes are denied; authorized read/export remains available. Tutor/guardian projections expose only their authorized sessions.
4. Loading, empty, forbidden, server error, offline, conflict, stale response and saved states remain distinguishable. Repeated submit, dismiss during a request, Cancel/Close and Back/Forward do not create duplicate work or false success.
5. Compact/expanded layouts, intermediate resizing, RTL, keyboard, text scaling, screen readers and fold/hinge transitions retain usable actions and draft/selection state. Label simulator/browser evidence separately from physical-device validation.

## Review and delivery gates

For this documentation change, verify every source link and existing-versus-proposed claim, review the tenant/privacy/conflict rules, and record checks actually executed in the PR. A docs PR may be ready for **design review** without asserting implementation completion.

A later implementation must pass relevant unit/integration and permission tests, cold-cache `pnpm typecheck`, applicable lint/build checks, and the device acceptance above before it is ready. Extend [schedule tests](../../packages/app/features/schedule/schedule.test.ts) rather than substituting them for persistence/concurrency tests. No migration, deployment, live booking or payment is authorized by accepting this document.
