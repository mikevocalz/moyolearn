# MB-04: Moyo Business subscriptions and entitlement presentation

<!-- What: Moyo Business subscriptions and entitlement presentation, bounded against current Moyo Business source-of-truth modules. -->
<!-- Why: independent education-first operations without duplicating the learning platform. -->
<!-- SOT-KEYWORDS: moyo business subscription entitlements implementation acceptance -->

**Status:** Implementation contract only; no production feature, migration, device test or third-party write in this change.
**Base reviewed:** `main@a6afe6593060b73c8fc7b61d2ee0e0800204f1f3`; **blockers for implementation:** MB-02, MB-03.
**Related existing work:** MB-01 architecture (#101).

## Existing ownership and intended files

- `packages/auth/src/billing-plans.ts` (inspect actual exports and tests before editing)
- `packages/auth/src/entitlements.ts` (inspect actual exports and tests before editing)
- `packages/auth/src/subscription-reader.ts` (inspect actual exports and tests before editing)
- `packages/app/features/paywall` (inspect actual exports and tests before editing)
- `packages/app/features/org-settings` (inspect actual exports and tests before editing)
- `apps/web/app/(business)/settings` (inspect actual exports and tests before editing)

## User-visible vertical slice

- Owner views Moyo Business Solo/Studio/Scale display names, trial ending date, available capabilities and the organization's actual subscription status.
- Owner or finance member changes the existing organization's plan through current Better Auth/Stripe billing flow; staff, guardian and learner cannot manage it.
- A lapsed operator retains permitted read/export, while writes are disabled; past-due grace follows the existing centralized entitlement rules.

## Data, security and UX contracts

- Keep stored plan identities `ops-solo`, `ops-studio`, `ops-scale`, `family`, `family-early-bird` and environment-provided Stripe price IDs; branding is a display-layer expansion.
- Preserve existing 30-day trial configuration; verify no-card business checkout behavior and live Stripe price mapping before enabling signup.
- Keep past-due writes, post-cancel read/export, and `canPractise: true` on learner surfaces intact.
- Studio's payout execution entitlement is a planned capability, not proof payables or provider payouts work. Do not market unimplemented features as active.
- Business SaaS bills belong to an org; customer tutoring invoices and staff compensation use separate ledgers/reference IDs.
- Design capability manifests so an industry screen can hide irrelevant modules without bypassing server-enforced feature permissions.

## Acceptance and failure-path evidence

- Existing subscription fixtures for all statuses and plans retain identical authorization and proration rules.
- Forged referenceId/role and nonbilling membership cannot change plan, while owner and finance can.
- Learner UI never displays Moyo Business pricing; revoked org entitlement denies write while allowing permitted read/export.
- Trial end reminder, cancellation and renewal copy match actual provider configuration, including annual/monthly choices if available.
- No live Price IDs, products or subscriptions are created in this PR.

## Merge, rollback and review

Display copy and feature-registration mapping can be disabled while legacy `ops-*` entitlements continue.

**Review roster:** Billing domain owner, identity/security reviewer, monetization UX specialist, Stripe test engineer.

**Required source/skills:** Root AGENTS.md/CONTRIBUTING.md; mattpocock/skills: pr, codebase-design; expo/skills (when changing Expo UI); pbakaus/impeccable; petergyang/no-ai-slop; pinned mikevocalz-foldable-layouts for adaptive work. Read domain-specialist source/skills before implementation; versions and external design tools must be verified against the installed lockfile. Existing `@acme/ui`, semantic web elements, Solito/Expo routes and Zustand/refs take precedence over building replacements.

**Evidence at draft creation:** GitHub source/spec inspection and PR creation only. No typecheck, lint, test, build, browser, simulator, hardware or live external-provider validation was performed. Update this section with exact commands/results and device matrix when implementation lands. Do not merge a documentation contract as though it were a functional feature.
