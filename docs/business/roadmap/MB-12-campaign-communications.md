# MB-12: Campaign persistence, consent and communications

<!-- What: Campaign persistence, consent and communications implementation contract. -->
<!-- Why: ship scoped operations capability without duplicating Moyo Learn or its tenant data. -->
<!-- SOT-KEYWORDS: moyo business campaign communications acceptance provider release -->

**Status:** Documentation and engineering scope only; not an implemented feature. **Implementation blockers:** MB-05, MB-06. See [MB-01 architecture #101](https://github.com/mikevocalz/moyolearn/pull/101) and #92 merged editor and Mailcheap draft handoff.

## Existing modules and first inspection targets

- `apps/web/app/(business)/campaigns`
- `apps/web/app/api/business/campaigns`
- `docs/business/creative-studio.md`
- `packages/app/features/ops`
- `packages/jobs`
- `packages/payload/src/payload.config.ts`

## Complete user journey to implement

1. Owner resumes the same editable campaign draft after logout or another authorized device, with conflict/revision handling instead of relying on JSON download.
2. Marketing operator selects an adult opt-in audience with verified channel consent, previews branded template plus unsubscribe footer and requests a permitted send.
3. Operator sees provider-confirmed send outcomes and bounce/complaint/unsubscribe suppressions; unknown results cannot be silently retried into duplicate messages.

## Ownership and implementation invariants

- Extend existing Campaign Studio and isolated Mailcheap integration; current draft creation does **not** imply persistent editor state or sending.
- Persist a tenant-owned versioned block document and immutable published-asset revision; control asset authorization and PII before exporting.
- Adult CRM record or guardianship alone is not marketing consent. Store purpose/channel/source/time and withdrawal, and enforce suppression **at send time**.
- Transactional receipts, school operational notices and marketing campaigns use separate permitted purposes/templates/senders; a failed marketing opt-in must not block transactional service notices.
- Never segment parents using learner mastery, misunderstandings, accommodations, tutoring summaries, incidents or minor safety data.
- Provider adapters must use scoped server-only credentials, idempotent jobs, verified sender domains, CAN-SPAM footer, consent gate and durable provider receipts.
- Mailcheap is not Moyo's tenant authorization layer; preserve per-org provider isolation until an independently reviewed multitenant backend exists.

## Acceptance criteria and release evidence

- [ ] Campaign autosave/recovery across sessions preserves block order, undo history contract, assets and proper revision conflict handling.
- [ ] No audience includes child emails, revoked consent, unsubscribed addresses, cross-tenant CRM contacts or Learn data.
- [ ] Preview remains script-free, sandboxed, alt-text/accessibility checked, and does not cause network sends.
- [ ] Provider sandbox verifies bounce, complaint, suppression, send timeout and exactly-once event recording.
- [ ] Consent test separates marketing and transactional emails; wrong org cannot read drafts or assets.
- [ ] The existing #92 draft-only workflow remains unchanged until new sending is reviewed and enabled.

## Review and release plan

**Independent reviewer roster:** Marketing deliverability expert, Payload persistence engineer, privacy/security reviewer, email UX + a11y QA.

**Skills:** Read root AGENTS.md/CONTRIBUTING.md and the actual installed target files before runtime changes. Load relevant expo/skills, mattpocock/skills (PR/module design), coreyhaines31/marketingskills, pbakaus/impeccable, petergyang/no-ai-slop and the pinned mikevocalz-foldable-layouts skill for adaptive work. Honor the current catalog and existing @acme/ui/motion/route adapters.

**Rollback:** Disable new sending immediately. Retain opt-out/suppression and send receipts; roll back composer features without discarding drafts.

**Actual evidence for this planning PR:** reviewed GitHub source and existing specs; created branch/document/draft PR. No compile, lint, native build, database test, provider sandbox, real device, account connection or deployed changes were executed. Keep PR in draft until a complete tested implementation is added. Document unsupported devices separately. Do not auto-merge, rename subscriptions, send communication or execute transfers based on this contract.
