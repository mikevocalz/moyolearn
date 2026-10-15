# MB-18: Service-business profile and launch hardening

<!-- What: Service-business profile and launch hardening implementation contract. -->
<!-- Why: ship scoped operations capability without duplicating Moyo Learn or its tenant data. -->
<!-- SOT-KEYWORDS: moyo business service business launch acceptance provider release -->

**Status:** Documentation and engineering scope only; not an implemented feature. **Implementation blockers:** MB-02, MB-03, MB-16. See [MB-01 architecture #101](https://github.com/mikevocalz/moyolearn/pull/101) and existing Moyo system contracts.

## Existing modules and first inspection targets

- `packages/payload/src/collections/Organizations.ts`
- `packages/app/features/org`
- `packages/app/features/shell`
- `packages/app/features/ops`
- `apps/web-vite`
- `docs/deploy`
- `docs/runbooks`

## Complete user journey to implement

1. A noneducation studio/consultancy signs up for a service-business profile, creates real services and customers, schedules appointments, invoices and sends authorized adult communications without a student model.
2. A tutoring business already on Moyo retains familiar screen vocabulary and original saved records; products share identity with distinct Moyo Business positioning.
3. Operators and staff can import/switch workspaces, export permitted records, understand data retention and recover from a failed rollout.

## Ownership and implementation invariants

- Industry-specific terminology/capability configuration must not duplicate services, database tables, authentication or subscription catalog.
- No Learn-only content, learner nouns or child permission model in service-business bundle, API queries, campaigns, search, or exports.
- Public brand/marketing launch waits on trademark clearance, permitted hostnames/reserved org-slug tests, accessibility and verified pricing/provider entitlements.
- Pilot rollout uses capability flags and staged cohorts (internal sandbox, opted-in tutoring centers, selected school orgs, then SMB canary), with measurable rollback criteria.
- Real operational analytics, billing reconciliation, tenant isolation and agency consent requirements gate 'general availability'.
- Preserve existing ops and learning links, allow cancellation/export, and ensure no child paywall is introduced.
- Before moving to a standalone `apps/business` build, record deployment/bundle/team ownership evidence that justifies extraction.

## Acceptance criteria and release evidence

- [ ] An SMB customer journey runs without any `LearnerRef`, course, grade, school roster or AI tutoring dependencies.
- [ ] Existing education tenants keep routes, billing identities, CRM and schedule intact with no migrations by name guessing.
- [ ] Smoke tests cover two tenant profiles, stale cross-host callback, redirect, membership switching, and offline/read-only mode.
- [ ] Release canary/dashboard has reconciled metrics, monitoring, operations runbooks and a tested disable/rollback path.
- [ ] Native phone, foldable cover/book/tabletop RTL, tablet and web accessibility evidence captured; unsupported hardware listed honestly.
- [ ] No production deployment, DNS, provider send or schema expansion occurs merely by opening this draft.

## Review and release plan

**Independent reviewer roster:** Product/GT​​M lead, principal systems architect, native/web release and accessibility QA, security/fintech approval reviewers.

**Skills:** Read root AGENTS.md/CONTRIBUTING.md and the actual installed target files before runtime changes. Load relevant expo/skills, mattpocock/skills (PR/module design), coreyhaines31/marketingskills, pbakaus/impeccable, petergyang/no-ai-slop and the pinned mikevocalz-foldable-layouts skill for adaptive work. Honor the current catalog and existing @acme/ui/motion/route adapters.

**Rollback:** Reverse feature flags/marketing site routes; preserve business records and provide authorized export; do not erase history.

**Actual evidence for this planning PR:** reviewed GitHub source and existing specs; created branch/document/draft PR. No compile, lint, native build, database test, provider sandbox, real device, account connection or deployed changes were executed. Keep PR in draft until a complete tested implementation is added. Document unsupported devices separately. Do not auto-merge, rename subscriptions, send communication or execute transfers based on this contract.
