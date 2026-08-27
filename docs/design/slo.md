<!--
  SLO doc and alert rules (doc 12 §9.5), matching the §7 targets.
  Why it exists: doc 12 §7 fixes the numbers and names Sentry as the destination
  for errors and traces; §9.5 asks for the SLO document and the alert rules that
  make those numbers enforceable, with safety-pipeline degradation paging.
  What this doc had to correct: §7 says Sentry is "already connected". When it
  was written that was false of THIS repository. The SDK, the instrumentation,
  the scrubber and the Block record have since landed; the Sentry project and
  its DSN have not — see §2. Every rule below still names the instrumentation
  point it needs and states itself in Sentry's own alert-rule shape, and §7
  carries a per-item status so nothing here reads as working that is not.
  SOT: docs/pack/12-systems-design-prompt.md §2 §6 §7 §9.5 · docs/pack/07-security-child-ai-safety-spec.md §3
  SOT-KEYWORDS: slo alert rules sentry golden signals first token latency safety pipeline page severity error budget shed order availability rpo rto block telemetry record scrubber beforeSend wiring order
-->

# SLOs and alert rules

**Date:** Aug 27, 2026 (revised same day: W-1, W-3, W-7 landed; W-2 partial)
· **Status:** design of record for §9.5
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

### 2.0 · What this section said on Aug 27, and what changed the same day

Doc 12 §7 says *"errors + traces to **Sentry** (already connected)"*. When this
document was first written that was **not true of this repository**: no
`@sentry/*` package anywhere in the workspace, no `instrumentation.ts`, no DSN
in any env file, and no structured logging in the API routes — every
`apps/web/app/api/**/route.ts` catch block mapped an error to a status code and
discarded it.

The SDK, the instrumentation, the scrubber and the Block record have since
landed (W-1, W-2, W-3, W-7 — see §7). **The DSN has now landed too** (the
`moyolearn` project; keys in `.env.local` / hosting env, never in git), and
doc 35 refined the whole posture to the free tier: one shared init factory
(`packages/app/core/telemetry-options.ts` — enabled only in production,
`tracesSampleRate: 0`, storm breaker in every `beforeSend`), a `surface` tag
standing in for the deferred three-project split, and
`tooling/check-sentry-invariants.mjs` in `pnpm lint` guarding the §3.1 laws.
What follows below was the state before doc 35; where it says "no DSN", read
"resolved — doc 35".

### 2.1 · What exists

- **SDKs installed and pinned in the catalog.** `@sentry/nextjs` 10.71.0 on
  `apps/web`, `@sentry/react-native` 8.24.0 on `apps/mobile`, both through
  `catalog:` in `pnpm-workspace.yaml`. 8.24.0 builds and tests against
  `react-native` 0.86.2, which is the version this workspace pins, so Expo SDK
  57 support was never in question.
- **Instrumentation.** `apps/web/instrumentation.ts` (`register()` +
  `onRequestError`), `apps/web/sentry.server.config.ts`,
  `apps/web/instrumentation-client.ts`, `apps/mobile/src/telemetry.ts`.
- **The scrubber, before anything could be sent.** See §3.1.
- **The Block record.** See §2.3.

### 2.2 · What still does not exist

- **No DSN, and no project to point one at.** `SENTRY_DSN`,
  `NEXT_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_SENTRY_DSN` are declared, empty, in
  `.env.example`. The connected Sentry account exposes one organization,
  `deviant`, whose only project is `react-native` and belongs to a different
  product. **Every `Sentry.init` in this repo is inside an `if (dsn)`**, so a
  checkout with no DSN behaves exactly like one that never had the SDK. Nothing
  in §3–§6 fires until a `moyolearn` project exists.
- **No edge runtime client.** `sentry.edge.config.ts` is deliberately absent —
  the only edge surface is `middleware.ts`, no rule below queries it, and the
  server scrubber's mask reaches into `@acme/inference`, which would drag a
  vendor SDK into the middleware bundle.
- **No source maps, no releases, no cron/uptime monitors.**
  `withSentryConfig` and the `@sentry/react-native/expo` config plugin are both
  unwired; they need `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` against
  the project that does not exist. Stack frames will read as bundled output
  until they land. Both apps are in the same state deliberately, rather than one
  silently ahead of the other.
