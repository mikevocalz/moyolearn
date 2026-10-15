# MB-03: Organization onboarding and industry profiles

<!-- What: Organization onboarding and industry profiles, bounded against current Moyo Business source-of-truth modules. -->
<!-- Why: independent education-first operations without duplicating the learning platform. -->
<!-- SOT-KEYWORDS: moyo business industry onboarding implementation acceptance -->

**Status:** Implementation contract only; no production feature, migration, device test or third-party write in this change.
**Base reviewed:** `main@a6afe6593060b73c8fc7b61d2ee0e0800204f1f3`; **blockers for implementation:** MB-01 (#101).
**Related existing work:** MB-01 architecture (#101).

## Existing ownership and intended files

- `packages/payload/src/collections/Organizations.ts` (inspect actual exports and tests before editing)
- `packages/auth/src/host-tenant.ts` (inspect actual exports and tests before editing)
- `packages/app/features/org` (inspect actual exports and tests before editing)
- `packages/app/features/onboarding` (inspect actual exports and tests before editing)
- `packages/app/features/org-settings` (inspect actual exports and tests before editing)

## User-visible vertical slice

- New owner chooses tutoring, learning-center, school or district intent and sets organization identity, IANA calendar zone, services and team; existing organizations continue opening unchanged.
- A tutoring operator invites staff and enters the real existing CRM/calendar; noneducation `service_business` is a future tested configuration, not a promised launch option.
- Role/organization switching returns to the right industry features without requiring a second account.

## Data, security and UX contracts

- Extend `Organizations` additively; `slug` remains the tenant identity and `Organizations.kind` currently enumerates tutoring/school/district. Do not overwrite or re-key old rows.
- Prefer a capability/industry profile field separate from existing security role and organization kind; school hierarchy remains the existing school-to-district relationship.
- Source the timezone from an explicit verified IANA setting, not the device/server; address invalid and DST wall-clock selections.
- Guard new reserved subdomains consistently in slug validator and host resolver before introducing any public Business host.
- Onboarding may ask for organization details and voluntary invites, but never silently provision Stripe Connect, send emails, or require push permission before useful work.
- Save/retry idempotently with context-derived actor and organization; duplicate submission cannot create two tenants.

## Acceptance and failure-path evidence

- Migration/backfill preserves existing slug, kind, brands, membership edges and Stripe reference IDs; rollback does not delete org records.
- Two owners choosing the same slug cannot collide; reserved-host regression and invalid timezone cases fail correctly.
- Enrollment/CRM records from the old org are invisible after a second-org switch; unauthorized invite and forged org input fail closed.
- Setup draft survives resize/fold/back/foreground and correctly resumes after failed save.
- No new `Tenants` or separate District collection.

## Merge, rollback and review

New optional columns/profile flags may be disabled; existing identity remains untouched.

**Review roster:** Payload/Postgres migrations lead, Better Auth specialist, product onboarding designer, threat-model reviewer.

**Required source/skills:** Root AGENTS.md/CONTRIBUTING.md; mattpocock/skills: pr, codebase-design; expo/skills (when changing Expo UI); pbakaus/impeccable; petergyang/no-ai-slop; pinned mikevocalz-foldable-layouts for adaptive work. Read domain-specialist source/skills before implementation; versions and external design tools must be verified against the installed lockfile. Existing `@acme/ui`, semantic web elements, Solito/Expo routes and Zustand/refs take precedence over building replacements.

**Evidence at draft creation:** GitHub source/spec inspection and PR creation only. No typecheck, lint, test, build, browser, simulator, hardware or live external-provider validation was performed. Update this section with exact commands/results and device matrix when implementation lands. Do not merge a documentation contract as though it were a functional feature.
