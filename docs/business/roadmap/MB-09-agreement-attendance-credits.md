# MB-09: Commercial agreements, attendance and credit ledger

<!-- What: Commercial agreements, attendance and credit ledger implementation contract. -->
<!-- Why: reviewable end-to-end operations slice built on canonical Moyo services. -->
<!-- SOT-KEYWORDS: moyo business agreement attendance credits roadmap test gates -->

**Status:** Planning/review draft only. Existing behavior unchanged; no migration, payment, provider write or runtime feature is implemented here.
**Implementation blocked by:** MB-06, MB-07, MB-08. Architecture: [MB-01 PR #101](https://github.com/mikevocalz/moyolearn/pull/101).

## Source-of-truth files to inspect and extend

- `docs/business/noto-business-lifecycle.md` — inspect currently installed interfaces and tests before editing
- `packages/payload/src/collections/Sessions.ts` — inspect currently installed interfaces and tests before editing
- `packages/app/features/ops` — inspect currently installed interfaces and tests before editing
- `packages/app/features/institution` — inspect currently installed interfaces and tests before editing
- `packages/jobs` — inspect currently installed interfaces and tests before editing

## User-visible tracer bullet

1. Finance-allowed operator activates a commercial agreement with verified payer, service, currency, rates and cancellation/makeup policy version.
2. A tutor records the fact of human-session attendance; an authorized correction includes who, when and why.
3. The service applies the frozen policy to produce an earned charge or makeup credit. A credit can be consumed at most once, then reversed/reinstated through explicit ledger entries.

## Domain and authorization contracts

- Tuition/commercial agreements are not `Enrollments`, and CRM pipeline `Enrolled` is not proof of a charge.
- Use immutable policy snapshots and exact money minor units with currency exponent; policy/version must be recorded before attendance-driven charging.
- Attendance fact derives from real committed human `Sessions` and authorized observer, never tutor AI chats, child transcripts or lesson mastery.
- Original attendance and corrections are separately auditable; corrections generate compensating charges/credits rather than editing historical effects.
- Uniqueness and idempotency keys cover source attendance event, policy and charge/credit ledger operation; transactional outbox is atomic with intent.
- No automated marketing audience from missed sessions implying a child's disability, low achievement or struggle.
- Tutor compensation derives later from independent pay policy and can be calculated before invoice paid only as agreed.

## Required implementation acceptance

- [ ] Repeated attendance events produce one resulting charge; modified replay key payload fails.
- [ ] Concurrent same-credit spend succeeds once; void/correction returns credit by audited reversal.
- [ ] Apply historical contract version after rate/policy update; amounts and date ranges do not drift.
- [ ] Wrong-family agreement, revoked observer, cross-tenant service or child AI `TutorSessions` cannot create financial activity.
- [ ] Network failure and outbox replay preserve single event effect.
- [ ] Attendance UI handles incomplete/unknown/error and does not show Paid.

## Review, skills and rollback

**Owners:** Financial systems architect, tutor operations lead, security/audit reviewer, property-based test engineer.

**Required relevant skills:** Root AGENTS.md and CONTRIBUTING.md; mattpocock/skills PR and module design; expo/skills for native changes; coreyhaines31/marketingskills for product/financial UX; impeccable and no-ai-slop; pinned mikevocalz-foldable-layouts for adaptive screens. Re-evaluate current dependency catalog and migrations before implementation.

**Rollback:** Reverse financial effects by compensating entries; no destructive record deletion or policy rewrite.

**Evidence now:** GitHub repo inspection and documentation commit only. Runtime code, schema migrations, CI, real Postgres, browser, simulator, physical device, provider sandbox, and production validations were not run. Keep draft until complete behavior, test results and required security/financial reviews appear. Do not merge this document as a substitute for implementation.
