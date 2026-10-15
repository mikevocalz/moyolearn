# MB-05: Business permissions, tenant isolation and learning-data wall

<!-- What: Business permissions, tenant isolation and learning-data wall, bounded against current Moyo Business source-of-truth modules. -->
<!-- Why: independent education-first operations without duplicating the learning platform. -->
<!-- SOT-KEYWORDS: moyo business permissions privacy implementation acceptance -->

**Status:** Implementation contract only; no production feature, migration, device test or third-party write in this change.
**Base reviewed:** `main@a6afe6593060b73c8fc7b61d2ee0e0800204f1f3`; **blockers for implementation:** MB-03.
**Related existing work:** MB-01 architecture (#101).

## Existing ownership and intended files

- `packages/app/core/protected-operation.ts` (inspect actual exports and tests before editing)
- `packages/app/features/institution/institution.policy.ts` (inspect actual exports and tests before editing)
- `packages/app/features/ops/ops.service.ts` (inspect actual exports and tests before editing)
- `packages/payload/src/tenancy` (inspect actual exports and tests before editing)
- `packages/auth/src/membership.ts` (inspect actual exports and tests before editing)
- `tooling/check-crm-wall.mjs` (inspect actual exports and tests before editing)

## User-visible vertical slice

- A staff scheduler books permitted human sessions without gaining powers to approve payments or read the child's AI work.
- A finance manager reconciles authorized payments inside their org without receiving tutor transcript/safety access.
- School/district operators see only specifically delegated organization/location/program views rather than cross-school unrestricted queries.

## Data, security and UX contracts

- Keep the existing `protectedOperation()` gate and server-only repository/payload pattern; never construct a client-selectable or LLM-selectable actor, org or learner identity.
- Author resource/action grants plus location/program scope and purpose-specific consent, with deny-by-default missing entries. Preserve institution permission matrix and existing membership roles.
- Business CRM, search, segments, analytics, exports, jobs and provider payloads must reject mastery, misconceptions, `TutorSessions`, transcripts, summaries, accommodations, incident contents and child safety records.
- Tutor compensation approvals and payout execution are distinct privileges; recording attendance cannot grant invoice issuance or staff pay approval.
- Transactional outbox/audit foundation reuses existing `packages/jobs` rather than creating new unscoped queue.
- Payload MCP stays authenticated and admin-host restricted; app users must never gain general Payload admin.

## Acceptance and failure-path evidence

- Forge tenant/actor/body fields; cross-tenant foreign keys, mismatched family/lead/session links and revoked memberships fail closed.
- Exercise owner, staff, tutor, finance, school admin, district admin, guardian and learner role/resource matrix, including no privilege inheritance.
- Static import guardrails and runtime fake CRM/marketing exports prove learning model/safety collections never enter business outputs.
- Scoped cursor, cache and error states do not disclose another org's record existence or counts.
- Pass `check-crm-wall`, `check-store-separation`, `check-versions-off` and new real-service authorization/integration tests before an implementation merge.

## Merge, rollback and review

Explicit feature flags for newly added grants; never broaden legacy default access or roll back by removing audit history.

**Review roster:** Security/privacy principal, Better Auth specialist, Payload tenant reviewer, test/red-team owner.

**Required source/skills:** Root AGENTS.md/CONTRIBUTING.md; mattpocock/skills: pr, codebase-design; expo/skills (when changing Expo UI); pbakaus/impeccable; petergyang/no-ai-slop; pinned mikevocalz-foldable-layouts for adaptive work. Read domain-specialist source/skills before implementation; versions and external design tools must be verified against the installed lockfile. Existing `@acme/ui`, semantic web elements, Solito/Expo routes and Zustand/refs take precedence over building replacements.

**Evidence at draft creation:** GitHub source/spec inspection and PR creation only. No typecheck, lint, test, build, browser, simulator, hardware or live external-provider validation was performed. Update this section with exact commands/results and device matrix when implementation lands. Do not merge a documentation contract as though it were a functional feature.