- **No queue instrumentation, no `safetyEvents`-backed alerting** — W-9, W-10.

### 2.3 · The prerequisite that gated everything — landed

Doc 12 §7 claims *"the Block gives uniform telemetry for free — every operation
logs `{op, resource, action, ctx.kind, latency, outcome}` structured."*

`packages/app/core/protected-operation.ts:protectedOperation` now emits exactly
that, from a `finally` that covers every branch:

```json
{"evt":"op","op":"ops.leads.list","resource":"leads","action":"read",
 "ctxKind":"org","capability":"export","latencyMs":84,"outcome":"ok",
 "authMode":"session","attributed":true}
```

Built by `packages/app/core/telemetry.ts:operationRecord`, emitted through
`recordOperation` into a settable `OperationSink`. The default sink is
structured stdout — Vercel's log drain is the collector when no vendor is
configured — and `sentry.server.config.ts` installs one that additionally files
each record as a Sentry breadcrumb, so a captured issue arrives already carrying
the operation that produced it.

Four decisions in that record are load-bearing:

- **`op`/`resource`/`action` are optional, and their absence is recorded.**
  W-1 called naming them "an API change to every call site". They arrive
  instead as one grouped `options.telemetry` descriptor, and an operation that
  omits it is recorded as `attributed: false` with `op: "unattributed"` rather
  than guessed at. `count() by attributed` is therefore the burn-down of the
  remaining call sites, on the same dashboard as the signal. **9 of the 14 call
  sites are named today**; the 5 that are not are all in
  `packages/app/features/tutor/`. Latency, outcome, capability and ctx kind are
  emitted for all 14, so SLO-1, SLO-3 and SLO-4 are measurable now — only
  LAT-2's per-operation grouping waits on the rest.
- **`ctxKind` is derived, never stored.** `learner` · `guardian` · `org` ·
  `anonymous`, from `isLearner` and the presence of `orgId`. No `learnerId`, no
  `orgId`, no `userId`, no email, no message text is in the record, and
  `operationRecord`'s input type has no field one could arrive through. A test
  serialises the record for every outcome × ctx-kind pair and asserts none of
  them appears (`packages/app/core/telemetry.test.ts`).
- **`authMode` distinguishes the mock branch.** With
  `NEXT_PUBLIC_AUTH_MODE=mock` and `NODE_ENV=development`, `protectedOperation`
  returns a fixed ctx without calling Better Auth. A measurement taken in that
  mode measures nothing, so every rule below must add `authMode:session` or
  silently average dev samples into a production p95.
- **`denied` and `unauthenticated` are outcomes, not errors.** Folding a
  correctly refused call into `error` would burn SLO-3's budget on the Block
  working. §4.4's `failure_rate()` rules and `reportRouteError` both honour
  that split.

`latencyMs` spans the whole block — session read, capability gate and handler
— which is the quantity §1.1 budgets at 150 ms and LAT-1 measures. The sink is
wrapped so a failing transport can never replace the operation's own error with
the telemetry's.

---

## 3 · The four golden signals

Signals are listed with the Sentry surface that carries them and the exact
symbol that must emit them.

| Signal | Sentry surface | Emitted by | Status |
|---|---|---|---|
| **Latency** | transaction duration, `event.type:transaction` | Next.js server instrumentation (`apps/web/instrumentation.ts` `register()` → `sentry.server.config.ts`), plus the Block record from §2.3 | **wired**, waiting on a DSN |
| **Traffic** | transaction count per `transaction` tag | same | **wired**, waiting on a DSN |
| **Errors** | issues + `failure_rate()` on transactions; `onRequestError` from `instrumentation.ts` | Next 16 `onRequestError` hook, exported from `instrumentation.ts`; plus `reportRouteError` (`apps/web/lib/report-error.ts`) in **17** route catch blocks that previously discarded the error — including all six this table used to name. It refuses to report `CapabilityDenied` and `Unauthenticated`, which are the Block working | **wired**, waiting on a DSN |
| **Saturation** | Postgres connection + CPU (Supabase), plus job-queue depth | Supabase metrics; queue depth has no source — pg-boss is **NOT YET IMPLEMENTED** (see `docs/design/seq-pay-run.md`) | partial |

