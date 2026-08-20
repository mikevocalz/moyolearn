# Public API Spec — studied from Noto, derived from the Registry
**Doc 13 · Moyo platform pack · Date:** Aug 20, 2026
**What this is:** the design of Moyo's public API (Operations Cloud surface), built by studying Noto's live API (their OpenAPI 3.1 spec + docs, fetched Aug 20) — **patterns learned, nothing copied** — and then exceeded using machinery the pack already owns. Skills applied: system-design (API contracts), documentation (API-docs discipline), plus doc 10/11's type and guardrail law.
**The thesis in one line:** *Noto documents their API by hand; Moyo derives its API from the registries — errors, scopes, spec, docs, and SDK are all build artifacts of decisions already made.*

---

## 1. What we studied — verified findings from Noto's live spec
Credit where due; these were read from `app.withnoto.com/api-docs/openapi.json` (27 paths, 26 schemas, OpenAPI 3.1):

**What they do well (adopted as patterns, re-expressed in our architecture):**
1. **Structured error envelope with a small stable code vocabulary** — `{ error: { code, message, details: [{field, description}] } }` with codes like `UNAUTHENTICATED / PERMISSION_DENIED / INVALID_ARGUMENT / NOT_FOUND / RESOURCE_EXHAUSTED / INTERNAL` (the Google-canonical set) and field-level validation details.
2. **Scoped, prefixed, revocable API keys** — `noto_sk_live_...` Bearer keys scoped per resource (`members:read`), dashboard-managed.
3. **True sandbox** — test-environment keys return realistic sample data without touching production.
4. **Cursor pagination** with a hard `page_size` cap (200).
5. **A plain conventions block** — ISO-8601 UTC, one casing rule, soft-delete via `archived_at`, nullable fields explicit.
6. **List/detail schema split** (`MemberListItem` vs `MemberDetail`) — deliberate payload sizing.
7. **Documented rate limit with backoff guidance** (100 req/min/key).

**Where their surface is shallow (verified, and where "more elite" lives):**
- **GET and POST only across all 27 paths** — no update, no archive/delete via API; integrations can create and read but never correct.
- **No webhooks** — integrators must poll.
- **No idempotency keys** — a retried POST can double-create.
- **No request/correlation IDs** in errors — debugging with support is guesswork.
- **Integer IDs** — enumerable; a privacy/enumeration surface.
- **No expand/include** — N+1 round-trips for related data.
- No `409 CONFLICT` / precondition semantics; no stated deprecation policy.

## 2. The Moyo API — adopted + exceeded, mapped to existing machinery
| Capability | Noto | Moyo | What makes it nearly free for us |
|---|---|---|---|
| Error envelope | hand-documented codes | **registry-derived** codes + `request_id` in every error | the Block's typed error mapping (doc 11 §3) + audit id; Sentry-linkable |
| Scopes | hand-declared strings | **scopes ARE registry permissions** | doc 11 §5 — per-endpoint "required scope" in docs is generated, can't drift |
| OpenAPI | hand-maintained JSON | **emitted from operation types** | doc 10: types are the source of truth; spec is a build artifact |
| SDK | none | **typed `@moyo/api`** with discriminated-union errors | doc 11 §2 type-only exports; same registry generates client error types |
| Mutations | create-only | full lifecycle: `PATCH` + archive, **`Idempotency-Key` required on all writes** | pg-boss + idempotent handlers already specced (doc 12 §6) |
| Webhooks | none | **signed events + typed catalog** (HMAC-SHA256, timestamp, 5-min replay window, versioned event names) | doc 12 job/event topology; catalog generated from the same registry |
| Sandbox | sample data | sandbox powered by **the persona/fixture system** | doc 09's Mock-Session fixtures become test-mode data — one investment, two products |
| IDs | integers | **prefixed opaque IDs** (`org_…`, `sess_…`, `inv_…`, `pay_…`) | non-enumerable is a *child-safety property* here, not just taste |
| Rate limits | prose | standard **`RateLimit-*` + `Retry-After` headers**, per-key + per-org | the Block's rate-limit gate already exists; headers are surfacing, not building |
| Versioning | `/v1` | `/v1` **plus date-pinned behavior per key** and a written 12-month deprecation policy | Stripe's model; version pin stored on the key record |
| Related data | none | `expand[]` on detail endpoints, allow-listed per resource | projection types (doc 10 §2.4) already define what may join |

## 3. Error model (the exemplar of "derived, not documented")
One registry in `packages/app/core/api-errors.ts` — `as const satisfies` — generates **four artifacts**: server throw helpers, the OpenAPI error schemas, the docs table, and the SDK's discriminated union.

