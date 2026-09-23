# The job runner stopped, and the media retention sweep had already been failing for four days

**Status:** investigating → fixes on `fix/jobs-drain-retention`, not yet deployed
**Opened:** 2026-09-22
**Severity:** SEV-2. Two live retention promises unmet; no learner-facing surface degraded.
**Author:** on-call, 2026-09-22

Blameless. Nobody here made a careless choice. Every failure below is a place
where the system let a correct-looking action produce a silent wrong outcome.

---

## Summary

Two independent failures, stacked.

1. **`POST /api/jobs/drain` has returned 500 on every call since 2026-09-21T22:46Z.**
   **Production stopped being built from `main`.** On 2026-09-21T22:46:57Z the
   `moyo-app` production deployment moved from `59f34af` on `main` to `8b2ae90`
   on `codex/homework-scanner-audit-2026-09-21`, and has stayed there. That
   branch already pinned `pg-boss: 12.33.0` in its catalog; `main` pins 12.28.0
   and always has. Nothing on `main` changed — `git log -S "pg-boss: 12." --
   pnpm-workspace.yaml` on `main` returns a single commit, from 2026-08-27.
   Looking for a bad commit on `main` will find nothing.

   pg-boss carries the database schema version it requires in its own
   `package.json`. 12.28.0 declares 38; 12.33.0 declares 42. The production
   `jobs.version` row reads 38. This repository deliberately runs the client
   with `migrate: false`, so a version disagreement is an assertion rather than
   an upgrade, and `PgBoss.start()` throws
   `pg-boss database requires migrations` before any queue work happens.
   The same throw takes `enqueue()` with it, so the daily sweeps have not been
   *queued* since 2026-09-21 either.

2. **`POST /api/media/sweep` has returned 500 on every run since 2026-09-18.**
   Older, separate, and unrelated to the deployment. It dead-lettered four
   consecutive daily sweeps. The actual error message has never been recorded
   anywhere, because both callers in front of it discard the response body.

The third finding is the one that let both run: **every failure on this path is
unreadable by construction.** The GitHub workflow uses `curl -f`, which discards
the body. `callSweep` in `apps/web/lib/jobs.ts` reads `response.status` and
discards the body. The drain's own reporter calls `Sentry.captureException`,
and the production project has no Sentry DSN configured, so it is a no-op. Three
layers, each of which had the exact error string in hand, and none of which
wrote it down.

---

## Impact, stated precisely

`MEDIA_TTL_DAYS` is 7 (`packages/app/features/media/retention.ts`), sourced to
`docs/pack/07-security-child-ai-safety-spec.md` §4. It is a **published
retention window on a child's raw capture** — photographs of handwriting and
recordings of a child's voice — and the file header calls it the shortest window
in the product on purpose. This is a stated promise, not housekeeping.

What is actually true right now:

- **Media retention sweep: last successful run — none on record.** The four
  jobs in `jobs.job` for `retention.sweep.media` (2026-09-18 through 2026-09-21)
  are all `failed`, and all four are sitting in `retention.sweep.media.dlq`
  awaiting manual replay. There is no `completed` row for this queue at any
  point in the table. Uploaded media older than 7 days has therefore **not been
  deleted from Bunny Storage or Bunny Stream for at least 4 days, and possibly
  since the sweep first went live.**
- **Transcript retention sweep: healthy.** All four
  `retention.sweep.transcripts` jobs completed, the last at 2026-09-21T04:56Z.
  Its 30-day window is being kept. It has not run since 2026-09-22 only because
  the pg-boss failure now blocks the enqueue.
- **No learner-facing surface is degraded.** Nothing a child or guardian sees
  depends on the drain.
- **The safety fan-out queues are empty**, so no guardian alert is stuck. That
  is luck rather than design: `safety.alert.guardian` and
  `safety.review.enqueue` go through the same `enqueue()` that is now throwing,
  so an incident raised today would fail to queue.

Do not overstate the first bullet: nothing indicates a breach of a *regulatory*
deadline, and the affected objects are within a product commitment rather than a
contractual one. But it is a promise the product makes in writing about a
child's photograph, and it has not been kept for four days.

---

## Timeline (UTC)

