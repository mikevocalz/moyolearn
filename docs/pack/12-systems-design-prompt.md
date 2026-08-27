# PROMPT — Moyo Systems Design
**Doc 12 · Moyo platform pack · Date:** Aug 20, 2026
**What this is:** the systems-design prompt of record — hand it to the build agent whole. The design decisions in §3–§8 are **binding** (they were made with the full pack behind them); the agent's job in §9 is to implement, detail, and stress-test them, not re-litigate. Structured on the system-design skill: requirements → high-level design → deep dives → scale & reliability → trade-offs.

---

## §1 · Role
You are operating at the level of the people who define this stack, not people who merely use it: a **TypeScript language architect**; a **Stripe-API-design-level payments/platform engineer**; a **Payload core maintainer**; the **Better Auth author's** depth on identity; **Postgres/Supabase core** depth on data; an **Expo/React Native core** and **Next.js core** engineer; an **LLM-inference-infrastructure lead** (routing, streaming, cost); and a **children's trust-&-safety architect** of the caliber that writes platform policy, not just implements it. "Senior" does not exist here. When any instruction conflicts with real constraints of these systems, stop and say so with the source — never fabricate an API shape.

## §2 · Requirements (the design's inputs — do not renegotiate)
**Functional:** five role shells over one identity system (docs 05/06); guardian-created child accounts; AI tutoring sessions with per-student memory (doc 07 §4 Loop A); human-tutoring ops (scheduling, invoicing, payroll → payouts, docs 03/05); subscriptions & trials (doc 05 §2); internal back office (doc 05 §4).
**Non-functional:** interactive API p95 < 300ms; AI first token < 1.5s then streamed; availability 99.9% product / 99.95% on auth + billing paths; RPO ≤ 15 min (PITR), RTO measured in hours not days; COPPA/FERPA/state-law posture per doc 07 — including **no child data in any training pipeline, architecturally**; cost ceiling driven by inference (see §7).
**Constraints:** the existing monorepo and catalog (single-version rule); **no tRPC, no new frameworks** — the Block + registry + generator architecture of doc 11; Waves per doc 09 (screens on mock session first); Payload 4 canary discipline (stable surfaces only); one Postgres as the center of gravity.

## §3 · High-level design (binding)
```
Expo app (iOS/Android)          Next.js web (SSR/RSC)          Payload Admin (internal only)
        │  HTTPS (typed fetch, SSE for AI)   │                            │
        └──────────────┬─────────────────────┘                            │
                       ▼                                                  ▼
             ┌──────────────────────────  Server core (one deployable)  ──────────────────────┐
             │  Route handlers / server actions                                               │
             │   └─► protectedOperation()  ← the Block (doc 11 §3): session → ctx →           │
             │        relationship scope → role → permission → plan → rate limit →            │
             │        validation → [Safety Plane branch] → handler → audit/usage              │
             │  Services ─► Repositories (ONLY code touching Payload/Drizzle)                 │
             │  Inference Gateway (server-only; sole egress to model providers)               │
             │  Webhook handlers (Stripe, providers) — idempotent, signature-verified        │
             │  Job runner: pg-boss on the same Postgres (see §6 trade-off)                   │
             └────────────┬─────────────────────────────┬────────────────────────────────────┘
                          ▼                             ▼
                Postgres (Supabase)               Third parties
                ├─ payload schema (operational)   ├─ Model providers (no-training contracts)
                ├─ better_auth schema (Better Auth)├─ Stripe (Billing + Connect; card data never local)
                ├─ edu schema (transcripts TTL,   ├─ Email/SMS provider (consent, alerts, reminders)
                │   knowledge graph, pgvector)    └─ Expo push
                └─ jobs schema (pg-boss)
                Object storage (Supabase Storage): media, consent evidence (private buckets)
```
**Trust zones:** client = untrusted; server core = the only place secrets and identity live; Payload admin = internal-only (doc 05 §4 access model); third parties reached only through the gateway/webhooks. The **three-store separation** (operational / educational / billing) is schema-level in one Postgres v1 — separation is enforced by the repository layer and the no-read-path build check (doc 07 §4 Loop B), not by running three databases we don't need yet.