Plus the two doc 12 §7 names explicitly beyond the four:

| Signal | Sentry surface | Emitted by | Status |
|---|---|---|---|
| **AI first-token (first screened sentence)** | custom measurement `ai_first_sentence_ms` on the `POST /api/tutor/coach` transaction | must be set at the first `{kind:'chunk'}` yield in `apps/web/app/api/tutor/coach/route.ts`'s `ReadableStream.start` | **NOT YET IMPLEMENTED** |
| **Safety-pipeline health** | counted spans, tagged by plane outcome | `packages/app/features/tutor/coach.service.ts:coach` already has the exact branch points — `blocked`, `unavailable`, `replace`, `end` — and `PlaneResult.trace` from `packages/safety/src/plane.ts` already carries the layer that stopped a turn, then **discards it** | **NOT YET IMPLEMENTED** |

### 3.1 · Cardinality rules, non-negotiable — the scrubber, landed

This is a children's product; telemetry is a data-egress path like any other.

- **Never** tag or attribute with `ctx.learnerId`, a username, a `problem`
  string, a `message`, a transcript turn, a `sentence` from
  `studentModelFacts`, or any SSE `chunk` text.
- Safety spans carry the plane **trace layer id** (`1-identity`, `3-input`,
  `2-firewall`, `5-output`, `6-crisis`, `7-memory`) and the `InputClass`, both
  of which are closed enumerations in `packages/safety/src/plane.ts`. Nothing
  free-form.
- The `beforeSend` scrubber is a **red-team-suite obligation**, not a nice to
  have: a prompt that reaches Sentry unscrubbed is a Safety-Plane skip path by
  another name (doc 07 §6 lists exactly that class).

**What was built.** `sendDefaultPii: false` on all three `Sentry.init` calls,
plus `beforeSend` *and* `beforeSendTransaction` running
`packages/app/core/telemetry-scrub.ts:scrubTelemetryEvent` on every event.

It is **not a second copy of the redaction rules**. Free-text masking is
injected as a `TextMask`, so:

| Bundle | Mask | Behaviour |
|---|---|---|
| `apps/web` Node runtime | `@acme/app/telemetry/mask` → `@acme/inference`'s `scrubText` | The reviewed, red-teamed rule set already guarding model egress. Ordinary text survives; contact-shaped spans become `[redacted]` |
| `apps/web` browser, `apps/mobile` | `dropText` | Every message string becomes `[redacted]` |

The browser and RN bundles cannot reach `scrubText`:
`packages/inference/src/pseudonymize.ts` opens with `import 'server-only'`,
which resolves to a throwing shim off the server. The choice there was a second,
unreviewed copy of the patterns in a client bundle or refusing free text
outright. It refuses. Exception **type**, stack frames and the route survive;
the message string does not.

Beyond masking, the scrubber is deny-by-default on structure:

- Request `data`, `cookies`, `headers`, `query_string` and `env` are **dropped
  wholesale**, not per-path. §3.1 originally asked only for bodies on
  `/api/tutor/*`, `/api/learner/*`, `/api/capture/*` and `/api/media/*`;
  dropping every body is strictly stronger and has no allowlist to forget.
- `request.url` and every `span.description` are stripped of query and fragment.
- Stack-frame `vars`, breadcrumb `data` and `logentry.params` are deleted —
  those are where a whole turn lands.
- `user`, `extra` and `server_name` are deleted.
- `contexts` is **allowlisted, not deleted**: `trace`, `runtime`, `os`,
  `device`, `app`, `culture`, `cloud_resource` survive; `response` (which
  carries headers and cookies) and anything a future `setContext` adds do not.
  Deleting `contexts` wholesale — the obvious first version — would have
  silently disarmed every rule in §4.3 and §4.4 by unlinking events from their
  transaction while still delivering them.
- **Session Replay is not enabled and must not be.** It records the DOM of a
  screen showing a child's own work.

**Proof.** `packages/app/core/telemetry.test.ts` builds a Sentry-shaped event
carrying a learner id, a name, a guardian email, a session cookie, a bearer
token and a transcript turn in eleven different fields, scrubs it, and asserts
none of the six strings survives anywhere in the serialised result — plus that
`contexts.trace` does. `packages/app/core/telemetry-mask.server-test.ts` asserts
by function identity that the server mask **is** `scrubText`, then runs a
worksheet header, an email and a phone number through a real exception value.
Both run in `pnpm --filter @acme/app test`.

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
**Status is per-item and deliberately not rounded up** — a table that reads
"done" next to work that is half there is the same failure as an alert rule
written against a config that does not exist.

