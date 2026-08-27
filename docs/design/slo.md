<!--
  SLO doc and alert rules (doc 12 §9.5), matching the §7 targets.
  Why it exists: doc 12 §7 fixes the numbers and names Sentry as the destination
  for errors and traces; §9.5 asks for the SLO document and the alert rules that
  make those numbers enforceable, with safety-pipeline degradation paging.
  What this doc had to correct: §7 says Sentry is "already connected". In THIS
  repository it is not — see §2. Rather than invent a config against an SDK that
  is absent, every rule below names the instrumentation point it needs (which
  does exist, and is cited), then states the rule in Sentry's own alert-rule
  shape so it can be created the day the SDK lands.
  SOT: docs/pack/12-systems-design-prompt.md §2 §6 §7 §9.5 · docs/pack/07-security-child-ai-safety-spec.md §3
  SOT-KEYWORDS: slo alert rules sentry golden signals first token latency safety pipeline page severity error budget shed order availability rpo rto
-->

# SLOs and alert rules

**Date:** Aug 27, 2026 · **Status:** design of record for §9.5
**Applies to:** the Next.js server core (`apps/web`), the Expo client
(`apps/mobile`), and the Postgres behind both.

---

## 1 · The objectives

Straight from doc 12 §2 and §7. These are not negotiable in this document; they
were fixed with the whole pack on the table.

| # | Objective | Target | Window | Class |
|---|---|---|---|---|
| SLO-1 | Interactive API latency | **p95 < 300 ms** | 28-day rolling | latency |
| SLO-2 | AI first token | **< 1.5 s**, then streamed | 28-day rolling | latency |
| SLO-3 | Product availability | **99.9 %** | 28-day rolling | availability |
| SLO-4 | Auth + billing availability | **99.95 %** | 28-day rolling | availability |
| SLO-5 | Durability | **RPO ≤ 15 min** via Supabase PITR | continuous | durability |
| SLO-6 | Recovery | **RTO in hours, not days** | per incident | durability |
| SLO-7 | Safety-pipeline health | **100 % of learner turns traverse the plane**; any degradation pages | continuous | **safety** |

### 1.1 · What SLO-2 actually measures

Doc 07 §3 layer 5 requires generated text to be screened **before** it renders.
`packages/safety/src/plane.ts` resolves that with the sentence window and says so
in its own comment: *"Time-to-first-token becomes time-to-first-SENTENCE, which
is the price of layer 5 and is worth it."*

So the measured quantity is **time to first screened sentence** — the interval
from the `POST /api/tutor/coach` request reaching the route to the first
`{kind:'chunk'}` SSE frame leaving it. Measuring vendor first-token would
measure a number no child ever experiences. The budget splits:

| Segment | Budget | Bounded by |
|---|---|---|
| Block + `loadGradeBand` + `loadPriorFacts` + `compileLearnerBrief` | 150 ms | `protectedOperation`, `apps/web/lib/student-model.repository.ts` |
| Layers 1–4 (`screenInput`) | 100 ms | regex today; **re-budget when layer 3 becomes a model call** |
| Vendor first token | 900 ms | `packages/app/features/tutor/tutor-model.ts` (`effort: 'low'`, cached system prefix) |
| Sentence close + layer 5 `screen()` | 350 ms | `takeSentences` + `firewall.ts:screen` |
| **Total** | **1 500 ms** | |

### 1.2 · Error budgets

| SLO | Budget per 28 days |
|---|---|
| 99.9 % product | 40 min 19 s |
| 99.95 % auth + billing | 20 min 10 s |

Budget policy: at **50 %** burn, feature work on the affected surface stops
until the burn rate is back under 1×. At **100 %**, only reliability work ships.
Safety-pipeline degradation (SLO-7) has **no error budget** — doc 12 §8 records
the trade as "never" revisitable.

### 1.3 · The one SLO deliberately sacrificed

