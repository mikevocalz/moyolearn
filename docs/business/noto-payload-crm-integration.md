# Payload CRM integration contract

<!--
What: bounded contract for extending Moyo's existing operations CRM.
Why: preserve one household identity, existing Payload records and the learning-data wall while defining activity and schedule integration.
SOT: packages/payload/src/collections/Leads.ts; packages/payload/src/collections/Families.ts; docs/pack/28-crm-spec.md.
SOT-KEYWORDS: business payload crm family lead activity schedule tenant privacy contract
-->

Status: design contract only. No runtime CRM, Activity collection, permission change or migration is delivered here. Implementation and integration validation remain outstanding. The inventory below was checked against `5db18da79ed0e4cd8d66ec86917b4d52c6fd6354`.

## Existing system to preserve

- [Leads](../../packages/payload/src/collections/Leads.ts) stores the existing six-stage pipeline, business context, cents/currency, optional `familyId`, and learner display text / text pointer. [The stage rules](../../packages/app/features/ops/stage-change.ts) keep `At risk` scorer-owned. The longer aspirational pipeline in [Doc 28](../pack/28-crm-spec.md) is not the currently implemented enum; do not change statuses silently.
- [Families](../../packages/payload/src/collections/Families.ts) is the household record with business contacts and text-only learner refs. [Its repository](../../apps/web/lib/families.repository.ts) scopes reads/writes by org and upserts by the unique `(orgId, name)` key. [Lead creation](../../packages/app/features/ops/ops.service.ts) reuses that household and stamps the resulting family ID.
- [Household grouping](../../packages/app/features/ops/family-groups.ts) joins stamped leads by `familyId`; only legacy unstamped leads fall back to trimmed name. Preserve this compatibility while using IDs for new relationships. Names are not a safe new cross-system identity or an authorization credential.
- [The ops feature](../../packages/app/features/ops/index.ts), [API routes](../../apps/web/app/api/ops) and [leads repository](../../apps/web/lib/leads.repository.ts) already support pipeline/list/detail, stage changes and family contacts. Extend these services and public exports; do not create an alternative CRM store, client-side Payload access or a parallel navigation tree.
- [Sessions](../../packages/payload/src/collections/Sessions.ts) is the scheduled human-session object. It has no `familyId` or `leadId` field today. Its learner display text is not enough to claim a verified family-to-booking relationship.
- [Enrollments](../../packages/payload/src/collections/Enrollments.ts) is the institutional learner-to-organization roster, not a commercial tuition agreement. A lead reaching `Enrolled` must not silently create a roster record or charge a guardian.
- [Payload configuration](../../packages/payload/src/payload.config.ts) and [Better Auth](../../packages/auth/src/server.ts) remain the infrastructure of record. Preserve the Payload 4 baseline, existing PostgreSQL/Supabase setup, separation of auth schemas and isolated admin-vite deployment. The product app must not gain the super-admin surface or expose admin credentials as a CRM integration shortcut.

## Household and schedule handoff

1. Carry the canonical org-scoped family ID and, where needed, lead ID from the existing CRM record into the existing schedule flow. Display names are editable labels. Re-resolve every reference under the authenticated org before reading or writing; a route parameter is not proof of membership. When a lead is supplied, derive the family from its canonical `familyId`; if the caller also supplies a family ID, require an exact match. Two individually valid same-org IDs are not necessarily a valid pair. A legacy unstamped lead cannot authorize a booking by name fallback: require an explicit, verified household association before the write, or refuse the operation with a recovery path.
2. Add and document the missing session-to-business-record pointer fields, derived types and additive migration as part of the implementation. Follow existing text-pointer conventions and service-side referential checks, not a relationship into learner identity/content. Historical sessions without pointers stay explicitly unlinked until a reviewed reconciliation can establish a match; do not guess a household from a learner name.
3. Preserve existing household upsert behavior for lead creation. A rename must retain the family ID and reconcile the dependent labels/links. The current lead repository renders denormalized `lead.family` text, so the rename implementation must update stamped leads' display text with the household rename in one atomic operation, or change the read model to resolve the canonical family label. Before changing the old name, explicitly reconcile/stamp provably associated legacy leads under the same org so their name-only fallback cannot detach them. Ambiguous legacy associations block rename until reviewed; never guess or silently drop them. When distinct households share a display name, or an import proposes duplicates, require an explicit disambiguation/merge design before broadening the current unique-name model. Never auto-merge households across tenants.
4. Keep the trial as a scheduled human session linked to its existing lead/family context. A CRM stage is a business workflow state, not proof of attendance, consent, payment or a successful booking. Update dependent stages only after the corresponding authoritative operation commits and meets its policy.
5. On booking success, use the saved session ID to refresh the existing lead/family view and calendar. On failure, preserve the draft/context and leave the previous stage unchanged. Cancel, Back and an invalid/deleted reference must have a working destination and an explicit recovery state.