| id | Work | Touches | Unblocks | Status |
|---|---|---|---|---|
| **W-1** | Emit the Block record `{op, resource, action, ctx.kind, latency, outcome, authMode}` | `packages/app/core/protected-operation.ts` — needs an `op`/`resource` argument it does not currently take, so it is an API change to every call site | everything | **DONE**, with the API change avoided: the descriptor is an optional grouped `options.telemetry`, and its absence is recorded as `attributed: false`. 9 of 14 call sites named; the 5 unnamed are all in `packages/app/features/tutor/`. See §2.3 |
| **W-2** | Install `@sentry/nextjs` on `apps/web` (Next 16.3.1 → `instrumentation.ts` `register()` + `onRequestError`) and `@sentry/react-native` on `apps/mobile` (Expo 57.0.15); create a `moyolearn` Sentry project — the connected org `deviant` has only `react-native`, which belongs to a different product | `apps/web`, `apps/mobile`, catalog in `pnpm-workspace.yaml` | golden signals | **DONE** (doc 35 form). SDKs installed and catalog-pinned; the `moyolearn` project and DSN exist and all three inits run doc 35 §4's shared factory (`@acme/app/telemetry`) behind a DSN guard, production-only; `withSentryConfig` is wired with `tunnelRoute: '/monitoring'`. **Still open, deliberately:** the edge runtime client (unchanged reasoning in `instrumentation.ts`); source-map upload on both apps, gated on `SENTRY_AUTH_TOKEN` in CI/EAS; the doc 35 §3 three-project split (free tier — the `surface` tag stands in) |
| **W-3** | `captureException` in the six API route catch blocks that currently discard the error | `apps/web/app/api/**/route.ts` | ERR signals | **DONE**, and wider than six — 17 route catch blocks call `reportRouteError` (`apps/web/lib/report-error.ts`), which excludes `CapabilityDenied` and `Unauthenticated` |
| **W-4** | Set `measurements.ai_first_sentence_ms` at the first `chunk` frame | `apps/web/app/api/tutor/coach/route.ts` `ReadableStream.start` | AI-1, SLO-2 | open |
| **W-5** | Tag the coach transaction with `coach.event`, `safety.outcome`, and `safety.trace_layers` from the `PlaneResult.trace` that `coach()` currently drops | `packages/app/features/tutor/coach.service.ts` | SAFE-1, SAFE-3, SAFE-4, SAFE-5 | open |
| **W-6** | Distinguish a *thrown* safety layer from a *thrown* vendor call so SAFE-2 has an error type — today both land in one `catch` and become `unavailable` | `packages/app/features/tutor/coach.service.ts:coach` | SAFE-2, and the doc 12 §5 fail-closed rule itself | open |
| **W-7** | `beforeSend` scrubber + `sendDefaultPii: false`, with a red-team case asserting no prompt text escapes | `apps/web`, `apps/mobile`, `packages/safety/src/red-team.ts` | §3.1 — **must land with W-2, not after** | **DONE**, and it did land with W-2. Scrubber in `packages/app/core/telemetry-scrub.ts`, server mask bound to `scrubText` in `telemetry-mask.ts`, proof in `telemetry.test.ts` + `telemetry-mask.server-test.ts`. The assertions live in `@acme/app`'s suite rather than `packages/safety/src/red-team.ts` because the scrubbed thing is a Sentry event, not a model prompt — the red-team suite's subject |
| **W-8** | Sentry Cron monitor check-ins for the media sweep | `apps/web/app/api/media/sweep/cron/route.ts` | JOB-1, JOB-2 | **DONE, redirected by doc 35 §5**: the ONE free cron monitor guards the erasure sweep instead (`withMonitor('retention-sweep')` in `apps/web/lib/jobs.ts` — a dead eraser is silent, a dead drain is loud), and the media sweep is watched by the `/api/health/jobs` dead-man endpoint the one free uptime monitor polls |
| **W-9** | pg-boss, then JOB-3 and JOB-4 | see `docs/design/seq-pay-run.md` | job signals | open |
| **W-10** | `safetyEvents` collection + guardian alert delivery | `packages/payload/src/collections/` | SAFE-4's review queue, SAFE-6 | open |