```ts
export const apiErrors = {
  UNAUTHENTICATED:    { status: 401, retryable: false, doc: 'missing, invalid, or revoked API key' },
  PERMISSION_DENIED:  { status: 403, retryable: false, doc: 'key lacks the required scope' },
  INVALID_ARGUMENT:   { status: 400, retryable: false, doc: 'request failed validation; see details[]' },
  NOT_FOUND:          { status: 404, retryable: false, doc: 'no such resource within this key's reach' },
  CONFLICT:           { status: 409, retryable: false, doc: 'state precondition failed (e.g. already archived)' },
  IDEMPOTENCY_REPLAY: { status: 409, retryable: false, doc: 'same Idempotency-Key with a different body' },
  RESOURCE_EXHAUSTED: { status: 429, retryable: true,  doc: 'rate limit exceeded; honor Retry-After' },
  INTERNAL:           { status: 500, retryable: true,  doc: 'our fault; request_id is Sentry-linked' },
} as const satisfies Record<string, ApiErrorDef>
export type ApiErrorCode = keyof typeof apiErrors   // the SDK union — derived, never typed by hand
```
Envelope (theirs, extended — aligned with RFC 9457 spirit while keeping a code vocabulary):
```json
{ "error": {
    "code": "INVALID_ARGUMENT",
    "message": "page_size must be ≤ 100",
    "details": [{ "field": "page_size", "description": "must be ≤ 100" }],
    "request_id": "req_01J8…",
    "doc_url": "https://moyo.dev/errors#INVALID_ARGUMENT" } }
```
`request_id` appears on **every** response (header `X-Request-Id`) and joins the Block's audit log and Sentry trace — a support conversation starts from one string.

## 4. Conventions (binding)
Base `https://api.moyo…/v1` · Bearer keys `moyo_sk_live_…` / `moyo_sk_test_…`, org-scoped, scopes from the registry (e.g. `sessions:read`, `invoices:write`, `payouts:read`), instant revocation, last-used telemetry · **camelCase** fields (matches the generated Payload/TS types — the SDK and app share types, so the API speaks the codebase's casing) · ISO-8601 UTC · soft delete via `archivedAt` + `POST …/{id}/archive` · cursor pagination `{ data, nextCursor }`, `pageSize ≤ 100` · `expand[]` allow-listed per endpoint · every mutation requires `Idempotency-Key` (24h window; same key + different body → `IDEMPOTENCY_REPLAY`).

## 5. Surface v1 (Operations Cloud only — deliberate)
Resources: `members, staff, services, sessions, session-series (recurrence), availability, enrollments, invoices, payments, pay-runs, payouts, payout-accounts (Connect onboarding links), locations, rooms, semesters, labels, leads, forms, form-submissions, webhook-endpoints` — full CRUD-with-archive where the domain allows, list/detail schema split kept.
**The child-safety line, drawn in the spec itself:** the public API exposes **operations data only**. Learner *learning* data — transcripts, knowledge-graph, safety events, AI session content — has **no public endpoints in any version**. Doc 07's Loop-B no-read-path extends to the API gateway as a build check: a route that imports from the `edu` repositories fails CI. Where Noto's 404 means "not in your org," ours additionally means "not in your relationship scope" (doc 11 §4) — and enumeration is dead on arrival because IDs are opaque.

## 6. Webhooks (the integration story they lack)
`webhook-endpoints` resource (create/rotate secret/disable) · events like `session.created`, `session.updated`, `invoice.paid`, `payout.settled`, `member.archived` — names versioned, payloads are the same generated types as the REST detail schemas · delivery: HMAC-SHA256 signature header + timestamp, 5-minute tolerance, retries with exponential backoff for 24h via pg-boss, dead-letter visible in the dashboard · a `webhook.ping` test event from the dashboard and sandbox parity.

## 7. Docs & DX bar
Redoc-class reference generated from the emitted spec on every deploy (docs cannot go stale — skill principle 4 made mechanical) · every endpoint shows its **required scope** (from the registry) and a copy-paste `curl` + `@moyo/api` example · error table generated from §3 · a changelog page fed by spec diffs · sandbox keys available from day one so integrators build before they pay.

## 8. PRs
- **PR-28 · API core (Wave 4):** key issuance/scopes on the Better Auth org model, the public gateway route mounting `protectedOperation` with API-key ctx, error registry + envelope, rate-limit headers, idempotency store, opaque ID codec.
- **PR-29 · Spec + SDK pipeline (Wave 4):** operation-types → OpenAPI emitter, docs site generation, `@moyo/api` package build, sandbox fixture wiring.
- **PR-30 · Webhooks (Wave 4/5):** endpoints resource, signer, pg-boss delivery topology, dashboard dead-letter view.
Acceptance: `turbo typecheck` cold; a contract test that diffs the emitted spec against the previous release and fails on undocumented breaking change; the edu-import CI check; red-team item — an API key must never reach a learner-content read path.


---

## 10. Platform coverage map (v2 — tailored to every Moyo surface, not just Noto's shape)
One operation core, **two gateways**, and three tracks — so nobody ever builds a second parallel stack:

| Surface | Who calls it | Auth | Status |
|---|---|---|---|
| **First-party app API** — everything the Expo + Next apps do (all five role shells, learner AI turns, paywall, S26/S27) | our own clients only | Better Auth session → Block ctx | already specced: docs 11–12; typed fetch + SSE. **Not part of the public surface, same `protectedOperation` core** |
| **Public Operations API** (this doc §§3–8) | tutoring businesses & their integrators | org-scoped API keys | v1, Wave 4 |
| **Education-standards track** (§11) | schools & districts (Institution tier) | LTI/OIDC + rostering sync | Phase 4, spec'd now so the data model doesn't fight it later |
| Guardian **data portability** — full family export + verified erasure request | guardians, in-app | first-party session (never API keys) | ships with doc 07's erasure cascade; the export bundle is generated by the same projection types, so it can't over-share |
| Marketplace discovery/booking API · ops-side AI endpoints | future partners | — | **explicitly deferred**, listed so their absence is a decision, not an oversight |

Two rules this table encodes: **(1)** the first-party and public gateways construct different `ctx` but share every gate, error, and audit path — one Block, two doors; **(2)** anything touching a learner's *learning* (AI sessions, transcripts, knowledge graph) lives only behind the first-party door with relationship scope — no key, scope, or tier ever opens it (§5's CI check enforces this).

