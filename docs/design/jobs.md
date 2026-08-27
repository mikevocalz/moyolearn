<!--
  pg-boss topology — doc 12 §9.4. Queues, priorities, idempotency keys,
  dead-letter policy, and the §7 shed order.
  Why it exists: doc 12 §6 binds the job runner to pg-boss on the SAME Postgres
  (`jobs` schema) and states the reason — transactional enqueue with the domain
  write. §9.4 asks for the topology that decision implies. This document is that
  topology. Three of the fourteen queues
  below are implemented and running (see §0); the other eleven are declared in
  `packages/jobs/src/topology.ts` and deliberately unregistered, which is a state
  the code carries rather than one this page asserts.
  SOT: docs/pack/12-systems-design-prompt.md §5 §6 §7 §9.4 · docs/design/seq-pay-run.md · docs/design/slo.md §4.5 §5
  SOT-KEYWORDS: pg-boss jobs queue topology priority idempotency singleton key dead letter dlq alerting shed order backlog distillation reminders pay run cleanup webhook retry retention sweep revisit trigger
-->

# pg-boss topology — queues, priorities, idempotency, dead letters

**Doc 12 §9.4 · Date: Aug 27, 2026 · Status: design of record. Three of the fourteen queues run; eleven are declared and deliberately unregistered.**

---

## 0 · Status, stated before anything else

**pg-boss is installed and three queues run.** As of this revision:

- `pg-boss: 12.28.0` is in `pnpm-workspace.yaml`'s catalog — one version for the
  workspace, as everything else is — and is a dependency of `@acme/jobs` and of
  the root manifest (for the `pnpm jobs:install` / `jobs:migrate` / `jobs:doctor`
  CLI). Its own `pg` dependency is `^8.23.0`, the catalog's `pg` exactly, so the
  queue and the repositories cannot disagree about how a timestamp comes back.
- The `jobs` schema exists in the database at pg-boss schema version 38, applied
  out of band and recorded in `packages/payload/migrations/jobs_schema.sql`. The
  anon/authenticated REVOKE around it is a Supabase migration
  (`jobs_schema_deny_anon`).
- `packages/jobs` is the runner: `topology.ts` (this document's §2 table as
  `as const satisfies` data), `keys.ts` (§3), `shed.ts` (§4.2 and §5 as pure
  functions), `boss.ts`, `enqueue.ts`, `drain.ts`.
- `apps/web/lib/jobs.ts` is the composition root — the queue package holds no
  handler, so it does not drag Payload, Bunny and the educational store into the
  runner's dependency graph.

**Three queues are LIVE**, meaning they have a producer, a handler, and a row in
`jobs.queue`:

| Queue | Producer | Handler |
|---|---|---|
| `retention.sweep.transcripts` | `apps/web/app/api/retention/sweep/cron/route.ts` : `GET` | wraps `apps/web/app/api/retention/sweep/route.ts` : `POST` |
| `retention.sweep.media` | `apps/web/app/api/media/sweep/cron/route.ts` : `GET` | wraps `apps/web/app/api/media/sweep/route.ts` : `POST` |
| `edu.distill` | `apps/web/app/api/tutor/evaluate/route.ts` : `POST` | `apps/web/lib/distill.service.ts` : `distillTranscript` |

**The other eleven are DECLARED AND UNREGISTERED**, and that is a state the code
carries rather than a state this document asserts: `QueueSpec.status` is
`'declared'`, `QueueSpec.blockedOn` says what is missing, and
`ensureLiveQueues` creates nothing for them. An empty queue with no worker reads
on every dashboard exactly like a healthy one, so none is created in pg-boss at
all. `@acme/jobs`'s `JobHandlers` is a TOTAL map over the live set, so promoting
a queue is a compile error until it has a handler.

**§8.2's worker question is answered, and the answer is the narrow one.** The
runner is a bounded drain (`POST /api/jobs/drain`, cron door at
`/api/jobs/drain/cron`) rather than a long-lived process, because that is the
option that needs no new infrastructure and therefore no cost analysis to
justify. What it buys and what it does not is stated in
`packages/jobs/src/drain.ts`'s header; the short version is that latency is
bounded by the SCHEDULE, so any queue needing slo.md JOB-4's five minutes needs a
real worker first. Nothing live today does — the sweeps are daily and
distillation is drained by `after()` inside the turn that enqueued it.

