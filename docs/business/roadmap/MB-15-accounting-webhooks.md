# MB-15: QuickBooks and Zapier accounting/event adapters

<!-- What: QuickBooks and Zapier accounting/event adapters implementation contract. -->
<!-- Why: ship scoped operations capability without duplicating Moyo Learn or its tenant data. -->
<!-- SOT-KEYWORDS: moyo business accounting webhooks acceptance provider release -->

**Status:** Documentation and engineering scope only; not an implemented feature. **Implementation blockers:** MB-10, MB-12, MB-14. See [MB-01 architecture #101](https://github.com/mikevocalz/moyolearn/pull/101) and existing Moyo system contracts.

## Existing modules and first inspection targets

- `packages/jobs`
- `packages/app/features/ops`
- `packages/payload/src`
- `apps/web/app/api`
- `apps/web/app/(business)/settings`

## Complete user journey to implement

1. Finance owner authorizes a QuickBooks Online company and maps approved Moyo invoicing totals, payments and credits to accounting records.
2. Owner subscribes a Zapier client webhook to a restricted business event catalog and sees delivery/retry history in Integrations Hub.
3. Provider outages and duplicate callbacks do not change confirmed Moyo invoices, post duplicates or reveal another organization's data.

## Ownership and implementation invariants

- Keep QuickBooks authoritative for accounting ledger/reconciliation and Moyo authoritative for session-derived charges/customer invoices. Explicitly document direction per object.
- Export only provider-confirmed, auditable financial facts; map customer/account/invoice/credit identities deterministically; never sum mixed currencies.
- Server-only OAuth/connection secrets, validated signed incoming and signed outgoing webhooks; per-tenant keys and purpose-specific scopes.
- Existing `packages/jobs` outbox supports immutable versioned business events, stable IDs, retry policy/backoff, dead letter and operator resync.
- Webhook event payloads contain no child learning, safety, accommodation, incident or tutor transcript information.
- Honor disabled/revoked connections and historical export state; never auto-execute refund, payroll or marketing sends from Zapier.
- Deduplicate provider receipt and webhook replay; ambiguous cross-provider reference requires explicit reconciliation not guess.

## Acceptance criteria and release evidence

- [ ] Sandbox QBO invoice/credit/payment export produces one accounting record per Moyo source event after repeated retries.
- [ ] Duplicate/out-of-order Zapier deliver returns safe status; audit and signatures resist replay and spoofing.
- [ ] Wrong-tenant provider company or webhooks cannot cross post or enumerate financial records.
- [ ] Provider API rate limit, revoked OAuth, prolonged outage, cursor collision and mapping correction have operator recovery states.
- [ ] Webhook fixture scan asserts no learning/child-content fields and privacy-safe logging.
- [ ] No live financial connector onboarding or accounting writes from docs-only draft.

## Review and release plan

**Independent reviewer roster:** QuickBooks integration architect, event-driven systems engineer, Stripe/QBO reconciliation specialist, security/audit QA.

**Skills:** Read root AGENTS.md/CONTRIBUTING.md and the actual installed target files before runtime changes. Load relevant expo/skills, mattpocock/skills (PR/module design), coreyhaines31/marketingskills, pbakaus/impeccable, petergyang/no-ai-slop and the pinned mikevocalz-foldable-layouts skill for adaptive work. Honor the current catalog and existing @acme/ui/motion/route adapters.

**Rollback:** Disable individual adapters; retain immutable receipt/outbox history and reverse incorrect remote postings through documented provider process.

**Actual evidence for this planning PR:** reviewed GitHub source and existing specs; created branch/document/draft PR. No compile, lint, native build, database test, provider sandbox, real device, account connection or deployed changes were executed. Keep PR in draft until a complete tested implementation is added. Document unsupported devices separately. Do not auto-merge, rename subscriptions, send communication or execute transfers based on this contract.
