# MB-01: Moyo Business product split — architecture decision

<!-- What: source-of-truth and implementation gates for splitting Moyo Learn and Moyo Business product experiences. -->
<!-- Why: Moyo Business must be independently sellable without a duplicate tenant, CRM, schedule, CMS or education database. -->
<!-- SOT: AGENTS.md; CONTRIBUTING.md; docs/pack/11-architectural-guardrails.md; packages/auth/src/host-tenant.ts. -->
<!-- SOT-KEYWORDS: moyo business product split architecture operations migration tenancy ownership -->

**Status:** Design/architecture contract. This change does not implement, deploy, or migrate a product. **Base inspected:** `main` at `a6afe6593060b73c8fc7b61d2ee0e0800204f1f3` (2026-10-15).

## Decision

Moyo Learn serves students, parents and educators. Moyo Business serves tutoring operators first, then learning centers, schools, districts, and later service businesses. Both products can be licensed independently; one authenticated organization can use both. Separate customer-facing branding and navigation, not backends. The first launch retains `apps/web/app/(business)`, the existing Solito/Expo screen host, Better Auth, Payload 4, Supabase Postgres and `packages/jobs`.

An independent `apps/business` deployment, a second CRM, an independent `Tenants` collection, a second scheduling engine and a new permissions framework are out of scope. A future public `business.moyolearn.com` must be reserved in slug/hostname policy before release; it cannot silently become an organization tenant.

## Source-of-truth ownership

| Concern | Existing owner | Never duplicate |
|---|---|---|
| Identity / memberships | `packages/auth`: Better Auth, active context, `host-tenant.ts` | user IDs, organization IDs, sessions |
| Organization | `packages/payload/src/collections/Organizations.ts` (`slug` is tenant key; `kind` currently tutoring, school, district) | separate Tenants or Districts |
| CRM | `Leads`, `Families`, `packages/app/features/ops`, `apps/web/lib/leads.repository.ts` | duplicated contacts/opportunities |
| Human appointment | Payload `Sessions`, `packages/app/features/schedule` | a new calendar; AI `TutorSessions` |
| Institutional roster | `Enrollments`, `features/institution` | a commercial tuition agreement |
| Subscriptions | `packages/auth/src/billing-plans.ts` + `entitlements.ts` | parallel Stripe price/entitlement state |
| Async integrations | `packages/jobs` | another queue or unsafe direct provider calls |
| Content/admin | Payload CMS and isolated `apps/admin-vite` | customer access to super-admin |
| UI | `packages/app/features/*`, `packages/ui`, `packages/theme`, Storybook | raw HTML feature screens or parallel component kit |

## Non-negotiable domain seams

1. `protectedOperation()` derives actor, tenant, role and entitlements server-side; client IDs never authorize themselves. Only server-side repositories touch Payload and every business lookup enforces tenant and relationship predicates.
2. `Sessions` means a scheduled human session. `TutorSessions` means an AI learning conversation. No automatic CRM joins to mastery, misconceptions, transcripts, learning summaries, accommodations, safety content or learner struggles.
3. Operational statistics come only from real committed business events. Current revenue fixtures must never be labeled real.
4. A saved campaign draft is not a sent campaign; an issued invoice is not collected cash; a calculated tutor payable is not an executed payout; a local booking preview is not a persisted session.
5. A finance operator may manage approved invoices without gaining a student-record role. A guardian may see only their authorized billing relationship, not an organization console.
6. Organization SaaS billing, a business's customer receipts and tutor payables have separate identity, state machines, policy and audit trails. Preserve existing `ops-*` Stripe references, a 30-day trial model and post-lapse read/export.
7. Marketing opt-in is purpose-specific and independent of being a guardian, CRM contact or paying customer. Learner progress and safety signals cannot trigger a commercial upsell.

## Editions and first customer

