# MB-06: CRM continuity, verified relationships and imports

<!-- What: CRM continuity, verified relationships and imports implementation contract. -->
<!-- Why: reviewable end-to-end operations slice built on canonical Moyo services. -->
<!-- SOT-KEYWORDS: moyo business crm import roadmap test gates -->

**Status:** Planning/review draft only. Existing behavior unchanged; no migration, payment, provider write or runtime feature is implemented here.
**Implementation blocked by:** MB-05. Architecture: [MB-01 PR #101](https://github.com/mikevocalz/moyolearn/pull/101).

## Source-of-truth files to inspect and extend

- `packages/app/features/ops/ops.service.ts` — inspect currently installed interfaces and tests before editing
- `packages/app/features/ops/families-content.tsx` — inspect currently installed interfaces and tests before editing
- `packages/app/features/ops/leads-content.tsx` — inspect currently installed interfaces and tests before editing
- `apps/web/lib/leads.repository.ts` — inspect currently installed interfaces and tests before editing
- `packages/payload/src/collections/Families.ts` — inspect currently installed interfaces and tests before editing
- `packages/payload/src/collections/Leads.ts` — inspect currently installed interfaces and tests before editing

## User-visible tracer bullet

1. A tutoring office imports a dry-run CSV of inquiries/households, reviews validated mappings and duplicate candidates, then commits only authorized selected rows.
2. An operator creates a lead and books a trial from its existing canonical `familyId`; family detail then shows a durable, actor-stamped business-only activity timeline.
3. A household is renamed without breaking stamped lead association; ambiguous legacy name matches are escalated rather than silently merged.

## Domain and authorization contracts

- Keep existing Leads/Families and `ops` screens/services canonical. No second contact table, CRM backend, client-side Payload query or added student-model join.
- Import adapters for TutorBird/Teachworks/TutorCruncher must preview field mapping, tenant, validation, provenance, dedupe and reversible precommit result; any provider formats need fixture verification before promising coverage.
- New activity facts include stable org-scoped event ID, actor from context, type, timestamp, verified family/lead/session reference and retention policy. Do not imply that an attempted email was sent.
- Household contact is not legal guardianship; adult marketing and transactional communications need separate purposes/consent.
- Legacy unstamped lead/session relationships never authorize new bookings or invoices by matching display names.
- Read models distinguish unknown/failed/empty from zero, and business reports cannot import mastery, AI transcripts, accommodations or incident details.

## Required implementation acceptance

- [ ] Same-org matched lead/family succeeds; same-org lead-A/family-B mismatch, deleted family and foreign-tenant IDs fail.
- [ ] Dry run changes nothing; duplicate CSV upload/idempotent commit preserves exactly one canonical household/lead record.
- [ ] Concurrent edits use version preconditions; rename updates verified associations with no lost updates.
- [ ] Activity creation/retry deduplicates by committed business event and never writes a fake sent/paid fact.
- [ ] Tenant switches clear scoped cache; large import survives failure without partial silent commit.
- [ ] CRM wall and store-separation checks pass before merge.

## Review, skills and rollback

**Owners:** CRM/data migration principal, privacy reviewer, UX/import specialist, DB QA.

**Required relevant skills:** Root AGENTS.md and CONTRIBUTING.md; mattpocock/skills PR and module design; expo/skills for native changes; coreyhaines31/marketingskills for product/financial UX; impeccable and no-ai-slop; pinned mikevocalz-foldable-layouts for adaptive screens. Re-evaluate current dependency catalog and migrations before implementation.

**Rollback:** Reject or disable import before commit; audit/reverse incorrect committed business records via reviewed domain corrections, never arbitrary mass delete.

**Evidence now:** GitHub repo inspection and documentation commit only. Runtime code, schema migrations, CI, real Postgres, browser, simulator, physical device, provider sandbox, and production validations were not run. Keep draft until complete behavior, test results and required security/financial reviews appear. Do not merge this document as a substitute for implementation.