Doc 12 §8: *"Fail-closed Safety Plane — traded away: availability on the AI
path."* A learner AI turn that pauses because a safety layer is unavailable is
**not** an SLO-3 violation. It is the system working. It must still page,
because a paused tutor is an outage of the product's core promise even when it
is the correct behaviour — but it pages as a **safety** alert, not an
availability one, and it never counts against the availability budget.

---

## 2 · Sentry, as it actually stands

Doc 12 §7 says *"errors + traces to **Sentry** (already connected)"*. Verified
against this tree on Aug 27, 2026, that is **not true of this repository**:

- **No SDK.** Zero `@sentry/*` entries across every `package.json` in the
  workspace (`apps/web`, `apps/mobile`, `apps/storybook`, all of `packages/`,
  `tooling/`, and the root).
- **No instrumentation.** No `apps/web/instrumentation.ts`, no
  `instrumentation-client.ts`, no `sentry.*.config.ts`, no
  `withSentryConfig` in any Next config.
- **No DSN.** `.env.example`, `.env`, and `apps/web/.env.example` contain zero
  lines matching `sentry`.
- **The only occurrences of the word "Sentry" in the tree** are two Mobbin
  reference URLs in header comments:
  `packages/ui/DashboardShell.tsx:16` and
  `packages/app/features/ops/screen.shared.tsx:11`.
- **The connected Sentry account** (reachable from this workstation) exposes one
  organization, `deviant`, whose only project is `react-native`. There is no
  `moyolearn` organization and no `moyolearn` project.
- **No alternative.** No OpenTelemetry packages, and no structured logging in
  the API routes — `apps/web/app/api/**/route.ts` catch blocks map an error to a
  status code and discard it. `console.error` appears nowhere in the route tree.

**Therefore:** nothing in §3–§6 below can fire today. Each rule names its
prerequisite instrumentation point, and §7 lists the wiring work in the order it
has to happen. This is stated rather than papered over because a rule written
against a config that does not exist is indistinguishable, on a dashboard, from
one that is working.

### 2.1 · The prerequisite that gates everything

Doc 12 §7 claims *"the Block gives uniform telemetry for free — every operation
logs `{op, resource, action, ctx.kind, latency, outcome}` structured."*

`packages/app/core/protected-operation.ts:protectedOperation` takes
`(auth, headers, operation)` and returns `operation(ctx)`. It has no `op`, no
`resource`, no `action`, and emits nothing. **Every latency, availability and
outcome rule in this document depends on that record existing.** Adding it is
`W-1` in §7 and is a change to one file.

Note the mock branch while instrumenting: with `NEXT_PUBLIC_AUTH_MODE=mock` and
`NODE_ENV=development`, `protectedOperation` returns a fixed ctx without calling
Better Auth. Any measurement taken in that mode measures nothing; the telemetry
record must carry the mode so those samples can be excluded.

---

## 3 · The four golden signals

Signals are listed with the Sentry surface that carries them and the exact
symbol that must emit them.

| Signal | Sentry surface | Emitted by | Status |
|---|---|---|---|
| **Latency** | transaction duration, `event.type:transaction` | Next.js server instrumentation (`apps/web/instrumentation.ts` `register()`), plus the Block record from §2.1 | needs W-1, W-2 |
| **Traffic** | transaction count per `transaction` tag | same | needs W-2 |
| **Errors** | issues + `failure_rate()` on transactions; `onRequestError` from `instrumentation.ts` | Next 16 `onRequestError` hook; explicit `captureException` in the route catch blocks that currently swallow (`apps/web/app/api/tutor/coach/route.ts`, `.../evaluate/route.ts`, `.../session/route.ts`, `.../progress/route.ts`, `.../learner/profile/route.ts`, `.../ops/leads/route.ts`) | needs W-2, W-3 |
| **Saturation** | Postgres connection + CPU (Supabase), plus job-queue depth | Supabase metrics; queue depth has no source — pg-boss is **NOT YET IMPLEMENTED** (see `docs/design/seq-pay-run.md`) | partial |