| When | What |
|---|---|
| 2026-08-27 | `jobs` schema installed at pg-boss v38; `queue_stats` partitions created for 08-27 and 08-28. |
| 2026-09-17T21:02 | PR #34 deploys, opening `/api/jobs`, `/api/health`, and the two sweep crons in `apps/web/proxy.ts`. Before this the machine routes 401'd. |
| 2026-09-18T03:32 | First `retention.sweep.media` job ever enqueued. Fails. |
| 2026-09-18T13:58 | That job exhausts its ladder and dead-letters. Repeats daily through 09-21. |
| 2026-09-21T20:02 | Last successful drain. Response body shows `retention.sweep.media` `fetched:1 completed:0 failed:1`, `deadLetters:[]`. |
| 2026-09-21T22:36, 22:46 | Production is redeployed twice from `8b2ae90` on `codex/homework-scanner-audit-2026-09-21` — a different branch from `main`, already pinning `pg-boss: 12.33.0`. Production has stayed on that branch since. |
| 2026-09-21T23:24 | First drain 500. Seven consecutive failures follow, through 2026-09-22T23:03. |
| 2026-09-22T03:00, 04:00 | Vercel sweep crons fire. Neither enqueues; `jobs.job` has no row created after 2026-09-21T03:32. |

---

## Root cause 1 — `/api/jobs/drain` 500

`packages/jobs/src/boss.ts` constructs pg-boss with `migrate: false` and
`createSchema: false`. That is a deliberate, well-argued decision: the file
header explains that a Vercel function racing DDL against the request that woke
it, on the database a child is being tutored through, is worse than a lambda
that cannot alter a schema at all. The schema is installed out of band.

The cost of that decision is that the client and the database must agree on a
version number, and nothing enforced the agreement.

In pg-boss, `migrate: false` routes `start()` to `Contractor.check()`
(`node_modules/pg-boss/dist/contractor.js`):

```js
async check() {
    const installed = await this.isInstalled();
    if (!installed) throw new Error('pg-boss is not installed');
    const version = await this.schemaVersion();
    if (schemaVersion !== version) throw new Error('pg-boss database requires migrations');
}
```

Note `!==`, not `>`. Any disagreement throws.

**Evidence**

- Schema numbers, read from the npm registry: `npm view pg-boss@12.28.0 pgboss`
  → `{ schema: 38 }`; `npm view pg-boss@12.33.0 pgboss` → `{ schema: 42 }`. The
  38 also matches the `pg-boss` copy installed in this worktree
  (`node_modules/pg-boss/package.json`).
- `select * from jobs.version` on `bhuvtvkvfjhcherprvod` → `38`.
- `git show 59f34af:pnpm-workspace.yaml | grep pg-boss` → `pg-boss: 12.28.0`;
  `git show 8b2ae90:pnpm-workspace.yaml | grep pg-boss` → `pg-boss: 12.33.0`.
- `git log -S "pg-boss: 12." -- pnpm-workspace.yaml` on `main` → one commit,
  2026-08-27. The pin on `main` has not moved. The version change reached
  production by a change of branch, not by a commit.
- `git diff --stat 59f34af 8b2ae90 -- packages/jobs packages/payload/migrations`
  → no change to the job runner and no new migration on that branch either.
- Vercel: production deployment `dpl_H9N6L8ZZypnhdetY8baMk893M4Qp`, created
  2026-09-21T22:46:57Z, `githubCommitSha: 8b2ae90`,
  `githubCommitRef: codex/homework-scanner-audit-2026-09-21`. The one before it
  was `59f34af` on `main` from 2026-09-17T21:02Z. The deploy time sits between
  the last drain success (20:02) and the first failure (23:24).

`getBoss()` throws, so `drainQueues` never reaches its body, `boss.supervise()`
never runs, and the route's `catch` returns
`{"ok":false,"error":"pg-boss database requires migrations"}` with status 500 —
the exact sentence that would have ended this investigation in one minute, sent
over the wire on every one of the seven failed runs and discarded by `curl -f`
each time.

**A note on the partition evidence.** `jobs.queue_stats` having no partition
newer than 2026-08-28 is *not* caused by this. It predates the deployment by
three weeks, through a period when the drain was succeeding. `boss.supervise()`
is called inside a `try/catch` in `drainQueues` that reports to
`reporter.maintenance` and deliberately does not rethrow — correctly, since
housekeeping should not block a child's queued work. But the report goes to
`Sentry.captureException` with no DSN. So pg-boss maintenance has been failing
silently for weeks and we still do not know why. **Tracked separately; not
closed by this incident.**

### Remedy — two options, both needing a decision this branch cannot make

Changing the pin on `main` does nothing while production is served from
`codex/homework-scanner-audit-2026-09-21`. Someone with the authority to move
production has to choose:

**(a) Migrate the database 38 → 42.** `packages/payload/migrations/jobs_pgboss_schema_38_to_42.sql`
is checked in on this branch, generated from pg-boss 12.33.0's own
`migrationStore.migrate('jobs', 38)` rather than hand-written. It has **not been
run**. Cost: it is a forward-only schema change on the live jobs store, it
rewrites `jobs.create_queue`, adds columns to `jobs.version`, `jobs.queue` and
`jobs.schedule`, and ends with two `CREATE/DROP INDEX CONCURRENTLY` statements
that must run outside the transaction. It also pins the database to 12.33.0,
so any deployment still pinning 12.28.0 — including everything built from
`main` — will then fail the same assertion in the other direction. `!==`, not
`>`.

