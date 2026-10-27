# MB-14: Integrations Hub and Google Calendar sync

<!-- What: Integrations Hub and Google Calendar sync implementation contract. -->
<!-- Why: ship scoped operations capability without duplicating Moyo Learn or its tenant data. -->
<!-- SOT-KEYWORDS: moyo business calendar integration acceptance provider release -->

**Status:** Documentation and engineering scope only; not an implemented feature. **Implementation blockers:** MB-05, MB-07. See [MB-01 architecture #101](https://github.com/mikevocalz/moyolearn/pull/101) and #96 scheduling contract.

## Existing modules and first inspection targets

- `packages/app/features/schedule`
- `packages/jobs`
- `packages/auth`
- `apps/web/app/(business)/settings`
- `apps/web/app/api`
- `docs/business/noto-schedule-integration.md`

## Complete user journey to implement

1. Owner connects their approved Google Calendar account with requested least-privilege OAuth scopes and visible connection health.
2. Booking an authorized committed Moyo human session creates/updates a matching provider event; reauth, event deletion, reschedule and network failure show recoverable sync state.
3. Operator sees calendar conflicts and imported busy spans, but the booking is always committed against Moyo's authoritative scheduling rules.

## Ownership and implementation invariants

- Moyo `Sessions` and chosen organization IANA calendar zone remain canonical; external calendar is an adapter at the existing scheduling service seam.
- Store OAuth tokens server-side encrypted/scoped; revocation, grant renewal and disconnect must not expose other tenants' calendars.
- Use stable mapping `(org, Moyo Session ID, provider calendar/event ID)` with idempotent sync jobs, cursor/checkpoint and owner-bound accounts.
- Prevent infinite provider/Moyo echo loops, stale provider callbacks, and duplicate events on replay.
- Google Calendar attendee lists and full descriptions may contain unrelated private information; minimize imported fields for busy state and do not pipe to CRM marketing.
- List connecting accounts, last successful sync, failures and action to repair on Integrations Hub; no false 'Synced' badges from optimistic clicks.
- DST wall-clock and calendar recurrence exceptions must be reconciled without shifting canonical UTC instants.

## Acceptance criteria and release evidence

- [ ] Two-way conflict policy explicitly handles moved, canceled, removed, recurring exception and provider outage cases.
- [ ] Wrong org, revoked membership, revoked OAuth and webhook replay cannot create or read provider state.
- [ ] Two consecutive sync jobs for same session create one external event; loops stop; cursor advance follows confirmed persistence.
- [ ] Timezone changes and DST boundary events preserve instants on Google and Moyo views.
- [ ] Disconnected provider leaves core Moyo booking functional; no shadow scheduling database.
- [ ] Browser/phone/foldable Integrations Hub shows failure and reconnect affordances accessibly.

## Review and release plan

**Independent reviewer roster:** Calendar sync architect, OAuth security specialist, Postgres job/retry engineer, scheduling UX QA.

**Skills:** Read root AGENTS.md/CONTRIBUTING.md and the actual installed target files before runtime changes. Load relevant expo/skills, mattpocock/skills (PR/module design), coreyhaines31/marketingskills, pbakaus/impeccable, petergyang/no-ai-slop and the pinned mikevocalz-foldable-layouts skill for adaptive work. Honor the current catalog and existing @acme/ui/motion/route adapters.

**Rollback:** Revoke/disable calendar adapter and stop outbox delivery; retain canonical Moyo sessions and reconciliation logs.

**Actual evidence for this planning PR:** reviewed GitHub source and existing specs; created branch/document/draft PR. No compile, lint, native build, database test, provider sandbox, real device, account connection or deployed changes were executed. Keep PR in draft until a complete tested implementation is added. Document unsupported devices separately. Do not auto-merge, rename subscriptions, send communication or execute transfers based on this contract.