Plus the two doc 12 §7 names explicitly beyond the four:

| Signal | Sentry surface | Emitted by | Status |
|---|---|---|---|
| **AI first-token (first screened sentence)** | custom measurement `ai_first_sentence_ms` on the `POST /api/tutor/coach` transaction | must be set at the first `{kind:'chunk'}` yield in `apps/web/app/api/tutor/coach/route.ts`'s `ReadableStream.start` | **NOT YET IMPLEMENTED** |
| **Safety-pipeline health** | counted spans, tagged by plane outcome | `packages/app/features/tutor/coach.service.ts:coach` already has the exact branch points — `blocked`, `unavailable`, `replace`, `end` — and `PlaneResult.trace` from `packages/safety/src/plane.ts` already carries the layer that stopped a turn, then **discards it** | **NOT YET IMPLEMENTED** |

### 3.1 · Cardinality rules, non-negotiable

This is a children's product; telemetry is a data-egress path like any other.

- **Never** tag or attribute with `ctx.learnerId`, a username, a `problem`
  string, a `message`, a transcript turn, a `sentence` from
  `studentModelFacts`, or any SSE `chunk` text.
- Safety spans carry the plane **trace layer id** (`1-identity`, `3-input`,
  `2-firewall`, `5-output`, `6-crisis`, `7-memory`) and the `InputClass`, both
  of which are closed enumerations in `packages/safety/src/plane.ts`. Nothing
  free-form.
- `Sentry.init` must set `sendDefaultPii: false` and install a `beforeSend` that
  drops request bodies on `/api/tutor/*`, `/api/learner/*`, `/api/capture/*` and
  `/api/media/*`.
- The `beforeSend` scrubber is a **red-team-suite obligation**, not a nice to
  have: `packages/safety/src/red-team.ts` runs in `packages/safety/src/safety.test.ts`,
  and a prompt that reaches Sentry unscrubbed is a Safety-Plane skip path by
  another name (doc 07 §6 lists exactly that class).

---

## 4 · Alert rules

Rules are given in Sentry's alert-rule shape (`aggregate` / `dataset` / `query`
/ `timeWindow` / `triggers`) so they can be created through the UI or the alert
rules API without translation. `environment: production` on all of them.

Severity ladder: **PAGE** (wakes a human, 24/7) · **TICKET** (business hours) ·
**DIGEST** (weekly review).

### 4.1 · Safety pipeline — PAGE

Doc 12 §7: *"Alert on safety-pipeline degradation at page-severity."* These are
the only rules in this document that page on the first breach rather than on a
burn rate.

| id | Rule | Aggregate / query | Window | Trigger | Severity |
|---|---|---|---|---|---|
| **SAFE-1** | Plane unavailable | `count()` · `dataset: events` · `event.type:transaction transaction:"POST /api/tutor/coach" tags[coach.event]:unavailable` | 5 min | critical ≥ 3 | **PAGE** |
| **SAFE-2** | Classifier or firewall threw | `count()` · `dataset: events` · `event.type:error error.type:"SafetyLayerUnavailable"` | 5 min | critical ≥ 1 | **PAGE** |
| **SAFE-3** | Plane skipped | `count()` · `dataset: events` · `event.type:transaction transaction:"POST /api/tutor/coach" !has:tags[safety.trace_layers]` | 5 min | critical ≥ 1 | **PAGE** |
| **SAFE-4** | Crisis outcome fired | `count()` · `dataset: events` · `tags[safety.outcome]:crisis` | 1 min | critical ≥ 1 | **PAGE** — human review queue, doc 07 §3 layer 6 |
| **SAFE-5** | Block rate anomaly | `count()` · `tags[safety.outcome]:blocked` | 15 min | warning ≥ 3× the 7-day median, critical ≥ 10× | PAGE at critical |
| **SAFE-6** | Guardian crisis alert failed to send | `count()` · `event.type:error error.type:"SafetyAlertDeliveryFailed"` | 5 min | critical ≥ 1 | **PAGE** |
| **SAFE-7** | Red-team suite regression | Sentry Cron monitor `red-team-suite`, or the CI gate directly | per run | any failure | **PAGE** — doc 07 §3 layer 8, a regression blocks the ship |

