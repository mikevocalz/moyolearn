# MB-17: School and district operations editions

<!-- What: School and district operations editions implementation contract. -->
<!-- Why: ship scoped operations capability without duplicating Moyo Learn or its tenant data. -->
<!-- SOT-KEYWORDS: moyo business schools districts acceptance provider release -->

**Status:** Documentation and engineering scope only; not an implemented feature. **Implementation blockers:** MB-05, MB-08, MB-16. See [MB-01 architecture #101](https://github.com/mikevocalz/moyolearn/pull/101) and existing Moyo system contracts.

## Existing modules and first inspection targets

- `packages/app/features/institution`
- `packages/app/features/enrollment`
- `packages/payload/src/collections/Organizations.ts`
- `packages/payload/src/collections/Enrollments.ts`
- `apps/web/app/(school)`
- `apps/web/app/(district)`

## Complete user journey to implement

1. School administrator manages permitted programs, resources, staff availability, approvals and institutional enrollment-related operations.
2. District administrator sees authorized schools and aggregate operational reports with explicit delegated grants, while each school retains tenant authority.
3. Admin using Moyo Learn as well can navigate to a separately authorized educational report without copying learner records into Business.

## Ownership and implementation invariants

- Reuse existing `Organizations` school/district `kind` and school-to-district relationship; no parallel District collection or broadening all organization predicates.
- Institutional `Enrollments` remains a school roster, independent of commercial tuition agreement/CRM sales stage.
- Implement school/district permissions by explicit hierarchy grants and permitted reporting purpose; institutional role alone is not universal access.
- Program capacity, purchasing and approvals operate on business facts. No gradebook, transcripts, IEP/504 records or SIS replacement.
- Respect small-cohort suppression and limited-PII cross-school reports; preserve exact source and audit trail for any district aggregation.
- Support SSO/procurement/DPA/FERPA review and organization policies before real school pilot; no unreviewed FERPA compliance claims.
- School web, tablet and foldable screens use the existing UI and first-party role shells, adaptive RIGHT native rail, and no duplicate CMS admin.

## Acceptance criteria and release evidence

- [ ] School A admin cannot query school B data even in same district without explicit cross-school permission.
- [ ] District delegate can see allowed aggregate but not child detail, learning transcript or unapproved school financial records.
- [ ] Existing tutoring and family flows remain unchanged after organization enum/role enhancement.
- [ ] School room/program staffing and approval workflows enforce role and org boundaries.
- [ ] Report suppression and CSV/PDF exports enforce same row and cell policy.
- [ ] SSO, accessibility, DPIA/DPA review and real institutional pilot evidence recorded separately from CI.

## Review and release plan

**Independent reviewer roster:** School operations SME, public-sector privacy/legal reviewer, institution domain lead, security and adaptive UX QA.

**Skills:** Read root AGENTS.md/CONTRIBUTING.md and the actual installed target files before runtime changes. Load relevant expo/skills, mattpocock/skills (PR/module design), coreyhaines31/marketingskills, pbakaus/impeccable, petergyang/no-ai-slop and the pinned mikevocalz-foldable-layouts skill for adaptive work. Honor the current catalog and existing @acme/ui/motion/route adapters.

**Rollback:** Disable new school/district modules and retain prior institution routes/records. Preserve authorized audit/procurement history.

**Actual evidence for this planning PR:** reviewed GitHub source and existing specs; created branch/document/draft PR. No compile, lint, native build, database test, provider sandbox, real device, account connection or deployed changes were executed. Keep PR in draft until a complete tested implementation is added. Document unsupported devices separately. Do not auto-merge, rename subscriptions, send communication or execute transfers based on this contract.