**Transactional enqueue is still NOT available** (§8.3), and that is the one
promise §1 makes that this implementation does not yet keep. `enqueue`'s `db`
option is the seam; nothing passes it, because `protectedOperation` hands an
operation a `ctx` and not a transaction handle.

The two Vercel Crons that existed before this work still exist and still fire on
the same schedules; what changed is that each now enqueues its queue and drains
it inside its own window, so the daily guarantee is unchanged and the queue adds
deduplication, a retry ladder and a dead letter on top of it. A third cron drains
everything every 30 minutes, which is the retry path.

| Path | Schedule | Handler |
|---|---|---|
| `/api/media/sweep/cron` | `0 3 * * *` | `apps/web/app/api/media/sweep/cron/route.ts` : `GET` |
| `/api/retention/sweep/cron` | `0 4 * * *` | `apps/web/app/api/retention/sweep/cron/route.ts` : `GET` |
| `/api/jobs/drain/cron` | `*/30 * * * *` | `apps/web/app/api/jobs/drain/cron/route.ts` : `GET` |

Sections §2–§6 below describe the whole topology, live and declared. Where a
queue is not live, the table says so.

---

## 1 · Why this runner, restated so it is not relitigated

Doc 12 §6, binding:

> **Jobs: pg-boss on the same Postgres.** Trade-off taken deliberately: one less
> infrastructure, transactional enqueue with domain writes, honest fit for v1
> volume (distillation, reminders, pay runs, cleanups, webhook retries).

The load-bearing half is **transactional enqueue**. The domain write and the
`boss.send` commit together or neither happens, because they are the same
Postgres transaction. That property is what the topology below is built on, and
it is the property a Redis-backed queue cannot offer at any price:

- `docs/design/seq-pay-run.md` states it at the point it matters — *"Approval and
  enqueue commit together or not at all."* A pay run approved without its job
  enqueued is money the system believes it has sent.
- The same shape protects distillation: the transcript row and the
  `edu.distill` job are one commit, so there is no window in which a child's
  transcript exists with nothing scheduled to derive from it before it expires.

`jobs` is its own schema for the same reason `payload`, `auth` and `edu` are:
the three-store separation of doc 12 §3 is schema-level, and a queue table
holding a payload of learner ids is not operational data.

---

## 2 · The queues

pg-boss orders by `priority` **descending**, then by creation time. The ladder
below is coarse on purpose — five bands, not fifteen — because a priority number
nobody can justify is a number that drifts.

