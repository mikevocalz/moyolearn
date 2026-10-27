# MB-16: Verified business analytics, reports and exports

<!-- What: Verified business analytics, reports and exports implementation contract. -->
<!-- Why: ship scoped operations capability without duplicating Moyo Learn or its tenant data. -->
<!-- SOT-KEYWORDS: moyo business analytics reporting acceptance provider release -->

**Status:** Documentation and engineering scope only; not an implemented feature. **Implementation blockers:** MB-09, MB-10. See [MB-01 architecture #101](https://github.com/mikevocalz/moyolearn/pull/101) and existing Moyo system contracts.

## Existing modules and first inspection targets

- `packages/app/features/ops/ops-dashboard-content.tsx`
- `packages/app/features/ops/ops.data.ts`
- `packages/app/features/institution/reports.service.ts`
- `packages/app/features/institution/reports-screen.tsx`
- `packages/payload/src`
- `apps/web/app/(business)`

## Complete user journey to implement

1. Owner opens Overview and sees actual booked/delivered sessions, conversion stages and outstanding invoices with reporting windows and data freshness.
2. Finance team filters invoices, allocated collections, credits, refund adjustments and payables using appropriately distinct measures.
3. School/district ops admins see permitted organization program and staffing aggregates, with small cohorts suppressed and excluded fields never exposed.

## Ownership and implementation invariants

- Current business revenue series and some dashboards are fixtures; never use them in production paths as if observed cash.
- Define and document metrics: lead conversion != enrolled learning; booked != completed; invoice issued != payment collected; gross != net of refunds/fees; payable != payout.
- Each time-series point carries source, time zone, currency, aggregation window and explicit unavailable/partial state; no `?? 0` masking failed reads.
- Use server-side authoritative query/projection over existing collections/jobs with tenant, relationship, role, plan and privacy suppression gates.
- Preserve MIN_COHORT suppression behavior in current ops read models and exports; changes need explicit education privacy review.
- CSV/PDF exports and charts must not leak child learning/safety records or another tenant's metadata; audit large exports.
- Substantive assertions in a report require actual data lineage rather than generated prose or fixture-based 'AI insights'.

## Acceptance criteria and release evidence

- [ ] Known seeded ledger: invoice/partial-pay/refund totals exactly reconcile to period balances and currencies.
- [ ] Simulated failed downstream read shows 'Unavailable' and retry, never zero or a fabricated green card.
- [ ] Cross-org cursor, report filter, server cache, PDF/CSV and permitted aggregate tests stop leakage.
- [ ] Small cohorts suppressed in UI, API and exported files; no learning fields from a CRM report.
- [ ] Compare new projection with existing read-only legacy data during canary; record mismatches rather than rewriting records.
- [ ] Web/tablet/mobile charts and readable print/PDF/report output tested for accessibility.

## Review and release plan

**Independent reviewer roster:** Data modeling/analytics principal, financial controller/reconciliation expert, privacy statistician, visualization/a11y engineer.

**Skills:** Read root AGENTS.md/CONTRIBUTING.md and the actual installed target files before runtime changes. Load relevant expo/skills, mattpocock/skills (PR/module design), coreyhaines31/marketingskills, pbakaus/impeccable, petergyang/no-ai-slop and the pinned mikevocalz-foldable-layouts skill for adaptive work. Honor the current catalog and existing @acme/ui/motion/route adapters.

**Rollback:** Switch readers back to legacy labeled fixtures or hide unavailable real metrics; never display fixture as live or delete financial history.

**Actual evidence for this planning PR:** reviewed GitHub source and existing specs; created branch/document/draft PR. No compile, lint, native build, database test, provider sandbox, real device, account connection or deployed changes were executed. Keep PR in draft until a complete tested implementation is added. Document unsupported devices separately. Do not auto-merge, rename subscriptions, send communication or execute transfers based on this contract.