**SAFE-3 is the most important rule in this document.** Every other rule notices
the plane behaving badly; SAFE-3 notices the plane not running. It is expressed
as the absence of a tag rather than the presence of one, because a code path
that bypasses the plane will not helpfully emit a "bypassed" marker.

Escalation: SAFE-1 through SAFE-4 and SAFE-6 go to the on-call rotation with no
auto-resolve. SAFE-4 additionally opens a review item — doc 07 §3 layer 6 is
explicit that *"the session does not resume into math as if nothing happened."*

`coach.service.ts` already distinguishes `blocked` (a plane decision, terminal,
locks the composer) from `unavailable` (infrastructure, retryable) and comments
on why conflating them is harmful. **Keep that distinction in the alerts**: a
missing `ANTHROPIC_API_KEY` on a dev deploy must not page the safety rotation.
That is why SAFE-1 has a threshold of 3 and AI-2 (below) exists separately.

### 4.2 · AI first token — SLO-2

| id | Rule | Aggregate / query | Window | Trigger | Severity |
|---|---|---|---|---|---|
| **AI-1** | First screened sentence slow | `p95(measurements.ai_first_sentence_ms)` · `dataset: transactions` · `transaction:"POST /api/tutor/coach"` | 10 min | warning > 1500, critical > 2500 | TICKET / PAGE |
| **AI-2** | Provider unavailable | `count()` · `tags[coach.event]:unavailable` | 10 min | warning ≥ 10 | TICKET |
| **AI-3** | Stream ends with no terminal frame | `count()` · `tags[coach.stream]:truncated` | 15 min | warning ≥ 5 | TICKET |
| **AI-4** | Answer withheld by the pedagogy guard | `count()` · `tags[coach.event]:replace tags[coach.reason]:reveal` | 1 h | DIGEST | DIGEST — a model-quality signal, not an incident |

AI-2 pages only via SAFE-1's tighter threshold; on its own it is a ticket,
because doc 12 §7's answer to a provider outage is the gateway fallback chain
(**NOT YET IMPLEMENTED** — see `docs/design/seq-learner-ai-turn.md`) and then the
fail-closed pause, which is already covered.

### 4.3 · Interactive API latency — SLO-1

| id | Rule | Aggregate / query | Window | Trigger | Severity |
|---|---|---|---|---|---|
| **LAT-1** | Interactive p95 | `p95(transaction.duration)` · `event.type:transaction !transaction:"POST /api/tutor/coach" !transaction:"POST /api/media/sweep"` | 10 min | warning > 300 ms, critical > 800 ms | TICKET / PAGE |
| **LAT-2** | Per-operation p95 | same, grouped by `transaction` | 1 h | any operation > 300 ms for 3 consecutive windows | TICKET |
| **LAT-3** | Payload query fan-out | `p95(span.duration)` · `span.op:db` | 1 h | warning > 150 ms | TICKET |

LAT-1 excludes the coach route because it is a long-lived SSE stream whose
duration is the length of a tutoring turn — including it would make the
interactive p95 meaningless. AI-1 is the coach route's latency SLI.

LAT-3 has a known first customer: `loadPriorFacts` in
`apps/web/lib/student-model.repository.ts` issues a `payload.find` on
`studentModelFacts` with `limit: 1000` on every coaching turn, and it sits inside
SLO-2's 150 ms context-assembly budget.

### 4.4 · Availability — SLO-3 and SLO-4

Burn-rate alerts, not raw thresholds, so a two-minute blip does not page.

