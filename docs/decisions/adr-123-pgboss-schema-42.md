# ADR-123 — Take the pg-boss schema to 42, and take `main` with it

**Date:** 2026-09-22 · **Status:** decided, migration not yet applied
**Decides:** the option pair left open by `docs/incidents/2026-09-22-jobs-drain-outage.md`

## Context

Production has been serving `8b2ae90` since 2026-09-21T22:46:57Z. That build pins
`pg-boss: 12.33.0`, which declares schema 42; the `jobs` schema is at 38;
`packages/jobs/src/boss.ts` runs with `migrate: false`, so `Contractor.check()`
asserts equality and throws. The throw takes `enqueue()` down with the drain, so
the daily retention sweeps have not run and have not been queued.

Two remedies were on the table, and both were written up as expensive:

- **(a)** apply the 38 → 42 migration — rejected as a one-way door, because
  afterwards any build pinning 12.28.0, which is all of `main`, refuses to start.
- **(b)** put production back on a 12.28.0 build — i.e. deploy `main`.

## Decision

**Apply the migration, and move `main`'s pin to 12.33.0 in the same change.**

The one-way door was an artefact of holding `main` at 12.28.0, and that pin is one
line under our control. Converging both lineages on 12.33.0 means the database at
42 is the version *every* deployable branch wants, and nothing is stranded.

## Why (a) is not the door it looked like

`packages/jobs/` is **byte-identical** between `origin/main` and `8b2ae90` —
`git diff --stat origin/main...8b2ae90 -- packages/jobs/` is empty. The lineages
differ by the catalog entry and nothing else. Every pg-boss method the package
calls — `complete`, `createQueue`, `fail`, `getQueues`, `send`, `stop`,
`supervise`, `updateQueue`, `work` — is present in 12.33.0's type definitions.

Proven rather than argued: with the pin at 12.33.0 and `PGBOSS_SCHEMA_VERSION` at
42, the full gate on the `main` lineage is green from a cold cache — build 5/5,
lint 19/19 plus all 21 invariant checkers, typecheck 19/19, **1,466 tests, 0
failures**, including the schema guard that fails on the unconverged branch.

The migration itself is additive. Seventeen statements: five
`ADD COLUMN IF NOT EXISTS` (nullable, or `NOT NULL DEFAULT` which Postgres 11+
does without a rewrite), one `ALTER COLUMN ... SET DEFAULT`, four backfill
`UPDATE`s, two `INSERT`s into `jobs.queue`, three `CREATE OR REPLACE FUNCTION`,
and an index swap that creates the replacement `CONCURRENTLY` before dropping the
old one. **No `DROP TABLE`, no `DROP COLUMN`, no `DELETE`, no `TRUNCATE`.** Every
statement is `IF [NOT] EXISTS`, so a mid-way failure is recovered by re-running.

Scale: the whole `jobs` schema is well under a megabyte — 12 job rows, 12
queues, 0 schedules, 0 `queue_stats` rows. ACCESS EXCLUSIVE is taken only on
`version` (1 row), `queue` (12) and `schedule` (0), and none of those rewrites.
`jobs.job` and `job_common` never take it at all; the only statements touching
them are the two `CONCURRENTLY` operations after `COMMIT`. Sub-second, bounded
by the file's own `lock_timeout = 30000`.

The `CONCURRENTLY` statements mean the file cannot run in a single transaction.
That has two consequences which are NOT covered by idempotency, and they are set
out under Corrections below — the pooler cannot run them at all, and an
interrupted index build leaves an INVALID index that `IF NOT EXISTS` will skip
on a re-run.

## Why (b) is rejected

`main` cannot be deployed as it stands. `packages/ui/html/dom.web.tsx` on `main`
object-spreads a styleq array into `toDom`, which makes React DOM throw
"Indexed property setter is not supported" and kills hydration on every page
carrying a kit button. `8b2ae90` already carries the fix; `main` has never shipped
it. Beyond that, (b) gives up 102 commits of product work to solve a problem that
a one-line pin solves.