## §4 · Data architecture (binding)
- **Payload collections** own operational data (orgs, memberships, guardianships, sessions, invoices, payRates/payRuns, consents, auditEvents, safetyEvents, subscriptions refs). Generated types are the source of truth (doc 10 §2.4).
- **Educational store** (`edu` schema): `transcripts` (session-scoped, TTL per published retention schedule), `knowledge_graph` (derived facts: mastery p + confidence, misconception tags, modality prefs — never raw text), `embeddings` (pgvector) for retrieval. Distillation job: transcript → derived facts → transcript expiry. Erasure cascades span all three (tested).
- **Tenancy & relationships:** every edu/operational row carries its owning edge (learnerId, orgId); queries are built from **ctx-resolved edges only** (doc 11 §4). Supabase RLS ships as deny-all backstop; the Block is the enforcement, RLS is the seatbelt.
- **Billing:** Stripe is the vault and ledger; local rows hold ids + status projections, reconciled by webhook. Never card data, ever.

## §5 · API & flow design (binding sequences; agent details the rest)
- **Contract style:** operation-per-capability route handlers (`POST /api/ops/<domain>.<action>`), input/output types exported from the domain, consumed type-only by the typed fetch client (doc 11 §2). SSE for AI streams. No GraphQL surface in v1 (Payload's REST/GraphQL stays internal-only behind admin auth).
- **Learner AI turn (the flow everything protects):** app → Block (learner ctx; grade band injected) → Safety L1–L4 (input class, topic fence) → retrieval (knowledge graph + curriculum via pgvector) → Inference Gateway → provider (pseudonymous payload; streaming) → L5 output screen **on the stream** (buffered sentence-window screening so blocking beats rendering) → client. Async after close: distillation job; safety events → `safetyEvents` + alert pipeline (S26). **Fail-closed rule: if any safety layer is unavailable, tutoring pauses** — "Natalie is taking a break" (never an error screen at a child), guardian-visible status. This is the one place availability is deliberately sacrificed for safety.
- **Checkout (family, M1):** paywall → Stripe Checkout (destination charge, ACH-first) → webhook → idempotent handler → subscription/invoice projection → registry entitlement cache invalidation → guards flip. The Better Auth Stripe plugin's wrapped success URL covers the redirect race (doc 06 §4).
- **Guardian-creates-child:** single server action: Better Auth username user + guardianship + consent record + restricted-account flags — one transaction, audit event, 7-day-unlinked cleanup job scheduled (doc 06 §3.1).
- **Pay run (M2):** approval → pg-boss batch job → SCT transfers per `transfer_group` → per-line status projection → tutor statements (doc 05 §5.3). Retries idempotent per transfer.

## §6 · Async, caching, realtime (binding choices, trade-offs stated)
- **Jobs: pg-boss on the same Postgres.** Trade-off taken deliberately: one less infrastructure, transactional enqueue with domain writes, honest fit for v1 volume (distillation, reminders, pay runs, cleanups, webhook retries). Revisit trigger: sustained > ~50 jobs/s or queue latency SLO breach → move hot queues to dedicated infra. Every job idempotent + dead-letter with alerting.
- **Caching:** registry + entitlements in-process with webhook-driven invalidation (they change rarely, must flip guards fast); TanStack Query on-device (keys from the generator's factories); Next data cache for public/marketing only. **No cache in front of child-scoped reads** — correctness and privacy beat 40ms.
- **Realtime:** v1 needs none beyond SSE (AI streams) and push (Expo) for alerts/reminders. Presence/live-collab (co-viewing a session) is Phase-3; decision recorded as deferred-ADR, not smuggled in.
- **Human session video:** external links v1 (the ops platform schedules; it does not host video). Deferred-ADR for embedded video (LiveKit-class) with real cost analysis before adoption.

## §7 · Scale, cost, reliability
- **Load model (design targets, not fantasies):** Phase 2: ~500 businesses · ~30k families · ~8k learner AI sessions/day · peak 3–7pm local. AI turn ≈ 2–6 provider calls (classifiers on a small fast model, tutoring on the frontier model). Web/API load is trivial next to inference — **the system is designed around token cost, not CPU.**
- **Cost controls (binding):** model routing (small model for L3/L5 classification and topic fencing; frontier model only for the tutoring turn); retrieval-trimmed context; per-learner daily inference budget with graceful "great work today" session-length UX (which is also the doc 07 break-nudge — cost control and child wellbeing point the same direction, use it); provider price/perf re-evaluated behind the gateway without app changes.
- **Failure modes → behavior:** provider outage → gateway fallback chain, else the fail-closed pause above; Stripe webhook lag → projections marked pending, UI states honest, plugin race-handling; Postgres failover → Supabase HA + PITR (RPO 15m); Payload canary regression → pinned versions + canary-bump dashboard (doc 03); classifier outage → fail closed; job backlog → dead-letter alert + shed non-critical queues first (reminders before pay runs, never safety alerts).
- **Observability:** the Block gives uniform telemetry for free — every operation logs `{op, resource, action, ctx.kind, latency, outcome}` structured; errors + traces to **Sentry** (already connected); audit and safety events are separate stores with separate retention; SLO dashboards on the four golden signals + AI first-token latency + safety-pipeline health. Alert on safety-pipeline degradation at page-severity.

## §8 · Explicit trade-offs (so nobody relitigates silently)
| Decision | Traded away | Why it's right for v1 | Revisit when |
|---|---|---|---|
| One Postgres, schema-level separation | physical isolation | ops simplicity, transactions across stores, honest scale | compliance audit demands physical, or edu-store QPS dominates |
| pg-boss over Redis/BullMQ/hosted queues | throughput headroom | zero extra infra, transactional enqueue | >50 jobs/s sustained or latency SLO breach |
| Typed fetch + type-only imports over tRPC | inference ergonomics | no dependency, same guarantees in-monorepo (doc 11 §2) | never, unless the API leaves the monorepo |
| SSE over WebSockets | bidirectional channel | AI streaming is one-way; simpler infra, native-friendly | live co-presence features (Phase 3) |
| Fail-closed Safety Plane | availability on the AI path | a paused tutor is a feature; an unscreened one is a lawsuit (doc 07 §1) | never |
| Stripe as ledger | ledger ownership | correctness + 1099s + disputes handled by the party best at it | marketplace volume justifies internal ledgering (unlikely) |

## §9 · Your job (the agent's deliverables)
1. **Sequence diagrams** for the five §5 flows, as Mermaid committed to `docs/design/` — exact operation names, gate order, failure branches.
2. **Schema DDL + Payload collection configs** for §4, with the erasure-cascade and no-read-path build checks as failing tests first.
3. **The Inference Gateway spec:** provider adapter interface, routing table, pseudonymization boundary, streaming + sentence-window screening implementation plan, budget enforcement.
4. **pg-boss topology:** queues, priorities, idempotency keys, dead-letter policy, the shed order from §7.
5. **SLO doc + alert rules** (Sentry + logs) matching §7, including the safety-pipeline page.
6. **Capacity worksheet:** token-cost model per learner-day at the §7 load, with the routing split shown.
7. Everything passes the standing gates: `turbo typecheck` cold, the doc-11 lint set, red-team suite green, no invented APIs (cite file+symbol for every seam you rely on).
Work the waves: nothing here blocks Wave 2 screens; §9.2–9.4 land with Wave 3+.

## §11 · Schema corrections — found in the live database (binding)
Two findings from reading the deployed `payload` schema. Both are recorded here because they contradict guarantees made elsewhere in the pack, and a guarantee that isn't enforced in the database isn't a guarantee.

### 11.1 Versions on `tutor_sessions` break the erasure cascade
**Observed:** `payload._tutor_sessions_v` held 11 version rows for a single session. Versions are enabled on the collection, and appending a message is a read-modify-write of the whole document, so **every conversational turn writes a full snapshot of the transcript.** The retention sweep targets `expires_at` on the main table and never touches `_v`.

**Why this is not a storage problem.** Docs 19 and 24 state that learner content inherits the TTL and the erasure cascade. If the transcript survives in `_tutor_sessions_v` after the parent row is swept, then *"delete my child's data" does not delete it*. Disk growth is the symptom; the broken guarantee is the defect. It is also the one a district's counsel will ask about.

**Fix, in order of correctness:**
1. **Versions off for this collection.** `versions: false`. Versions are an editorial feature — draft/publish, revert, who-changed-what. A tutor session is an append-only event log. Wrong tool for the shape of the data.
2. **Fix the shape, which is the root cause.** Messages as a nested array on the session document means every turn rewrites the entire transcript: O(n²) writes across a conversation, lock contention on the hot row, and version churn as a side effect. **Messages become their own collection** with a relationship to the session — one insert per turn, no rewrite, and retention becomes targetable per message rather than per conversation. This is also the shape doc 19's event stream and analytics rollups already assume.
3. **If versions must stay** on any collection holding learner content, cap them (`maxPerDoc` — verify the option name against installed Payload) **and extend the retention sweep to the `_v` tables**:
```sql
-- expired parents
DELETE FROM payload._tutor_sessions_v v
USING payload.tutor_sessions s
WHERE v.parent_id = s.id AND s.expires_at < now();

-- orphans: parent already erased, version survived
DELETE FROM payload._tutor_sessions_v v
WHERE NOT EXISTS (
  SELECT 1 FROM payload.tutor_sessions s WHERE s.id = v.parent_id
);
```
4. **Prove it with a test, don't assert it.** Create a session, append N messages, run the erasure job, then assert zero rows in the main table, in every `_v` table, and zero surviving Bunny objects (doc 29 §5). **That test *is* the erasure cascade** — without it there is intent and no evidence. It belongs with the §9.2 build checks, as a failing test first.

### 11.2 RLS disabled across the `payload` schema — decide it, don't inherit it
**Observed:** RLS off on all 32 tables in the `payload` schema, pre-existing rather than introduced by any recent migration; Supabase flags it critical. Payload enforces access in its own layer, so this is defensible — but it means **anything holding the Supabase anon key can reach children's learning data directly**, and the anon key is designed to ship in client bundles.

**Check exposure before designing anything.** Supabase's PostgREST only serves schemas listed under Settings → API → Exposed schemas (default `public`, `graphql_public`). If `payload` is not listed, the anon key cannot reach these tables through the API at all, and most of the risk evaporates. Verify first.

**Then fix it with privileges, not policies.** RLS is one mechanism; a missing grant is simpler and stricter. If `anon` has no privilege, RLS is moot for it:
```sql
REVOKE ALL ON ALL TABLES    IN SCHEMA payload FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA payload FROM anon, authenticated;
REVOKE ALL ON SCHEMA payload FROM anon, authenticated;

-- without this, the next migration silently re-grants on every new table
ALTER DEFAULT PRIVILEGES IN SCHEMA payload
  REVOKE ALL ON TABLES FROM anon, authenticated;
```
Verify — expect zero rows:
```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'payload' AND grantee IN ('anon','authenticated');
```

**Then belt-and-braces on the learner tables:** enable RLS with **no policies at all** — default-deny. Safe precisely because Payload connects as the table owner (or a `BYPASSRLS` role) and is unaffected, while anything else gets nothing. **Confirm which role `DATABASE_URI` uses before running this**, and do **not** add `FORCE ROW LEVEL SECURITY`, which would apply to the owner too and break the app.

This also converts Supabase's critical advisory from "ignored" into a documented, deliberate posture — which is the answer a district's security review is actually asking for.

### 11.3 Standing practice: reads and DDL take different paths
Schema state was read with the `pg` driver because `execute_sql` returned content references that couldn't be opened; the DDL went through the MCP's `apply_migration`. **Keep this split.** Migrations belong in the migration history where they can be reviewed, replayed, and rolled back; ad-hoc reads should never enter it. This is the pattern, not a workaround.

## §10 · Sources & spine
This prompt binds decisions from docs 01 (ADRs 001–006), 03 (repo law), 05 (money movement), 06 (auth wiring), 07 (Safety Plane, two-loop personalization), 09 (waves), 10 (types), 11 (Block/registry/enforcement). Where this doc and an earlier doc disagree, **this doc wins** — it was written last, with all of them on the table.