## Activity and relationship-context contract

Activity is a proposed extension, not an existing collection or a reason to turn Payload row-version tables back on.

- A persisted entry needs org scope, stable ID, actor from authenticated context, occurred/recorded timestamps, typed event kind, allowed family/lead/session text references, business-only content and the originating operation's deduplication key. Derive API types from the eventual generated schema; do not invent a second CRM type system.
- Start with notes and committed business events that the existing app can actually produce. Do not display a sent email, completed call, paid invoice or attendance outcome solely because a UI action was attempted. Failed/pending operations must remain visibly distinct from completed events.
- Store business facts only. Never copy tutoring transcripts, mastery/struggle, session summaries, safety incidents or hidden learner identifiers into notes, automated summaries, search indexes, exports or marketing segments. New activity services/repositories must join the structural CRM-wall checks in the same change.
- Editing a note must have an auditable correction policy. Retention, permitted readers, correction/deletion behavior and redaction must be documented before rollout; “append-only audit” does not authorize indefinite retention of children's data or unrestricted staff access.
- A saved GuardianContact is business contact data, not proof of guardianship or permission to message. Any future email/SMS action must separately verify the current authorized contact, purpose/channel consent and opt-out state, use the existing jobs/retry mechanism, and record an actual provider result. No automated outreach is implemented or authorized by this contract.

## Access and failure boundaries

- Every app server operation uses `protectedOperation()` → service → server-only repository. Actor and tenant come from context, never client input. Validate request data at the edge, then enforce org predicates on all reads, creates, updates and related-record lookups.
- Keep existing read/export versus write entitlements: a lapsed organization can still read its own CRM, while writes remain gated. Require org membership as well as capability. A generic authenticated Payload read is not evidence that an app request is tenant-safe; test the service/repository path and preserve admin isolation separately.
- Cross-tenant and nonexistent record lookups must disclose no other organization's data. Activity pagination/cursors and search must retain scope; query/cache keys and optimistic updates must not carry a previous org's contacts into a new session.
- Use a concurrency precondition for a whole-contact-list replacement and an idempotency key for retriable activity/create operations. Reject stale writes or clearly reconcile them; do not let a slow device silently overwrite a newer contact list.
- Preserve [attendance suppression](../../packages/app/features/ops/ops.data.ts), which currently uses `MIN_COHORT = 10`. Suppressed/missing data is not zero. Revenue fixtures and example leads remain clearly labeled and must never enter live records, financial reporting or activity history.

## Acceptance and delivery

Implementation acceptance must prove:

1. Create lead → existing family record → trial booking → refresh/second device retains one canonical family ID. Rename preserves both stamped and reconciled legacy leads, and their displayed family name updates consistently; ambiguous legacy associations block rename. Unlinked historical sessions remain explicitly unlinked. A same-org family-A/lead-B booking is rejected, and an unstamped lead cannot bypass the verified-association requirement.
2. Another org's lead/family/session IDs, absent membership, lapsed write access and forged actor/tenant fields fail closed. Legitimate own-org read/export succeeds. Admin and app show the same underlying business record without granting app users admin access.
3. Trial booking failure leaves the prior stage and draft intact; concurrent contact edits cannot lose data silently; retries create one activity/event. Pagination and org changes do not leak stale records.
4. No CRM path reads mastery, transcripts, summaries or incidents. Existing suppression remains in lists, detail views, exports and new activity projections. Consent-denied/withdrawn contacts receive no communication.
5. Loading, empty, forbidden, stale, failed and saved states are distinct; existing RoleShell, `@acme/ui` components and tokens remain consistent. Adaptive UI work loads the relevant React/Expo/design skills and the [pinned tailored foldable skill](https://github.com/mikevocalz/universal-spatial-starter/blob/256a97b132803fd2fb8049f7a120cef9cb641f41/.agents/skills/mikevocalz-foldable-layouts/SKILL.md), with keyboard, RTL, accessibility and interrupted-flow evidence. No raw HTML feature screens or invented metrics.

For this docs-only PR, the gate is source-link/contract review and an accurate check report. Readiness for design review does not mean runtime integration shipped. A subsequent implementation must pass cold-cache `pnpm typecheck`, relevant unit/integration/permission tests, applicable lint/build checks, and UI/device validation. Extend the existing ops tests and run `node tooling/check-crm-wall.mjs`, `node tooling/check-store-separation.mjs` and `node tooling/check-versions-off.mjs`; these structural checks do not replace runtime authorization tests. Live migrations, data merges and provider actions require their own rollout approval.
