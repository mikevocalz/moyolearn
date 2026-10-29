# MB-10: Invoices, Stripe Connect and payment reconciliation

<!-- What: Invoices, Stripe Connect and payment reconciliation implementation contract. -->
<!-- Why: reviewable end-to-end operations slice built on canonical Moyo services. -->
<!-- SOT-KEYWORDS: moyo business invoices stripe roadmap test gates -->

**Status:** Planning/review draft only. Existing behavior unchanged; no migration, payment, provider write or runtime feature is implemented here.
**Implementation blocked by:** MB-04, MB-09. Architecture: [MB-01 PR #101](https://github.com/mikevocalz/moyolearn/pull/101).

## Source-of-truth files to inspect and extend

- `packages/auth/src/billing-plans.ts` — inspect currently installed interfaces and tests before editing
- `packages/payload/src` — inspect currently installed interfaces and tests before editing
- `packages/app/features/ops` — inspect currently installed interfaces and tests before editing
- `apps/web/app/api` — inspect currently installed interfaces and tests before editing
- `packages/jobs` — inspect currently installed interfaces and tests before editing

## User-visible tracer bullet

1. An organization finance operator reviews agreement-backed charges, issues a priced invoice and shares a family-scoped payment route.
2. Guardian pays the organization through the correctly scoped Stripe Connect account; Moyo receives verified provider events and reconciles allocations.
3. Operator investigates partial payments, failed attempts, refunds and stale provider outcomes without showing unconfirmed cash as collected.

## Domain and authorization contracts

- Moyo subscription Stripe Billing is independent from organization customer tuition invoices and Connect accounts; no reuse of SaaS reference as a payer invoice.
- Determine merchant-of-record, settlement method, currency, tax/fee/refund policy and Connect model explicitly before live enablement.
- Invoice draft/issue/partially-paid/paid/void/credit states have validated transitions; never mark paid on local optimistic action.
- Integer minor units, immutable line-item snapshots, currency, taxes and discounts; do not cast string prices or sum mixed currencies.
- Stripe webhook signature authentication, org-account reconciliation, stable provider IDs, idempotent inbox/outbox and per-event unique constraints.
- Unconfirmed/timeout payments must display pending reconciliation; do not automatically create duplicate charges on retry.
- Guardian read/write limited by verified payer relationship; finance staff cannot access student-learning records via invoice actions.

## Required implementation acceptance

- [ ] Stripe test-mode complete and partial payment, duplicate webhook, out-of-order event and refund/chargeback reconcile to correct invoice.
- [ ] Foreign-account payment intent/provider event cannot alter another org invoice.
- [ ] Atomic issuance and allocation races cannot double issue line items or over-allocate.
- [ ] Cancel/write-denied organization retains allowed records/exports but cannot issue new invoices.
- [ ] Network timeout after provider acceptance produces pending state, not a false failure/success.
- [ ] Receipt totals match provider-confirmed amounts and fee/tax rules; no live payment run in a planning PR.

## Review, skills and rollback

**Owners:** Stripe Connect architect, double-entry/ledger engineer, risk/compliance, mobile/web payment QA.

**Required relevant skills:** Root AGENTS.md and CONTRIBUTING.md; mattpocock/skills PR and module design; expo/skills for native changes; coreyhaines31/marketingskills for product/financial UX; impeccable and no-ai-slop; pinned mikevocalz-foldable-layouts for adaptive screens. Re-evaluate current dependency catalog and migrations before implementation.

**Rollback:** Disable new processing via tenant flag; preserve issued invoices and correct transactions with explicit reversals/refunds.

**Evidence now:** GitHub repo inspection and documentation commit only. Runtime code, schema migrations, CI, real Postgres, browser, simulator, physical device, provider sandbox, and production validations were not run. Keep draft until complete behavior, test results and required security/financial reviews appear. Do not merge this document as a substitute for implementation.
