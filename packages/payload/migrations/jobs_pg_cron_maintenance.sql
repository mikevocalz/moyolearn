-- pg_cron maintenance for the jobs store — doc 35 §5 / PR-135, the half of
-- "drain off Vercel cron" that lives IN the database. Applied to project
-- bhuvtvkvfjhcherprvod via the Supabase MCP `apply_migration`
-- (`jobs_pg_cron_maintenance`, 2026-08-27); this file is the mirror, same
-- arrangement as `jobs_schema.sql`.
--
-- THE HONEST SPLIT, WRITTEN DOWN (doc 35 §5 asked for pg_cron "preferred", and
-- this is exactly how much of the drain pg_cron can honestly take):
--
--   pg_cron CAN     run pg-boss MAINTENANCE — retention deletes over pg-boss's
--                   own tables are pure SQL against the same Postgres. Before
--                   this migration that pass only ran when an HTTP drain
--                   happened to run with `supervise: true`, so a dead drain
--                   also meant a jobs table that only grew. Now the store stays
--                   bounded with no HTTP tick at all.
--   pg_cron CANNOT  run the HANDLERS. They are Node functions in the Next.js
--                   deployment (`apps/web/lib/jobs.ts`) — the sweeps call
--                   route handlers, distillation calls the inference gateway.
--                   No SQL statement can execute them, and pretending otherwise
--                   (pg_net calling the drain route from inside Postgres) would
--                   put an HTTP client, a secret, and a retry policy inside the
--                   database for no gain over a scheduler that already exists.
--
--   Handler execution therefore stays in Node, on three legs:
--     1. the on-request `after()` drains (tutor evaluate/session routes) — the
--        low-latency path for work a request just enqueued;
--     2. the two DAILY Vercel crons (media + retention sweep), which fit the
--        Hobby tier and each enqueue AND drain their own queue in-window;
--     3. `.github/workflows/jobs-drain.yml` — the */30 retry tick, hitting the
--        bearer-auth POST /api/jobs/drain (GitHub Actions schedule, free,
--        ~5-min floor, best-effort timing — which is fine for a RETRY path
--        whose latency floor was already the schedule).
--   `/api/health/jobs` (the Sentry uptime dead-man switch) then verifies the
--   whole arrangement: if every leg dies, the endpoint goes 500 on ready-work
--   age and sweep staleness, and the monitor pages — doc 35 §5's "the dead-man
--   switch verifies whichever you choose is actually alive".
--
-- WHAT IS DELIBERATELY NOT MIRRORED FROM pg-boss SUPERVISION: queue_stats
-- partition create/drop and per-queue count monitoring. Both only matter while
-- drains run (the drain is what inserts stats), so they stay with
-- `supervise: true` in the drain rather than being transcribed here — a
-- transcription of generated SQL is a copy that is one release behind on the
-- day it matters, and the retention DELETE below is small enough to keep
-- verbatim-verifiable against the installed pg-boss.
--
-- UPGRADES: on a pg-boss bump, re-diff the two DELETE predicates against
-- `node_modules/pg-boss/dist/plans.js` (`deletion`, `deleteOldWarnings`) and
-- re-apply if they changed.
-- SOT: docs/pack/35-sentry-free-tier.md §5 · packages/jobs/src/boss.ts · node_modules/pg-boss/dist/plans.js (12.28.0)
-- SOT-KEYWORDS: pg_cron jobs maintenance retention deletion pg-boss supabase drain vercel hobby github actions honest split

create extension if not exists pg_cron;

-- Job retention — mirror of pg-boss 12.28.0 `plans.deletion` (dist/plans.js),
-- run against the partitioned parent `jobs.job` so every queue's partition is
-- covered, with the per-queue name filter dropped (the union over all queues,
-- DLQs included, is the same set). The predicate is pg-boss's own, verbatim:
-- completed jobs past their deletion window, and never-started jobs past
-- `keep_until` (which is how the topology's 30-day DLQ retention is expressed).
select cron.schedule(
  'pgboss-job-retention',
  '17 * * * *',
  $cronjob$
    DELETE FROM jobs.job
    WHERE (deletion_seconds > 0 AND completed_on + deletion_seconds * interval '1s' < now())
       OR (state < 'active' AND keep_until < now())
  $cronjob$
);

-- Warning retention — mirror of pg-boss 12.28.0 `plans.deleteOldWarnings` at
-- the SDK's default 30-day window.
select cron.schedule(
  'pgboss-warning-retention',
  '29 3 * * *',
  $cronjob$
    DELETE FROM jobs.warning
    WHERE created_on < now() - interval '30 days'
  $cronjob$
);