The fear that made (b) look necessary — that production had been writing
1.7.5-shaped `better_auth.account` rows — is **refuted**. The live table carries
`issuer text NOT NULL`, which is 1.7.2's generated shape, all 37 account rows are
`credential` provider from 2026-09-02/03, and none has a blank `issuer`. Nothing
has been written to `better_auth` since 2026-09-03, so there is no 1.7.5-shaped
data to regress.

## What this does not decide

The deployed lockfile does resolve a second `@better-auth/core` at **1.7.5**
alongside 1.7.2, pulled by `@better-auth/expo` and `@better-auth/stripe`. The
catalog comment records why that matters: 1.7.5 stopped writing `account."issuer"`,
which is `NOT NULL` with no default here, so an account insert through that copy
would fail. It has not bitten because the insert path goes through `better-auth` →
core 1.7.2, and because no account has been created since 2026-09-03.
`upgrade/expo-sdk-58-preview5` pins it back to a single 1.7.2. That is an argument
for moving production **forward** onto that branch, not back to `main`, and it is
tracked separately.

## Corrections from the statement-level analysis

Three things the first reading got wrong, all recorded in
`docs/decisions/2026-09-22-pgboss-migration-analysis.md` on the
`fix/jobs-drain-on-deployed` branch.

**There is a reverse path.** `Contractor.rollbackPlans()` (`contractor.js:39`)
returns a populated `uninstall` chain for every migration 39 through 42, so the
schema can be walked back newest-first. Every dependency it needs exists in
production. That makes the decision safer than it was taken on — the argument
above only needed the door to stop mattering, and it turns out the door opens
both ways. Caveats on the reverse: the `job_i5` rebuild is not `CONCURRENTLY`,
and the recreated index gets a new OID.

**The partition worry was backwards.** The migration never names `queue_stats`.
`jobs.job_now()` — which `ensureQueueStatsPartitions` and `insertQueueStats`
both depend on — is *created by this migration* and does not exist in production
today (verified: `MISSING`). The migration is a prerequisite for that code, not
a consumer of it. And `persistQueueStats` is never defaulted in `attorney.js`
and is not set in `boss.ts`, so both paths are skipped anyway. The
`queue_stats_20260827`/`20260828` partitions came from the original install
plan, are inert, and are **not** the cause of the separately-tracked
`supervise()` failures.

**It must not be run over the pooler.** The connection string to hand is port
**6543** — Supabase's transaction-mode pooler — and `CREATE INDEX CONCURRENTLY`
cannot run under one. This needs a session-mode connection (port 5432) or it
fails at statement 20.

## Runbook

1. Connect **session-mode**, port 5432, not the 6543 pooler.
2. Run the file without `-v ON_ERROR_STOP=1`. That flag looks prudent and is
   the wrong choice here: on a re-run after an interruption between `COMMIT`
   and the index work, it aborts at the version guard and never reaches
   statements 20–21, so the index swap is silently skipped.
3. Afterwards, check for an invalid index — an interrupted
   `CREATE INDEX CONCURRENTLY` leaves one behind, and `IF NOT EXISTS` will not
   rebuild it:
   ```sql
   SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'jobs' AND NOT i.indisvalid;
   ```
4. Confirm `select version from jobs.version` reads 42, then deploy the
   converged build.

## Consequences

- The `jobs` schema goes to 42. It CAN be returned to 38 via pg-boss's own
  `rollbackPlans()` uninstall chain, so this is reversible rather than one-way.
- `main` and the deployed lineage both want 42, so neither is stranded.
- `PGBOSS_SCHEMA_VERSION` moves in the same commit as the pin, which is the order
  `boss.ts` documents: generate, check in, apply, then move the number. The guard
  test in `jobs.test.ts` is what stops the two drifting apart again.
- `fix/jobs-drain-retention` (PR #38) still pins 12.28.0 and needs this same
  convergence before it can ship alongside the migration.
- The migration must be applied **before** the converged build deploys. Deploying
  first reproduces the outage with the assertion pointing the other way.