- **Tutoring:** inquiry → verified family → human appointment → attendance → agreement charge/credit → invoice → provider-confirmed payment → approved payable → report.
- **Learning center:** add groups, program resources, capacity, staff and enrollment/waitlists.
- **School/district:** add delegated schools, facilities, purchasing/approvals and lawful aggregate operations; no SIS replacement.
- **Service business (later):** activate customer/appointments/invoices/communications while omitting learner vocabulary and all Learn dependencies.

## Compatible migration sequence

1. Snapshot current routes, `Organizations` records, memberships, subscriptions and existing Payload migrations. Record deployed host mappings and finance feature flags before touching schema.
2. Add first-party Business identity to existing role shell and choose industry capabilities additively; keep `/ops`, `/leads`, `/families`, `/campaigns` deep links operational.
3. Extend existing CRM and `Sessions` only with verified pointers. Keep ambiguous historical sessions unlinked; never match people by names to charge them.
4. Build scheduling, attendance, policies, invoice/payment/credit/payable state machines in independently reviewable additive slices.
5. Shadow-read old/new business views in staging. Canary internal → 1–2 opted-in tutoring organizations → wider cohorts; compare tenant-specific counts and provider receipts.
6. Roll back UI/flags/routes independently. Retain immutable financial history and reverse money effects through explicit correcting ledger entries, never destructive down-migration.
7. Expand school/district permissions with separate procurement, DPA and legal review. A district relationship does not grant unbounded cross-school reads.

## PR implementation lanes

- MB-02 shell; MB-03 industry onboarding; MB-04 entitlements; MB-05 permission/privacy foundation.
- MB-06 CRM; MB-07 booking; MB-08 programs/resources; MB-09 agreement/attendance/credits; MB-10 invoicing/Stripe; MB-11 payouts.
- MB-12 communications; MB-13 native PhotoCraft; MB-14 calendar; MB-15 accounting/webhooks; MB-16 analytics; MB-17 institutions; MB-18 service-business/launch.

Individual MB PRs must remain draft until their **implementation**, test evidence and dependency gates are complete. A document-only planning PR is not a shipped feature.

## Existing work to extend

- [#92](https://github.com/mikevocalz/moyolearn/pull/92): Campaign editor + Mailcheap **draft only**.
- [#95](https://github.com/mikevocalz/moyolearn/pull/95): PhotoCraft **engine admission only**.
- [#96](https://github.com/mikevocalz/moyolearn/pull/96): schedule **documentation only**.
- [#97](https://github.com/mikevocalz/moyolearn/pull/97): CRM **documentation only**.
- [#98](https://github.com/mikevocalz/moyolearn/pull/98): business lifecycle **documentation only**.
- [#99](https://github.com/mikevocalz/moyolearn/pull/99): foldable design **open draft**; coordinate rather than replace.

## Implementation evidence required before merge

- Source audit verifies canonical locations, installed versions, existing migrations and latest branches.
- Security tests prove cross-tenant IDs, mismatched family/lead pointers, role revocation and learning-data wall fail closed.
- Integration tests prove committed booking under concurrent races, idempotent webhooks, corrections and reconciliation.
- Browser, mobile simulator and available physical device evidence labeled separately; foldable native physical-right rail and state continuity checked under RTL/posture.
- `pnpm typecheck`, relevant lint/build/tests, `node tooling/check-crm-wall.mjs`, `node tooling/check-store-separation.mjs`, `node tooling/check-versions-off.mjs` as applicable.
- No CI, device test, production Stripe execution, email send, schema migration or rollout is claimed by this ADR.

## Ownership and review

Architecture (principal/staff), Better Auth/security, Payload/Postgres, native/web UI and accessibility, fintech/reconciliation, release QA and independent reviewer. Load root `AGENTS.md`, `CONTRIBUTING.md`, relevant expo/skills, mattpocock/skills, marketingskills, impeccable, no-ai-slop, repo-pinned foldable skill and specialist skills **before modifying runtime**. Preserve existing Legend Motion; do not presume Kinetrell is installed. No merge, auto-merge, deployment or price changes without explicit approval.
