# Moyo Business — AI Operators & Meta Muse Connector (MB-19–MB-24)

**Decision date:** 2026-10-16  
**Status:** Planned/documentation only — no runtime integration, authentication, provider approval, or live writes are included in this change.  
**Owner:** Moyo Business, within the existing Moyo Learn monorepo  
**Relationship:** Extension of the October 15 Moyo Business product/engineering blueprint and draft MB-01–MB-18 roadmap. This is not a replacement for those slices.

## Product decision

Moyo Business must offer its own native, first-party **Business Assistant** for authorized owners/operators, with an **optional** Meta Muse connection for users who already use Muse. Both surfaces use the same Moyo-hosted typed domain operations. Muse is a distribution and delegation surface, **never** an independent CRM, scheduling engine, financial ledger, school dashboard, or source of truth. Moyo Business must remain useful without Muse. Do not represent this roadmap as a Meta partnership or approved connector.

**Non-negotiable boundaries:** retain existing `Organizations` / Better Auth membership, `protectedOperation`, Payload 4, Supabase/Postgres, `packages/app/features/ops`, `features/schedule`, immutable/verified financial flows, `@acme/ui`/existing adaptive screens and the product split from Moyo Learn. No second database, no duplicate CMS, no direct agent SQL/Payload mutation, no cross-tenant shortcuts, no learning-model data in CRM/marketing or third-party assistant tools. Retain Solo/Studio/Scale and location-based entitlements; AI inclusion, metering and provider costs require a separate, measured decision.

## Initial user journeys

1. **Read-only owner brief:** "Compare real booked/attended hours, open tutor slots and unpaid-invoice status this week." Return reconciled, actor/location-filtered figures, timestamps, source/coverage and `unknown` when records are missing, not fixture-filled charts.
2. **Staffing proposal:** "Find a tutor for the Bronx center on Tuesday." Return verified availability only; later generate a proposed change with conflicts/time zone/capacity and ask the authorized owner to approve. Recheck schedule integrity at commit time.
3. **Multi-site operations:** "Which of my locations is underutilized?" Aggregate only authorized sites, apply small-cell suppression; propose staffing or promotion experiments based on verified business data, never learner diagnoses or student scores.
4. **Communication draft:** "Draft overdue invoice reminders and a fall enrollment campaign." Prepare for review, including consent/suppression and recipient provenance; no email or advertising spend without explicit approval and authorized delivery.
5. **Later public acquisition:** "Find a qualified math tutor and book an available session." Only add public search/booking tools after a complete guardian-safe funnel supports real availability, prices/policies, confirmation and supported cancellation/status; no exposed child records.

## Agent architecture

```text
Native Moyo Business Assistant          Optional Meta Muse
           |                                 |
           +---------- scoped tool adapter --+
                             |
     authenticated actor, membership, org + location entitlements
                             |
    read | prepare_write | approve+commit (server revalidation)
                             |
    existing ops / scheduling / CRM / reports / financial services
                             |
         Payload + Postgres + audited payment providers
```

### Tool / permission contract