## 11. Education-standards track — the elite move a CRM never needs
Moyo sells to an education market Noto doesn't serve, and that market integrates through standards, not bespoke REST:
- **LTI 1.3 / LTI Advantage** (1EdTech): launch Moyo as a tool from an LMS with OIDC-based launch; Assignment & Grade Services can report mastery summaries back to the gradebook — *summaries only*, consistent with §5's line.
- **OneRoster** (1EdTech): consume district rosters (classes, enrollments, teachers) so Institution onboarding is a sync, not a CSV email chain.
- **Clever / ClassLink**: the two SSO + rostering brokers US districts actually deploy; supporting them is table stakes for the Institution tier's procurement conversations.
**Why LTI is a channel, not plumbing (strategy, binding):** (a) it structurally attacks the never-opens problem for the school segment — the assignment lives inside the LMS the student already opens daily; (b) the four LTI Advantage services map to product moments: OIDC launch = zero-friction rostered entry, **Deep Linking = the teacher embeds a specific Moyo skill/path as an assignment from inside their LMS**, AGS = mastery summaries into the teacher's existing gradebook, NRPS = per-course rosters; (c) LMS app galleries (Canvas ecosystem, Google Classroom add-ons) are district discovery surfaces — certification + listing is inbound lead generation for the Institution tier.
**The marketing wall (hard rule, same class as Loop B):** data acquired in a school context is walled from ALL marketing use — FERPA school-official basis, COPPA school consent, and state student-privacy laws (e.g. SOPIPA) prohibit using school-acquired student data to target students or families. Family-plan conversion from school exposure happens by brand familiarity only; no remarketing off school rosters, no school-data-derived audiences, enforced as a build check on any marketing read path.
Commitment level, stated honestly: **Phase 4 delivery, Phase 1 data-model compatibility** — org/class/enrollment/role shapes in Payload are checked now against OneRoster's entities so the sync is a mapping, not a migration. Exact spec versions get pinned by the implementing PR against 1EdTech's current certification suites, not from memory.
- **PR-31 · Standards track (Phase 4):** LTI 1.3 tool registration + launch, OneRoster consumer sync via pg-boss, Clever/ClassLink SSO through Better Auth's OIDC provider support, certification test harness.

## 12. Sources
Noto API reference + OpenAPI 3.1 spec (fetched Aug 20, 2026) — studied for patterns, no schemas or copy reproduced. Stripe API conventions (idempotency, prefixed IDs, date-pinned versions, expand) as prior art. RFC 9457 (Problem Details) spirit for the envelope. Pack docs 07/10/11/12 for the machinery this API is derived from.