| Queue | Priority | Doc 12 §6 category | Retry | Status |
|---|---|---|---|---|
| `safety.alert.guardian` | **100** | (not in §6's list; added from §7) | 10 × exponential from 15 s | NOT YET IMPLEMENTED |
| `safety.review.enqueue` | **100** | — | 10 × exponential from 15 s | NOT YET IMPLEMENTED |
| `billing.webhook.replay` | **80** | webhook retries | 8 × exponential from 30 s | NOT YET IMPLEMENTED |
| `payroll.payRun.execute` | **60** | pay runs | 5 × exponential from 60 s | NOT YET IMPLEMENTED |
| `payroll.transfer.send` | **60** | pay runs | 5 × exponential from 60 s | NOT YET IMPLEMENTED |
| `retention.sweep.transcripts` | **50** | (retention sweeps) | 3 × exponential from 5 min | **LIVE** |
| `retention.sweep.media` | **50** | (retention sweeps) | 3 × exponential from 5 min | **LIVE** |
| `edu.distill` | **40** | distillation | 5 × exponential from 30 s | **LIVE** |
| `payroll.statement.render` | **30** | pay runs | 5 × exponential from 60 s | NOT YET IMPLEMENTED |
| `cleanup.unlinkedLearner` | **20** | cleanups | 3 × exponential from 5 min | NOT YET IMPLEMENTED |
| `cleanup.staleTutorSession` | **20** | cleanups | 3 × exponential from 5 min | NOT YET IMPLEMENTED |
| `notify.reminder.trial` | **10** | reminders | 3 × exponential from 5 min | NOT YET IMPLEMENTED |
| `notify.reminder.session` | **10** | reminders | 3 × exponential from 5 min | NOT YET IMPLEMENTED |
| `notify.digest.guardian` | **10** | reminders | 3 × exponential from 5 min | NOT YET IMPLEMENTED |

The `payroll.*` and `safety.alert.*` names, and their relative priorities, are
already committed in `docs/design/seq-pay-run.md` §*Queue topology and shed
order*. They are reproduced rather than renamed: a second naming scheme for the
same queue is the exact failure CLAUDE.md's *patterns are law* rule exists to
prevent.

### 2.1 · What each queue actually does, and what it attaches to

**`safety.alert.guardian`** — delivers the S26 guardian alert built by
`packages/safety/src/crisis.ts:guardianAlert`. Enqueued from the AI turn's
after-close path (doc 12 §5) when `PlaneResult.outcome.kind` is `crisis` or
`blocked`. This queue is **not** in doc 12 §6's list of five; it is here because
§7 names it as the thing that is never shed, and a queue you must never shed has
to exist in the topology that decides shedding.

**`safety.review.enqueue`** — the human review queue doc 07 §3 layer 6 requires.
Same priority, same never-shed rule.

**`billing.webhook.replay`** — re-runs a Stripe webhook whose handler threw. The
verification and first attempt stay **synchronous** inside the Better Auth Stripe
plugin (`packages/auth/src/server.ts:billingPlugin`, mounted through
`apps/web/app/api/auth/[...all]/route.ts`); only a *failed* handler enqueues.
Reason: Stripe's own retry ladder already covers transport failures, and a queue
that swallowed the first attempt would convert a 500 Stripe would retry into a
200 it will not.

**`payroll.payRun.execute` / `payroll.transfer.send` / `payroll.statement.render`**
— exactly as drawn in `docs/design/seq-pay-run.md`. No payroll domain code
exists yet; the diagram is the contract.

**`retention.sweep.transcripts` / `retention.sweep.media`** — the two sweeps.
LIVE. Each cron door now enqueues its queue and drains it inside the same
request, so the daily guarantee is exactly where it was and the queue adds the
three things a bare cron cannot have: a `singletonKey` on the UTC day, so a
Vercel retry or a hand-triggered run cannot start a second sweep on top of the
first; a retry ladder, so a sweep that fails at 04:00 comes back minutes later on
the general drain rather than being lost until 04:00 tomorrow — a twenty-four-hour
hole in a published window on a child's data; and a dead letter with an alert
when the ladder runs out. The sweep implementation did not move and was not
copied: `apps/web/lib/jobs.ts` calls the same POST the cron door already called.

**`edu.distill`** — distillation, off the request path. LIVE.
`evaluateTutorTurn` distils only when it is handed BOTH a `loadPriorFacts` and a
`saveFacts` port, so `apps/web/app/api/tutor/evaluate/route.ts` — the composition
root for the tutoring write path — now withholds them and wraps the transcript
port instead: the row lands, then `edu.distill` is enqueued on the transcript id,
then `after()` drains that one queue once the answer is already on its way to the
child. That is doc 12 §5's *"Async after close: distillation job"* in the only
shape a Vercel function can offer it. The service's algebra did not change; what
changed is when it runs. `apps/web/lib/distill.service.ts:distillTranscript` is
the handler, and it reads the learner id off `edu.transcripts.learner_id` rather
than taking one — a job has no session, and the row is the durable record of
whose turn it was.

**`cleanup.unlinkedLearner`** — doc 06 §3.1's rule that an unlinked child account
is deleted within 7 days. `docs/design/seq-guardian-creates-child.md` draws it
and marks it unbuilt; `packages/auth/src/create-managed-learner.ts:createManagedLearner`
is the write it has to undo.

**`cleanup.staleTutorSession`** — closes `tutorSessions` rows left open by an app
that never came back. `packages/payload/src/collections/TutorSessions.ts` carries
an indexed `expiresAt`; nothing reads it except the retention sweep, which
deletes rather than closes.

**`notify.reminder.*` / `notify.digest.guardian`** — trial reminders from
`packages/auth/src/trial.ts:TRIAL_REMINDER_DAYS_BEFORE` and `trialSchedule`,
session reminders from the schedule model, and the weekly guardian digest. Note
doc 07's constraint binds this queue and not the others: **no late-night pushes
to a minor**, so `notify.reminder.session` schedules into the learner's local
waking hours rather than firing at `startAt − 30m` whatever the clock says.

---

## 3 · Idempotency — the key, and exactly what it is derived from

Doc 12 §6: *"Every job idempotent + dead-letter with alerting."*

Two mechanisms, and they are not interchangeable. **`singletonKey`** is pg-boss's
own: at most one job with that key may be queued or active at a time, which
prevents a *double enqueue*. The **natural key** is the handler's: a unique
constraint or a deterministic id that makes a *second execution* a no-op. A queue
needs both, because `singletonKey` stops protecting the moment the first job
completes and something enqueues again.

| Queue | `singletonKey` derived from | Natural key that makes re-execution a no-op |
|---|---|---|
| `safety.alert.guardian` | `${sessionId}:${messageId}:${outcome.kind}` — `sessionId` from `packages/payload/src/collections/TutorSessions.ts`, `messageId` from `packages/app/features/tutor/session.types.ts:StoredMessage.id` | the `safetyEvents` row (doc 12 §4). **That collection does not exist**, so today there is nothing durable to dedupe against — see §3.1 |
| `safety.review.enqueue` | same triple as above | same `safetyEvents` row |
| `billing.webhook.replay` | the Stripe **event id** (`evt_…`) off the verified payload | the subscription/invoice projection write is an upsert keyed on the Stripe object id; `packages/auth/src/server.ts:billingPlugin` owns it |
| `payroll.payRun.execute` | `${payRunId}` | `payRun.status` transition guarded on `approved → executing`; a run already past `approved` is skipped |
| `payroll.transfer.send` | `${payRunId}:${lineId}` | the **same string** is sent as Stripe's `Idempotency-Key` on `transfers.create`, and is a unique constraint on the `transfers` projection row. Three layers, one key — stated in `docs/design/seq-pay-run.md` §*Idempotency, stated once* |
| `payroll.statement.render` | `${payRunId}:${tutorId}` | the statement artifact is written at a deterministic storage key; re-render overwrites |
| `retention.sweep.transcripts` | `retention:transcripts:${YYYY-MM-DD}` (UTC date of the scheduled run) | **already idempotent without a key.** The route reads `expiresAt <= cutoff` and deletes exactly that set; a second run finds nothing. `apps/web/app/api/retention/sweep/route.ts` |
| `retention.sweep.media` | `retention:media:${YYYY-MM-DD}` | age is read off the bucket listing, and `apps/web/lib/bunny-delete.ts:deleteObject` counts a 404 as success — deleting an absent object is the state the caller wanted |
| `edu.distill` | `${transcriptId}` — the `sessionTranscripts.sessionId`, which is what `tutor.service.ts` already writes into a fact's `derivedFrom` | `packages/student-model/src/distill.ts:factId` produces `${learnerId}:${kind}:${subject}`, a deterministic id, and `saveFacts` upserts on it. Re-running distillation over the same transcript recomputes the same rows |
| `cleanup.unlinkedLearner` | `${learnerAuthId}` | the delete is conditional on *still* being unlinked; a learner linked since enqueue is skipped, not deleted |
| `cleanup.staleTutorSession` | `${sessionId}` | closing an already-closed session is a no-op on `closedAt` |
| `notify.reminder.trial` | `${subscriptionId}:${TRIAL_REMINDER_DAYS_BEFORE}` | a `notificationsSent` row keyed on the same string; the send is skipped if it exists |
| `notify.reminder.session` | `${scheduleEventId}:${offsetMinutes}` | same `notificationsSent` row |
| `notify.digest.guardian` | `${guardianId}:${isoWeek}` | same `notificationsSent` row |

Two rules that fall out of the table and are worth stating separately:

1. **The idempotency key is never derived from the payload's content.** Hashing a
   job payload produces a key that changes when an unrelated field changes, which
   is how a "sent once" guarantee quietly becomes "sent once per schema version".
   Every key above is built from ids that already exist in a row.
2. **`edu.distill`'s key is the transcript, not the learner.** Keying on the
   learner would collapse two transcripts from the same child in the same minute
   into one job and silently lose the second one's facts.

### 3.1 · The one queue whose key is not yet buildable

`safety.alert.guardian` is the queue that must never be shed, and it is the queue
with the weakest idempotency story, because doc 12 §4's `safetyEvents` collection
does not exist — `packages/payload/src/payload.config.ts` registers twelve
collections and that is not one of them. `packages/safety/src/plane.ts:PlaneResult`
carries `trace: PlaneLog[]`, which is diagnostic, not durable, and
`crisis.ts:guardianAlert(category, at)` takes no event id at all.

Until `safetyEvents` lands, the `singletonKey` above is the only dedupe available
and there is no natural key behind it. That asymmetry is deliberate and is the
safe direction: **a duplicated crisis alert is an annoyance; a suppressed one is
the failure doc 07 §3 layer 6 exists to prevent.** So the key is scoped tightly
(session + message + outcome) rather than broadly (learner + day), and a
guardian receiving two alerts for two distinct turns is the correct outcome.

---

## 4 · Dead letters

### 4.1 · Policy

pg-boss moves a job to its dead-letter queue after `retryLimit` is exhausted.
The policy:

| Rule | Value | Why |
|---|---|---|
| DLQ per queue | `<queue>.dlq` | A shared DLQ makes "which promise is broken" a query rather than a glance |
| Retention in DLQ | **30 days** | Long enough to replay after a fix ships; short enough that a DLQ holding learner ids is not a second permanent store |
| Payload in DLQ | **ids only, never content** | A dead-lettered `edu.distill` job holding a child's turns is a transcript outside the retention window, unreachable by `expireTranscripts` and invisible to `sweep.sql`. Jobs carry `transcriptId`; the handler loads the row |
| Replay | manual, by a human, per job | An automatic DLQ drain re-runs the failure that filled it |
| Archive | pg-boss `maintenance` on the default schedule | Completed jobs move to `jobs.archive` and are dropped; a queue table that only grows is the next incident |

The **ids-only** rule is the one with teeth. It is what keeps the queue out of
the erasure cascade's blind spot: `packages/student-model/src/erasure.ts`
defines deletion on provenance across `sessionTranscripts` and
`studentModelFacts`, and `packages/payload/src/retention/sweep.sql` covers the
version shadow tables. Neither can see `jobs.job`. A job row that holds only
`{ transcriptId }` becomes harmless the moment the transcript is deleted — its
handler finds nothing and completes. A job row that holds the turns is a copy
nobody swept.

### 4.2 · Alerting

`docs/design/slo.md` §4.5 already reserves the two rules and marks both blocked
on this document's subject:

| id | Rule | Window | Trigger | Severity |
|---|---|---|---|---|
| **JOB-3** | Dead-letter depth | 15 min | critical ≥ **1** on a safety queue, warning ≥ **10** elsewhere | PAGE / TICKET |
| **JOB-4** | Queue latency SLO breach | 15 min | > 5 min for a normal-priority job | TICKET |

The asymmetry in JOB-3 is the whole point: **one** dead-lettered
`safety.alert.guardian` job is one guardian who was not told, and that pages at
any hour. Ten dead-lettered reminders is a ticket.

Three additions this document asks slo.md for, in its own rule shape:

| id | Rule | Surface | Window | Trigger | Severity |
|---|---|---|---|---|---|
| **JOB-5** | Transcript retention sweep missed | Sentry Cron monitor `retention-sweep`, schedule `0 4 * * *` (matches `apps/web/vercel.json`) | daily | missed or errored check-in | **PAGE** — same reasoning as JOB-1, on a child's transcripts rather than their media |
| **JOB-6** | Sweep 500 rate | `count()` · `transaction:"POST /api/retention/sweep" transaction.status:internal_error` | 1 h | critical ≥ 1 | PAGE |
| **JOB-7** | Shed occurred | `count()` on the `ops.shed` event slo.md §5 already specifies | 24 h | warning ≥ 1 | TICKET |

JOB-5 and JOB-6 are implementable **today** — the cron and the route both exist
and both already fail loudly rather than returning a false 200. JOB-7 now has something to count:
`packages/jobs/src/shed.ts:shedPlan` decides the shed, `drain.ts` emits it
through the `JobsReporter` port, and `apps/web/lib/jobs.ts` routes that into
`reportRouteError` — the same reporter every route already uses, so a dead-letter
page and a 500 land in one place rather than two. All three become Sentry alert
rules without any of those files changing, on the day `docs/design/slo.md` §2's
missing SDK lands.

---

## 5 · Shed order under backlog

Doc 12 §7, binding, quoted so it cannot drift:

> job backlog → dead-letter alert + shed non-critical queues first (**reminders
> before pay runs, never safety alerts**).

| Order | Shed | Queues | What it costs |
|---|---|---|---|
| **1st** | Reminders and digests | `notify.reminder.trial`, `notify.reminder.session`, `notify.digest.guardian` | A late reminder is an annoyance |
| **2nd** | Derived and cosmetic work | `edu.distill`, `payroll.statement.render`, `cleanup.*` | The tutor is slightly less personalized; a statement renders late. Nobody is unsafe or unpaid |
| **3rd** | Pay runs | `payroll.payRun.execute`, `payroll.transfer.send` | Money is late. Bad, and recoverable — the run is approved and idempotent per `${payRunId}:${lineId}` |
| **not shed** | Retention sweeps | `retention.sweep.transcripts`, `retention.sweep.media` | A published window on a child's data. Deferring it is not a delay, it is a breach |
| **not shed** | Webhook replay | `billing.webhook.replay` | Shedding it strands a paid subscription in `pending` and leaves guards flipped the wrong way |
| **NEVER** | Safety alerts and review | `safety.alert.guardian`, `safety.review.enqueue` | Doc 07 §3 layer 6. **There is no load level at which a guardian is not told** |

Shedding is a **decision and it must be visible**: every shed emits `ops.shed`
with the queue name and the depth that triggered it, and raises JOB-7 on the
first occurrence in 24 hours. A queue that quietly sheds nightly reads on every
dashboard as a queue that is keeping up.

**One correction against an existing document.** `docs/design/seq-pay-run.md`'s
topology table lists `retention.sweep` as *"shed 2nd — has its own TTL slack"*.
`docs/design/slo.md` §5 lists it as **not shed** — *"it is a promise about a
child's data with a stated window"*. slo.md is right and this document follows
it. The "TTL slack" argument reads the window backwards: `TRANSCRIPT_TTL_DAYS`
(`packages/student-model/src/facts.ts`) is 30 days and `MEDIA_TTL_DAYS`
(`packages/app/features/media/retention.ts`) is 7 — those are the **maximums a
family was promised**, not headroom the system may spend when it is busy. The
sweeps are also two daily jobs; shedding them relieves nothing.

---

## 6 · The revisit trigger

Doc 12 §6 and the §8 trade-off table both fix it:

> Revisit trigger: **sustained > ~50 jobs/s** or **queue latency SLO breach** →
> move hot queues to dedicated infra.

Made operational:

| Signal | Measured as | Threshold | Then |
|---|---|---|---|
| Throughput | jobs completed/sec across all queues, 15-min rolling | **> 50/s sustained for 60 min**, twice in 7 days | Open the ADR. Move the **hottest single queue** to dedicated infra, not the whole runner |
| Queue latency | enqueue → first-attempt start, p95, per queue | **> 5 min on a normal-priority queue** (slo.md JOB-4) | Same |
| Postgres saturation | connection count + CPU attributable to the `jobs` schema | Job workers holding **> 25 %** of the pool `packages/payload/src/payload.config.ts` caps at `max: 8` | Tune worker concurrency **first**; this is a config problem before it is an architecture one |

Two things this trigger explicitly is **not**:

- **Not a queue-depth threshold.** Depth is a symptom of arrival rate and
  concurrency together, and a deep queue draining fast is healthy. Latency is the
  number a family experiences.
- **Not a signal to move everything.** The reason pg-boss was chosen is
  transactional enqueue (§1), and that property is lost the moment a queue leaves
  Postgres. `payroll.*` and `edu.distill` are the two that depend on it most; if
  a hot queue must move, it should be one that does not — `notify.*` is the
  natural first candidate and is also the one shed first.

### 6.1 · Where the §7 load model puts us

Doc 12 §7's Phase-2 target is ~8k learner AI sessions/day. If every session
produced one `edu.distill` job, that is **0.09 jobs/s** averaged, and doc 12 §7's
3–7pm peak concentrates it into roughly **0.6 jobs/s**. Reminders, cleanups and
pay runs are daily batches measured in thousands, not per-second rates.

The revisit trigger is **two orders of magnitude** above the design load. That is
the honest reading of doc 12 §6's *"honest fit for v1 volume"*, and it is the
reason this topology does not hedge with an abstraction layer over the queue: a
runner swap that is 100× away is a swap you design for when it is 2× away.

---

## 7 · Seams

| Seam | `file:symbol` | Status |
|---|---|---|
| Transactional boundary jobs must enqueue inside | `packages/app/core/protected-operation.ts` : `protectedOperation`, `ProtectedCtx` | real; does not yet expose a transaction handle |
| Postgres pool the `jobs` schema would share | `packages/payload/src/payload.config.ts` : `postgresAdapter({ pool: { max: 8 }, schemaName: 'payload' })` | real |
| Raw pool access from a repository | `apps/web/lib/retention.repository.ts` : `sweepVersionShadows` (`payload.db.pool`) | real — the only non-Payload SQL path in the app |
| Distillation, the work `edu.distill` carries | `packages/student-model/src/distill.ts` : `distill`, `factId`, `transcriptExpiry` · `packages/app/features/tutor/tutor.service.ts` : `evaluateTutorTurn` | **real, LIVE, off the request path** |
| Distillation's writes | `apps/web/lib/student-model.repository.ts` : `saveTranscript`, `saveFacts`, `loadPriorFacts` | real |
| Re-derivation guard the queue must preserve | `packages/student-model/src/erasure.ts` : `withoutBlockedTags` · `tutor.service.ts` : `LoadBlockedTags` | real |
| Retention sweep, transcripts + derived facts | `apps/web/app/api/retention/sweep/route.ts` : `POST` (bearer `RETENTION_SWEEP_SECRET`) · `apps/web/lib/retention.repository.ts` : `loadExpiredTranscripts`, `loadFactsDerivedFrom`, `deleteFacts`, `updateFactProvenance`, `deleteTranscripts`, `sweepVersionShadows` · `packages/student-model/src/erasure.ts` : `expireTranscripts` | **real, wired, scheduled, LIVE as a job** |
| Retention sweep, version shadow tables | `packages/payload/src/retention/sweep.sql` | real |
| Retention sweep, media | `apps/web/app/api/media/sweep/route.ts` : `POST` (bearer `MEDIA_SWEEP_SECRET`) · `apps/web/lib/bunny-delete.ts` : `deleteObject`, `deleteObjects` | **real, wired, scheduled, LIVE as a job** |
| Cron doors — now enqueue + drain their own queue | `apps/web/app/api/media/sweep/cron/route.ts` : `GET` · `apps/web/app/api/retention/sweep/cron/route.ts` : `GET` (both bearer `CRON_SECRET`) | real, LIVE |
| Cron schedule | `apps/web/vercel.json` : `crons` | real |
| Reminder timing | `packages/auth/src/trial.ts` : `TRIAL_REMINDER_DAYS_BEFORE`, `trialSchedule`, `TrialSchedule` | real, no sender |
| Reminder surface | `packages/app/features/notifications/notifications.store.ts` : `useNotifications`, `Notification` | real, client-side only |
| Session timing for `notify.reminder.session` | `packages/app/features/schedule/model.ts` : `ScheduleEvent`, `zonedMinutesOfDay` | real |
| Guardian alert payload | `packages/safety/src/crisis.ts` : `guardianAlert`, `GuardianAlert`, `crisisResponse` | real, **no delivery path** |
| Plane outcome that triggers an alert | `packages/safety/src/plane.ts` : `PlaneResult`, `PlaneOutcome`, `runSafetyPlane`, `runSafetyPlaneStream` | real |
| Stripe webhook (what `billing.webhook.replay` retries) | `packages/auth/src/server.ts` : `billingPlugin` (`stripeWebhookSecret`) · `apps/web/app/api/auth/[...all]/route.ts` : `POST` | real |
| Pay-run contract | `docs/design/seq-pay-run.md` · `packages/auth/src/billing-plans.ts` : `BILLING_ROLES`, `authorizeReference`, `PlanLimits.payoutAutomation` | diagram real, payroll domain absent |
| Cleanup target | `packages/auth/src/create-managed-learner.ts` : `createManagedLearner`, `LearnerWriter` · `docs/design/seq-guardian-creates-child.md` | real, cleanup absent |
| Stale-session target | `packages/payload/src/collections/TutorSessions.ts` : `expiresAt`, `closedAt` | real |
| The runner itself | `packages/jobs/index.ts` : `getBoss`, `ensureLiveQueues`, `enqueue`, `drainQueues`, `shedPlan`, `deadLetterAlerts` | **real, LIVE** |
| Handlers, and the only place they are bound to queues | `apps/web/lib/jobs.ts` : `jobHandlers`, `drain`, `enqueueSweep`, `enqueueDistillation` | **real, LIVE** |
| The worker (§8.2's bounded drain) | `apps/web/app/api/jobs/drain/route.ts` : `POST` (bearer `JOBS_DRAIN_SECRET`) · `.../drain/cron/route.ts` : `GET` (bearer `CRON_SECRET`) | **real, LIVE** |
| Alert rules this topology feeds | `docs/design/slo.md` §4.5 (JOB-1…JOB-4), §5 (shed order) | real |

---

## 8 · Still NOT IMPLEMENTED — the whole list

Renumbered against §0. Items 1, 2 and 6 of the original list are done; what
follows is what is left, unchanged in substance.

1. **A transaction handle on the Block.** `protectedOperation` gives a `ctx`, not
   a transaction. Transactional enqueue — §1's entire reason for this runner — is
   unavailable until an operation can hand the same transaction to both the
   domain write and `boss.send`. `enqueue`'s `db` option is the seam and nothing
   passes it. The window this leaves is one statement wide (`saveEduTranscript`
   then `enqueue`), and the failure it produces — a transcript with no
   distillation job — is recoverable by re-enqueueing on the same key, because
   the key is the transcript id.
2. **`safetyEvents` as a queue key.** Doc 12 §4 names the collection;
   `payload.config.ts` does not have it. Without it `safety.alert.guardian` has
   no natural key (§3.1) and JOB-3's "≥ 1 on a safety queue" has nothing to
   count. The queue is declared, `blockedOn` says exactly this, and no worker is
   registered for it — which is the safe direction, because a queue that looked
   registered would make the alert look shipped.
3. **A `notificationsSent` store.** Every `notify.*` natural key in §3 points at
   it. It does not exist, so all three `notify.*` queues are declared-only.
4. **The payroll domain.** No `payRuns`, no `payRates`, no `transfers`
   projection, and **no Stripe Connect in this repository at all**.
   `docs/design/seq-pay-run.md` is the contract; nothing implements it, so all
   three `payroll.*` queues are declared-only and a test asserts that they are.
5. **Automatic shed enforcement above the drain.** §5 is decided and emitted —
   `shedPlan` refuses to fetch a shed queue and `ops.shed` is raised — but the
   threshold is a constant (`BACKLOG_SHED_DEPTH`), not something read from the
   §6 latency signal. That is the honest v1: §6.1 puts the design load two orders
   of magnitude below the revisit trigger, and a tuning loop for a backlog that
   has never happened is a mechanism nobody can validate.
6. **A real worker.** The bounded drain's latency floor is its cron schedule
   (§0), so slo.md JOB-4's five-minute budget is unreachable for any queue that
   is not drained inside its own producing request. Nothing live needs it today;
   `notify.reminder.session` would.
7. **Sentry.** Doc 12 §7 says Sentry is "already connected"; `docs/design/slo.md`
   §2 records that in this repository it is not. JOB-3…JOB-7 are written in
   Sentry's alert-rule shape, and the drain already emits them through
   `JobsReporter` into `reportRouteError`, so the day the SDK lands the rules are
   a dashboard change rather than a code change.
