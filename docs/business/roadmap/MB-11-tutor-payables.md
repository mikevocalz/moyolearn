# MB-11: Tutor payables, approvals and payout execution

<!-- What: Tutor payables, approvals and payout execution implementation contract. -->
<!-- Why: reviewable end-to-end operations slice built on canonical Moyo services. -->
<!-- SOT-KEYWORDS: moyo business tutor payables roadmap test gates -->

**Status:** Planning/review draft only. Existing behavior unchanged; no migration, payment, provider write or runtime feature is implemented here.
**Implementation blocked by:** MB-09, MB-10. Architecture: [MB-01 PR #101](https://github.com/mikevocalz/moyolearn/pull/101).

## Source-of-truth files to inspect and extend

- `packages/app/features/ops` — inspect currently installed interfaces and tests before editing
- `packages/payload/src/collections/TutorEngagements.ts` — inspect currently installed interfaces and tests before editing
- `packages/auth/src/entitlements.ts` — inspect currently installed interfaces and tests before editing
- `packages/jobs` — inspect currently installed interfaces and tests before editing
- `apps/web/app/(business)` — inspect currently installed interfaces and tests before editing

## User-visible tracer bullet

1. Tutoring owner reviews session-earned tutor compensation, pending corrections and deductions according to an approved signed rate/policy.
2. Finance approver reviews a payable batch; separate authorized execution explicitly triggers supported provider disbursement and records a receipt.
3. Tutor sees own payable status without access to organization-wide payroll or private financial records.

## Domain and authorization contracts

- Payable amount is an accrued obligation, not cash sent or a payroll-tax filing; do not claim general employee payroll or W-2 handling.
- Payable calculation uses verified attendance and effective tutor rate policy; family payment and tutor earnings remain separate unless contract lawfully couples them.
- One actor cannot gain payout execution through mere scheduling/attendance permission. Require review/approval separation where configured.
- Existing `ops-studio`/`ops-scale` payout automation entitlement gates execution only, not human review of accrued payables.
- Provider payout commands have idempotent job IDs, reconciliation state, retries and explicit unknown/pending handling.
- Corrections and cancellations preserve audit and produce adjustment entries; never erase settled payments or recreate a payout blindly.

## Required implementation acceptance

- [ ] Double attendance replay creates one payable line; policy rate update does not reprice completed work.
- [ ] Approved vs unapproved batch transitions cannot both execute, stale approvals fail and an executor without permission is denied.
- [ ] Duplicate/disordered provider events reconcile exactly once; failed/unknown payouts show recoverable states.
- [ ] Cross-tenant tutor ID and revoked role fail closed; tutor can read only own payables.
- [ ] No Studio execution capability on Solo; canceled org writes denied per existing entitlement policy.
- [ ] No live payouts or payment instructions issued by documentation-only draft.

## Review, skills and rollback

**Owners:** Fintech/payroll domain architect, Stripe Connect payouts engineer, security/approvals expert, independent reconciliation QA.

**Required relevant skills:** Root AGENTS.md and CONTRIBUTING.md; mattpocock/skills PR and module design; expo/skills for native changes; coreyhaines31/marketingskills for product/financial UX; impeccable and no-ai-slop; pinned mikevocalz-foldable-layouts for adaptive screens. Re-evaluate current dependency catalog and migrations before implementation.

**Rollback:** Disable future execution; reconcile and correct historical payouts, never delete provider receipts.

**Evidence now:** GitHub repo inspection and documentation commit only. Runtime code, schema migrations, CI, real Postgres, browser, simulator, physical device, provider sandbox, and production validations were not run. Keep draft until complete behavior, test results and required security/financial reviews appear. Do not merge this document as a substitute for implementation.