- Publish **versioned, task-specific, typed** read and proposal tools; share the internal domain services across first-party and Muse entry points. The model must not pick org/actor/learner identifiers as trusted parameters. Bind the actor, organization, delegated locations and capabilities **on the server per call**, and restrict results accordingly.
- Initial grants **read only**. A business owner actively connects/disconnects Muse in the existing Business Integrations Hub; implement OAuth/token lifecycle/consent screen and rotation/revocation as applicable to Meta's reviewed connector interface. Every access checks member status, plan, location grant and purpose; privilege revocation takes effect before the next tool use.
- Only transmit minimized business data: authorized free/busy/availability, staff names where essential and allowed, aggregated revenue/status and operations counts. **Never** expose identifiable minors, Moyo Learn assessments, mastery, misconceptions, homework, accommodations, transcripts, protected school records or marketing segmentation based on child learning data. Education/privacy counsel reviews exceptional school workflows separately.
- Separate read vs prepare vs sensitive writes. `prepare_write` emits a reviewable action diff with affected org/location, recipients, money/fees, times/time zone and expiry. Server-issued one-use authorization + idempotency key must be bound to approved parameters. Verify the actor and version/conflict constraints **again** at commit. Muse approval alone does not replace Moyo-side authorization.
- Payment/refund/payout, invoice issuance, external sends, publishing/ads and permission changes are sensitive, audited and explicitly approved. No unsupervised financial transaction, guardian/student-affecting change or hidden side effect under a read tool.
- Return an operation receipt or explicit pending/failure; verify provider acknowledgment and support safe retries, progress/status, revocation and compensation where applicable. Never report draft as sent, proposed booking as booked or invoice balance as received cash.
- Assume untrusted retrieved text and external tool output, including CRM notes, emails, campaign copy and documents. Security review must include prompt injection and indirect exfiltration attempts.

### Integration & UI boundaries

- Native assistant uses a contextual, dismissible Business Inspector where it suits the task and a contained alternative on narrow panes. Reuse the actual existing SplitView, routing, Zustand/refs and semantic component patterns; do not invent a new dashboard or introduce an animation dependency.
- Follow the pinned `mikevocalz-foldable-layouts` skill referenced in `AGENTS.md`: native foldable/tablet **physical-right rail** even in RTL, web header instead of rail, hinge-safe content, preserved form/draft context, VoiceOver/TalkBack and real-device evidence.
- Define clear states: unavailable/not connected, read-only connected, permission denied, data stale/incomplete, proposal ready, waiting for approval, committed with receipt, revoked, retryable error.
- Muse's published connector process requires submission, security/legal and end-to-end review. List no more tasks than we can finish; a read-only business summary is complete when its answer is delivered. Booking requires a genuinely complete, compliant booking journey before submission. Directory acceptance/featuring is **not guaranteed**.

## Scoped implementation slices (proposed PR labels, not GitHub PR numbers)

| Slice | Ownership & dependencies | Acceptance bar |
|---|---|---|
| **MB-19 — Native Business Assistant: read/draft** | Existing shell, ops, schedule and verified reports; after MB-05/06/07/16 | owner/finance/staff/location authorization; real data provenance/freshness; no state-changing tools; responsive/accessible Inspector |
| **MB-20 — Agent tool gateway and approvals** | Reuse server business operations; after MB-05/07/10/12/19 | typed read/prepare/commit registry; tenant and location grant enforcement; one-use approvals; audit, replay/revoke/adversarial tests |
| **MB-21 — Optional Meta Muse read-only pilot** | Integrations Hub; after MB-14/16/20 | OAuth/read-only option, safe summaries, revoke/expiry/reconnect, sandbox fixtures, threat model and provider-review pack; don't imply Meta approval |
| **MB-22 — Approved scheduling/comms/invoice actions** | After MB-07/10/12/20/21 | action preview, Moyo owner consent, time/version/conflict recheck, idempotent confirmed receipts; no implicit email/charge |
| **MB-23 — Multi-location intelligence + marketing drafts** | After MB-16/18/19/22 | permissioned location comparisons, small-cell suppression, grounded recommendations, campaign draft only until send approvals are verified |
| **MB-24 — Public tutor discovery + booking** | After MB-07/08/10/20/21; independent product/legal gate | public safe catalog, verified free slots, terms/price, guardian/payer flow, actual booking, statuses/changes/cancel and financial receipt |

### Delivery and launch gates

- **Gate M1 / native preview:** real durable operations and reporting first; opt-in read/draft-only assistant, no student data access.
- **Gate M2 / Muse developer sandbox:** shared tool auth + revocation, explicit read-only scopes and data-processing review. Submit to Meta after end-to-end proof; do not claim available in directory without approval.
- **Gate M3 / controlled action pilot:** explicit independent approval/revalidation/receipts on every sensitive operation, negative/security race tests and financial reconciliation. No autonomous payouts, ad spend or sends.
- **Gate M4 / expansion:** opt-in multi-location business analytics, then distinct guardian-safe public booking. Do not couple core tutoring GA to provider approval.