W-7 is not optional and not deferrable. Turning on an error reporter in a
children's product before the scrubber exists ships prompts, transcript turns
and usernames to a third party — which is the same class of failure doc 07 §4's
never-train wall exists to prevent, arriving through a different door. It landed
in the same change as W-2, which is the only ordering this document ever
accepted.

### 7.1 · The next thing to do

Create the `moyolearn` Sentry project and set `SENTRY_DSN`. Every rule in §3
whose Emitted-by column now says "wired" starts producing data the moment that
lands; nothing else in this table is between them and a working dashboard.

---

## 8 · Seams cited

| Seam | File : symbol |
|---|---|
| Auth boundary, and the Block record it now emits | `packages/app/core/protected-operation.ts` : `protectedOperation`, `ProtectedCtx`, `ProtectedOperationOptions.telemetry` |
| The record itself and its sink | `packages/app/core/telemetry.ts` : `operationRecord`, `recordOperation`, `setOperationSink`, `ctxKindOf`, `OperationRecord` |
| Telemetry egress scrubber | `packages/app/core/telemetry-scrub.ts` : `scrubTelemetryEvent`, `dropText`, `stripUrlParams` · `packages/app/core/telemetry-mask.ts` : `maskTelemetryText` (= `scrubText`) |
| Sentry initialisation | `apps/web/instrumentation.ts` : `register`, `onRequestError` · `apps/web/sentry.server.config.ts` · `apps/web/instrumentation-client.ts` · `apps/mobile/src/telemetry.ts` |
| Route error reporting | `apps/web/lib/report-error.ts` : `reportRouteError` |
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
| Mobbin references that were, before this change, the only "Sentry" strings in the tree | `packages/ui/DashboardShell.tsx:16` · `packages/app/features/ops/screen.shared.tsx:11` |

## 9 · NOT YET IMPLEMENTED, collected

1. **The Sentry project and DSN.** The SDK, the instrumentation and the scrubber
   are in the tree; there is nothing to point them at, so every `Sentry.init`
   no-ops — §2.2, W-2.
2. The edge-runtime Sentry client, `withSentryConfig`, the
   `@sentry/react-native/expo` plugin, and therefore source maps and releases —
   §2.2, W-2.
3. `measurements.ai_first_sentence_ms` — §3, W-4.
4. Safety-pipeline spans and tags; `PlaneResult.trace` is built and discarded — §3, W-5.
5. A distinction between "a safety layer threw" and "the vendor threw" — SAFE-2, W-6.
6. `safetyEvents` store and guardian alert delivery — SAFE-4, SAFE-6, W-10.
7. pg-boss, and therefore queue depth, dead-letter and shed instrumentation — JOB-3, JOB-4, §5. See `docs/design/seq-pay-run.md`.
8. The Inference Gateway fallback chain that AI-2 assumes as the first line of defence — see `docs/design/seq-learner-ai-turn.md`.
9. ~~Sentry Cron monitors, Uptime monitors, and release-health reporting — W-8.~~
   Landed via doc 35: `retention-sweep` cron check-in, `/api/health/jobs`
   dead-man endpoint for the uptime monitor, `enableAutoSessionTracking` on
   mobile. The monitor objects themselves are Sentry-UI actions — checklist in
   `packages/app/core/telemetry-options.ts`.
10. Operation names on the 5 `protectedOperation` call sites in
    `packages/app/features/tutor/`, which is what LAT-2's per-operation
    grouping is waiting on. Query `attributed:false` to see them — §2.3.

### 9.1 · Landed since this document was written

- The Block telemetry record — §2.3, W-1.
- The Sentry SDKs and their server/browser/Expo initialisation — §2.1, W-2 (partial).
- `reportRouteError` in 17 API route catch blocks — §3, W-3.
- The `beforeSend`/`beforeSendTransaction` scrubber and `sendDefaultPii: false`
  on every client — §3.1, W-7.
- Structured logging in the server path: every `protectedOperation` writes one
  JSON line, with or without a vendor configured — §2.3.