**(b) Put production back on a build that pins 12.28.0.** Cost: it reverts
whatever else that branch was deployed for, and the same break returns the next
time it ships.

Neither is free and neither is mine to pick. What this branch does do is make
the choice visible: `PGBOSS_SCHEMA_VERSION` in `packages/jobs/src/boss.ts`
records the version the checked-in schema is at, and `jobs.test.ts` asserts the
installed pg-boss agrees with it. Bumping the pin now fails the test suite
instead of production.

---

## Root cause 2 — `/api/media/sweep` 500

**Stated plainly: I could not identify which of two defects fired, because the
system never recorded the message.** That is the finding, not a gap in the
investigation. Every place the answer passed through threw it away:

- All eight `jobs.job` rows — the four `failed` and the four in the DLQ — carry
  `output = {"message": "/api/media/sweep returned 500"}` and nothing else.
  That string is built by `callSweep`, which read `response.status` and
  discarded the body the route had just put the message in.
- `reportRouteError` calls `Sentry.captureException`. The `moyo-app` production
  environment has no `SENTRY_*` variable of any kind, so it is a no-op.
- Vercel runtime logs for 2026-09-18 → 09-21 are past this plan's retention;
  the API answers `ExceedsBillingLimitError` for that window.
- I did not decrypt the production `BUNNY_MEDIA_PREFIX` to settle it, and
  deliberately so — an incident is a bad reason to start reading secrets.