## Required engineering and independent review

**Accountable disciplines:** principal domain/agent architect, OAuth/MCP security engineer, education privacy and FERPA/COPPA reviewer, staff scheduling/financial systems engineers, accessibility/adaptive UX owner, QA/SRE reviewer. These are required **roles**, not people claimed to be assigned.

**Subagent work packets for implementation PRs:**

- Repo cartographer — list canonical files, handler boundaries, existing org/location predicates, real report sources and misleading demo data.
- Identity/security red team — token impersonation, revoked grants, forged org IDs, role demotion, prompt injection, cross-tenant leakage and action replay matrix.
- Scheduling/finance correctness reviewer — proposed vs committed state, overlapping bookings, retries, invoice issuance/payment reconciliation, conflict timestamps.
- Adaptive product designer — Mobbin-backed native assistant/Integrations Hub/proposal-approval screen contracts, responsive/foldable a11y and copy; **research not yet executed by this docs-only PR**.
- Independent QA and documentation reviewer — no unverified provider support claims, exact acceptance/test status, rollout and rollback, anti-slop pass.

**Skills:** load the root `AGENTS.md`, current `CONTRIBUTING.md`, pinned `mikevocalz-foldable-layouts` skill on adaptive UI work, and the relevant repo-required Expo, TypeScript, device, product-marketing, Impeccable and no-AI-slop skills before implementation/review. Evidence in each future PR must say which skills/subagents **actually ran**, not just list them.

**Minimum negative tests:** two separate organizations + overlapping location memberships; malicious assistant tool outputs; scope/grant expiry and disconnect; no child learning data; stale authorization before commit; duplicate webhook, request and provider action; DST/timezone/availability race; campaign suppression; invoice unpaid vs paid; network interruption; keyboard/VoiceOver/TalkBack; web/mobile/tablet/foldable physical-right-rail/RTL. Report `passed`, `failed`, `unverified` distinctly. No test claims in this planning PR.

## Existing Moyo dependencies

- [MB-01 architecture draft #101](https://github.com/mikevocalz/moyolearn/pull/101), [MB-05 privacy draft #105](https://github.com/mikevocalz/moyolearn/pull/105), [MB-07 schedule draft #108](https://github.com/mikevocalz/moyolearn/pull/108).
- [MB-10 billing draft #111](https://github.com/mikevocalz/moyolearn/pull/111), [MB-12 communications draft #114](https://github.com/mikevocalz/moyolearn/pull/114), [MB-14 calendar draft #116](https://github.com/mikevocalz/moyolearn/pull/116), [MB-16 reporting draft #118](https://github.com/mikevocalz/moyolearn/pull/118), [MB-18 launch draft #120](https://github.com/mikevocalz/moyolearn/pull/120).
- [Repo operating instructions](https://github.com/mikevocalz/moyolearn/blob/main/AGENTS.md); [existing Payload CRM boundary](https://github.com/mikevocalz/moyolearn/blob/main/docs/business/noto-payload-crm-integration.md).

## Provider references and explicit uncertainty

- [Meta — Muse for Small Business](https://muse.ai/business)
- [Muse Connector Platform — submit and review](https://muse.ai/platform)
- [Muse connector guidelines — read/write/sensitive-write, OAuth and completion](https://platform.muse.ai/docs)
- [Muse Connector Terms (2026)](https://platform.muse.ai/terms)

Provider specs, prices, review requirements and feature availability may change. Confirm the live developer onboarding and legal terms before implementing or promising access.

**Documentation change only:** no OAuth client registration, API keys, Meta submission, user data sync, runtime tests, deployment or merger performed.