| id | Rule | Aggregate / query | Window | Trigger | Severity |
|---|---|---|---|---|---|
| **AVL-1** | Product fast burn | `failure_rate()` · `event.type:transaction` | 1 h | critical > 14.4× budget burn | **PAGE** |
| **AVL-2** | Product slow burn | `failure_rate()` · `event.type:transaction` | 6 h | warning > 6× | TICKET |
| **AVL-3** | Auth + billing fast burn | `failure_rate()` · `transaction:"/api/auth/*"` | 1 h | critical > 14.4× against the 99.95 % budget | **PAGE** |
| **AVL-4** | Stripe webhook failures | `count()` · `transaction:"POST /api/auth/stripe/webhook" transaction.status:internal_error` | 15 min | critical ≥ 5 | **PAGE** |
| **AVL-5** | Uptime | Sentry Uptime monitor on `/api/auth/ok` and the marketing root | 1 min probe | 2 consecutive failures | **PAGE** |
| **AVL-6** | Mobile crash-free sessions | Release health, `apps/mobile` | per release | < 99.5 % | TICKET; < 99 % **PAGE** |

AVL-4 sits on the auth+billing budget because doc 12 §5 makes the webhook the
source of subscription truth. Note that a *lagging* webhook is not this alert:
the plugin's wrapped success URL settles state before the redirect
(`docs/design/seq-checkout-family.md`), so lag is a projection-freshness
question, not an availability one.

### 4.5 · Jobs, retention and durability

| id | Rule | Surface | Window | Trigger | Severity |
|---|---|---|---|---|---|
| **JOB-1** | Media retention sweep missed | Sentry Cron monitor `media-sweep`, schedule `0 3 * * *` (matches `apps/web/vercel.json`) | daily | missed or errored check-in | **PAGE** — an unkept deletion promise on children's media |
| **JOB-2** | Sweep ran but deleted nothing for 7 days | `count()` on the sweep's own result | 7 days | warning | TICKET — catches the silent-success failure the route's own comment warns about |
| **JOB-3** | Dead-letter depth | pg-boss — **NOT YET IMPLEMENTED** | 15 min | critical ≥ 1 on a safety queue, warning ≥ 10 elsewhere | PAGE / TICKET |
| **JOB-4** | Queue latency SLO breach | pg-boss — **NOT YET IMPLEMENTED** | 15 min | > 5 min for a normal-priority job | TICKET — also doc 12 §6's stated revisit trigger for moving off pg-boss |
| **DUR-1** | PITR lag | Supabase, outside Sentry | 5 min | > 15 min → RPO breach | **PAGE** |
| **DUR-2** | Restore drill | quarterly tabletop, doc 07 §6 | quarterly | not run | TICKET |

JOB-1 is implementable **today** — the cron exists at
`apps/web/app/api/media/sweep/cron/route.ts`, is scheduled in
`apps/web/vercel.json`, and already fails loudly (500) when
`MEDIA_SWEEP_SECRET` is unset rather than returning a false 200. A Sentry Cron
monitor plus two check-in calls in that handler is the whole change.

---

## 5 · Shed order under load

Doc 12 §7, binding, quoted so it cannot drift:

> job backlog → dead-letter alert + shed non-critical queues first (**reminders
> before pay runs, never safety alerts**).

| Order | Shed | Queue / path | Why it can wait |
|---|---|---|---|
| 1st | Reminders and digests | `notify.reminder.*` — trial reminders (`packages/auth/src/trial.ts:TRIAL_REMINDER_DAYS_BEFORE`), session reminders, weekly guardian digests | A late reminder is an annoyance |
| 2nd | Distillation and derived work | `edu.distill`, `payroll.statement.render` | The tutor is slightly less personalized; nobody is unsafe or unpaid |
| 3rd | Pay runs | `payroll.payRun.execute`, `payroll.transfer.send` | Money is late. Bad, and recoverable — the run is already approved and idempotent per `${payRunId}:${lineId}` |
| — | **Retention sweeps are not shed** | `retention.sweep` | It is a promise about a child's data with a stated window |
| **never** | **Safety alerts** | `safety.alert.*` — guardian crisis notification, human review queue | Doc 07 §3 layer 6. There is no load level at which a guardian is not told |