What the failure signature does tell us: it is **deterministic**, not
transient. Sixteen attempts across four days, every one failing, starting with
the very first run the sweep ever had (the route only became reachable when
PR #34 opened the session gate on 2026-09-17). Bunny was not flapping. And it
is specific to the media half — the transcript sweep, which touches only
Postgres, completed all four days. So the fault is in the Bunny path and is
configuration- or code-shaped.

Reading that path found two defects, either of which produces exactly this
signature. Both are fixed; both were real regardless of which one fired.

**(a) The recursive listing corrupted its own paths.** `listRecursive` built a
child prefix as `` `${prefix}/${folder.name}` ``, and `listFolder` normalised
only LEADING and TRAILING slashes. `.env.example` ships
`BUNNY_MEDIA_PREFIX=moyolearn/` — with the trailing slash — so the first
recursion produced `moyolearn//<folder>`, which is a different object path.
Bunny answers non-2xx, `listFolder` threw, the sweep 500'd. The same variable is
read in four places and `payload.config.ts` strips the trailing slash before
use; the sweep route was the one reader that did not. This only fires once the
prefix contains a subfolder, which is why no test caught it and why it could
only appear against production-shaped data.

**(b) An empty folder read as a broken sweep.** `listFolder` threw on any
non-2xx, and Bunny returns 404 for a prefix holding no objects. The storage zone
is **shared with sosinspires-mono** (`.env.example`), so Moyo's prefix only
exists once Moyo has written under it — and `payload.media` has zero rows in
production. "There is nothing to delete" and "the retention sweep is broken"
were the same response.

A third defect was found while fixing those, on the same line, and is worth more
than either: **an empty prefix would have swept the shared zone root.** `??`
catches only `undefined`, so `BUNNY_MEDIA_PREFIX=` would leave the prefix empty,
and an empty prefix lists the whole zone — a delete-by-age pass over another
product's files. That now refuses rather than defaulting.

The fixes make the next failure self-reporting: `callSweep` carries the sweep's
own `error` message into the thrown error and therefore into `jobs.job.output`,
and both Bunny list helpers include the response body (`{"HttpCode":401,
"Message":"Unauthorized"}`) rather than a bare status. If the media sweep fails
again, the dead letter will say why.

---

## What made it invisible

1. `curl -fsS` in `.github/workflows/jobs-drain.yml`. `-f` suppresses the body
   on a non-2xx and returns exit 22. The step comment claims "printing it leaks
   nothing" — which is true, and is exactly why it is worth printing. The
   command never printed it on the failure path.
2. `callSweep` in `apps/web/lib/jobs.ts` throws
   `` `${path} returned ${response.status}` `` and discards `response.json()`.
   That string is what landed in `jobs.job.output` on all eight rows. Four days
   of dead letters that say a route failed and cannot say why.
3. No `SENTRY_*` variable exists in the `moyo-app` production environment. Every
   `reportRouteError` call, every JOB-3 dead-letter alert, every
   `reporter.maintenance` report, and the `Sentry.withMonitor('retention-sweep')`
   check-in are no-ops in production. The alerting design in
   `docs/pack/35-sentry-free-tier.md` is not wired up.
4. JOB-3 would not have fired anyway. `deadLetterAlertThreshold` returns 10 for
   a non-safety band, and the media DLQ reached 4.
5. **The architecture checks never run in CI.** `.github/workflows/ci.yml` runs
   `pnpm exec turbo run build typecheck lint test --continue`, which invokes
   turbo directly and so skips the ROOT package's `lint` script — and that root
   script is where all 21 checkers live, including `check-machine-routes` and
   `check-sentry-invariants`. They fire only when a human types `pnpm lint`.
   Same shape as the three dead error paths above: a control that reports
   nothing because it never runs.

### The dead-man switch: would it have caught this?

**No, and then yes sixteen hours late.** Both existing detectors read the job
TABLES, and both read healthy when the tables are empty:

- `oldestReadyAt` asks "is due work sitting unfetched?" After 2026-09-21T23:24
  nothing was enqueued either, because `enqueue()` goes through the same
  `getBoss()` that was throwing. No ready work could accumulate, so the detector
  saw nothing wrong.
- `lastCompletedAt` only applies to the two `scheduled` queues. The four
  `event` queues — `edu.distill`, `summary.generate` and both safety fan-outs —
  carry only the ready-age rule, so a total producer-and-consumer outage reads
  as a quiet, healthy queue on all four, indefinitely.
- That leaves `retention.sweep.transcripts`, whose last success was
  2026-09-21T04:56Z against a 26h threshold. It went stale at ~2026-09-22T06:56Z
  — about sixteen hours after the runner died.

`retention.sweep.media` was separately red the whole time ("no recorded
success"), so the endpoint would have been answering 500 since 2026-09-18 for
the *other* incident. Which is the second half of the verdict: **nothing polls
it.** Doc 35 §5 spends "the one free Sentry uptime monitor" on this route, and
there is no Sentry DSN in the production environment, so there is no monitor.
The route has been correctly shouting into an empty room.

Fixed here by giving the switch a detector for the failure that actually
happened: `JobsHealthReport.runner` reads `jobs.version` through the pool that is
already open and compares it against the version this build requires — the same
comparison `Contractor.check()` makes, without starting pg-boss and without an
unauthenticated endpoint writing to `jobs.queue` on every poll. It answers on the
first poll instead of the sixteenth hour. Wiring an actual monitor to it remains
open and is not something this branch can do.

---

## Action items

Shipped on `fix/jobs-drain-retention`:

| | |
|---|---|
| `packages/payload/migrations/jobs_pgboss_schema_38_to_42.sql` | The 38 → 42 migration, generated from pg-boss 12.33.0's own planner. **Written, not run.** |
| `packages/jobs/src/boss.ts` | `PGBOSS_SCHEMA_VERSION`; rewrites pg-boss's `requires migrations` into a message naming where to read both numbers. |
| `packages/jobs/src/health.ts` | The `runner` detector — the dead-man switch's missing eye. |
| `apps/web/lib/jobs-health.repository.ts` | `readRunnerSample()`, read-only, on the existing pool. |
| `apps/web/app/api/health/jobs/route.ts` | Reports `runner` and fails on it. |
| `apps/web/lib/jobs.ts` | `callSweep` carries the sweep's own error into `jobs.job.output`. |
| `apps/web/lib/bunny-list.ts` | Interior-slash normalisation; 404 is an empty folder; response body in the error. |
| `apps/web/lib/bunny-stream-sign.ts` | Response body in the Stream list error. |
| `apps/web/app/api/media/sweep/route.ts` | Normalises the prefix; refuses an empty one. |
| `.github/workflows/jobs-drain.yml` | Prints body and status; fails on non-2xx without `-f`. |
| `packages/jobs/src/jobs.test.ts`, `health.test.ts` | 5 new tests; 31 pass in the package. |

Open, needing someone with authority this branch does not have:

1. **Decide between migrating the database and reverting production's branch**
   (see Remedy above). Until then the job runner is down: no retention sweeps,
   and no safety fan-out either if an incident is raised.
2. **Replay the four dead-lettered media sweeps** once the sweep is fixed and
   deployed. §4.1 says replay is manual, by a human, per job.
3. **Wire a monitor to `/api/health/jobs`.** It has been returning 500 since
   2026-09-18 and nothing was listening.
4. **Decide whether Sentry is real.** Four alerting paths and one cron monitor
   are no-ops in production. Either configure a DSN or delete the paths — a
   reporter nobody reads is worse than a `console.error`.
5. **Make CI run the root `lint`.** See item 5 above.
6. **Find out why `boss.supervise()` has been failing since 2026-08-28.**
   Separate from this incident; now legible, since the drain reports it and the
   reporter will have somewhere to report to.
7. **Decide whether production should ever deploy from a non-`main` branch.**
   Four days of divergence is how a dependency bump reached production without
   passing over `main`.