Shedding is a **decision, and it must be visible**: any shed emits
`ops.shed` with the queue name and the depth that triggered it, and raises a
TICKET on the first occurrence in a 24-hour period. A queue that is quietly
shedding nightly reads on every dashboard as a queue that is keeping up.

Serving-path shedding, if it ever becomes necessary, follows the same principle
inverted: the learner AI turn is the **last** interactive path to degrade, and it
degrades to the fail-closed pause rather than to an error — doc 12 §5, *"never
an error screen at a child."*

---

## 6 · Ownership and routing

| Rule family | Route to | Hours |
|---|---|---|
| SAFE-* | safety on-call | 24/7, no auto-resolve |
| AI-* | platform on-call | AI-1 critical 24/7; the rest business hours |
| LAT-*, AVL-* | platform on-call | AVL-1/3/4/5 24/7 |
| JOB-*, DUR-* | platform on-call | JOB-1 and DUR-1 24/7 |

Retention, per doc 12 §7 (*"audit and safety events are separate stores with
separate retention"*): Sentry issue retention is the vendor default and holds
**no** safety payloads. The safety record of truth is the `safetyEvents` store —
**NOT YET IMPLEMENTED** — with its own short retention per doc 07 §3 layer 7.
Sentry carries counts and enumerated tags so the pipeline can be *watched*; it is
never the place a safety event is *stored*.

---

## 7 · Wiring order

Nothing above fires until these land. Ordered by what unblocks the most.

| id | Work | Touches | Unblocks |
|---|---|---|---|
| **W-1** | Emit the Block record `{op, resource, action, ctx.kind, latency, outcome, authMode}` | `packages/app/core/protected-operation.ts` — needs an `op`/`resource` argument it does not currently take, so it is an API change to every call site | everything |
| **W-2** | Install `@sentry/nextjs` on `apps/web` (Next 16.3.1 → `instrumentation.ts` `register()` + `onRequestError`) and `@sentry/react-native` on `apps/mobile` (Expo 57.0.15); create a `moyolearn` Sentry project — the connected org `deviant` has only `react-native`, which belongs to a different product | `apps/web`, `apps/mobile`, catalog in `pnpm-workspace.yaml` | golden signals |
| **W-3** | `captureException` in the six API route catch blocks that currently discard the error | `apps/web/app/api/**/route.ts` | ERR signals |
| **W-4** | Set `measurements.ai_first_sentence_ms` at the first `chunk` frame | `apps/web/app/api/tutor/coach/route.ts` `ReadableStream.start` | AI-1, SLO-2 |
| **W-5** | Tag the coach transaction with `coach.event`, `safety.outcome`, and `safety.trace_layers` from the `PlaneResult.trace` that `coach()` currently drops | `packages/app/features/tutor/coach.service.ts` | SAFE-1, SAFE-3, SAFE-4, SAFE-5 |
| **W-6** | Distinguish a *thrown* safety layer from a *thrown* vendor call so SAFE-2 has an error type — today both land in one `catch` and become `unavailable` | `packages/app/features/tutor/coach.service.ts:coach` | SAFE-2, and the doc 12 §5 fail-closed rule itself |
| **W-7** | `beforeSend` scrubber + `sendDefaultPii: false`, with a red-team case asserting no prompt text escapes | `apps/web`, `apps/mobile`, `packages/safety/src/red-team.ts` | §3.1 — **must land with W-2, not after** |
| **W-8** | Sentry Cron monitor check-ins for the media sweep | `apps/web/app/api/media/sweep/cron/route.ts` | JOB-1, JOB-2 |
| **W-9** | pg-boss, then JOB-3 and JOB-4 | see `docs/design/seq-pay-run.md` | job signals |
| **W-10** | `safetyEvents` collection + guardian alert delivery | `packages/payload/src/collections/` | SAFE-4's review queue, SAFE-6 |

W-7 is not optional and not deferrable. Turning on an error reporter in a
children's product before the scrubber exists ships prompts, transcript turns
and usernames to a third party — which is the same class of failure doc 07 §4's
never-train wall exists to prevent, arriving through a different door.

---

## 8 · Seams cited

| Seam | File : symbol |
|---|---|
| Auth boundary and the telemetry gap | `packages/app/core/protected-operation.ts` : `protectedOperation`, `ProtectedCtx` |
| Coach turn branch points | `packages/app/features/tutor/coach.service.ts` : `coachTutorTurn`, `coach`, `CoachEvent` (`chunk` · `replace` · `blocked` · `unavailable` · `end`) |
| Plane trace and outcomes | `packages/safety/src/plane.ts` : `runSafetyPlaneStream`, `PlaneResult`, `PlaneLog`, `PlaneOutcome`, `InputClass`, `screenInput`, `takeSentences` |
| Deterministic firewall | `packages/safety/src/firewall.ts` : `screen`, `FirewallRuleId` |
| Crisis protocol | `packages/safety/src/crisis.ts` : `crisisResponse`, `isPedagogicallyStorable` |
| Red-team suite | `packages/safety/src/red-team.ts` · `packages/safety/src/safety.test.ts` |
| SSE transport | `apps/web/app/api/tutor/coach/route.ts` : `POST`, `isCoachBody` |
| Client state mapping | `packages/app/features/tutor/tutor.store.ts` : `useTutorStore`, `readCoachEvents` |
| Paused surface | `packages/ui/TutorStage.tsx` : `'paused'` case |
| Vendor adapter | `packages/app/features/tutor/tutor-model.ts` : `streamTutorTurn`, `TUTOR_MODEL` |
| Context assembly cost | `apps/web/lib/student-model.repository.ts` : `loadPriorFacts`, `loadGradeBand` · `packages/student-model/src/brief.ts` : `compileLearnerBrief` |
| Billing webhook surface | `apps/web/app/api/auth/[...all]/route.ts` : `auth.handler` · `packages/auth/src/server.ts` : `billingPlugin` |
| Trial reminders (shed tier 1) | `packages/auth/src/trial.ts` : `TRIAL_REMINDER_DAYS_BEFORE`, `trialSchedule` |
| Retention sweep and its schedule | `apps/web/app/api/media/sweep/route.ts` : `POST` · `apps/web/app/api/media/sweep/cron/route.ts` : `GET` · `apps/web/vercel.json` crons `0 3 * * *` · `packages/app/features/media/retention.ts` : `MEDIA_TTL_DAYS` |
| No-training-path gate | `tooling/check-no-training-path.mjs` (runs inside `pnpm lint`) |
| Mobbin references that are the only "Sentry" strings in the tree | `packages/ui/DashboardShell.tsx:16` · `packages/app/features/ops/screen.shared.tsx:11` |

## 9 · NOT YET IMPLEMENTED, collected

1. The Sentry SDK, project, DSN and instrumentation — §2.
2. The Block telemetry record — §2.1.
3. `measurements.ai_first_sentence_ms` — §3.
4. Safety-pipeline spans and tags; `PlaneResult.trace` is built and discarded — §3.
5. A distinction between "a safety layer threw" and "the vendor threw" — SAFE-2, W-6.
6. `safetyEvents` store and guardian alert delivery — SAFE-4, SAFE-6.
7. pg-boss, and therefore queue depth, dead-letter and shed instrumentation — JOB-3, JOB-4, §5. See `docs/design/seq-pay-run.md`.
8. The Inference Gateway fallback chain that AI-2 assumes as the first line of defence — see `docs/design/seq-learner-ai-turn.md`.
9. Structured logging of any kind in the API routes.
10. Sentry Cron monitors, Uptime monitors, and release-health reporting.
