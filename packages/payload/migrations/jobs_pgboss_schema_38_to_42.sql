-- pg-boss schema 38 → 42, for the catalog bump that is ALREADY LIVE in
-- production. NOT YET APPLIED. See docs/incidents/2026-09-22-jobs-drain-outage.md.
--
-- WHY THIS FILE EXISTS. `packages/jobs/src/boss.ts` constructs pg-boss with
-- `migrate: false`, deliberately — a Vercel function racing DDL against the
-- request that woke it, on the database a child is being tutored through, is
-- worse than a lambda that cannot alter a schema at all. The cost of that
-- decision is that the client and the database must AGREE on a version number,
-- and pg-boss asserts equality rather than a floor:
--
--     if (schemaVersion !== version) throw new Error('pg-boss database requires migrations')
--       — node_modules/pg-boss/dist/contractor.js, check()
--
-- On 2026-09-21T22:46Z production moved off `main` onto a branch pinning
-- pg-boss 12.33.0. 12.28.0 declares schema 38 and 12.33.0 declares 42 (read
-- from the registry: `npm view pg-boss@<v> pgboss`); `jobs.version` is at 38.
-- Every `getBoss()` since has thrown, which took BOTH the drain and every
-- `enqueue()` with it — the daily retention sweeps have not run and have not
-- even been queued.
--
-- GENERATED, NOT TRANSCRIBED. The body below is the verbatim output of
-- pg-boss 12.33.0's own migration planner:
--
--     migrate('jobs', 38, undefined, undefined, { inlineAsync: true, partitionTables: [] })
--       — dist/migrationStore.js, the same function `Contractor.migrationPlans` calls
--
-- `partitionTables: []` is correct HERE and would not be correct everywhere:
-- every queue in `topology.ts` is created with `partition: false`, so this
-- database has exactly one job partition, the DEFAULT `jobs.job_common`, which
-- the planner always targets on its own. Verified against production:
-- `select relname from pg_class where relispartition` returns `job_common` plus
-- the two `queue_stats_*` partitions and nothing else.
--
-- HOW TO RUN IT. Line 1 of the body is pg-boss's own guard —
-- `version::int/(version::int-42)` divides by zero and aborts the transaction
-- if the schema is already at 42, so a second run is refused rather than
-- half-applied. The two `CONCURRENTLY` statements at the end are AFTER the
-- COMMIT on purpose and cannot run inside a transaction; send the file with a
-- client that does not wrap it in one (`psql -f`, not `psql -c`).
--
-- THIS IS A ONE-WAY DOOR. After it lands, a deployment pinning 12.28.0 fails
-- the same assertion in the other direction, because the comparison is `!==`
-- and not `>`. Do not apply it until production and `main` agree on 12.33.0.
-- SOT: packages/jobs/src/boss.ts · docs/incidents/2026-09-22-jobs-drain-outage.md · node_modules/pg-boss/dist/migrationStore.js
-- SOT-KEYWORDS: pg-boss schema version migration 38 42 migrate false requires migrations jobs drain outage catalog pin


    BEGIN;
    SET LOCAL lock_timeout = 30000;
    SET LOCAL idle_in_transaction_session_timeout = 30000;
    SELECT pg_advisory_xact_lock(('x' || encode(sha224((current_database() || '.pgboss.jobs')::bytea), 'hex'))::bit(64)::bigint);
SELECT version::int/(version::int-42) from jobs.version;
ALTER TABLE jobs.version ADD COLUMN IF NOT EXISTS reindex_on timestamp with time zone;
ALTER TABLE jobs.version ADD COLUMN IF NOT EXISTS monitor_backoff_on timestamp with time zone;
ALTER TABLE jobs.queue ADD COLUMN IF NOT EXISTS monitor_claim_on timestamp with time zone;
UPDATE jobs.queue SET monitor_claim_on = monitor_on WHERE monitor_claim_on IS NULL;

    CREATE OR REPLACE FUNCTION jobs.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE 'job_common'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO jobs.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name,
          heartbeat_seconds,
          notify
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, 2),
          COALESCE((options->>'retryDelay')::int, 0),
          COALESCE((options->>'retryBackoff')::bool, false),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, 900),
          COALESCE((options->>'retentionSeconds')::int, 1209600),
          COALESCE((options->>'deleteAfterSeconds')::int, 604800),
          COALESCE((options->>'warningQueueSize')::int, 0),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, false),
          tablename,
          (options->>'heartbeatSeconds')::int,
          COALESCE((options->>'notify')::bool, false)
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE jobs.%I (LIKE jobs.job INCLUDING DEFAULTS)', tablename);

      EXECUTE jobs.job_table_format($cmd$ALTER TABLE jobs.job ADD PRIMARY KEY (name, id)$cmd$, tablename);
      EXECUTE jobs.job_table_format($cmd$ALTER TABLE jobs.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES jobs.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);
      EXECUTE jobs.job_table_format($cmd$ALTER TABLE jobs.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES jobs.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);

      EXECUTE jobs.job_table_format($cmd$CREATE INDEX job_i11 ON jobs.job (name, priority DESC, created_on, start_after) WHERE state < 'active' AND NOT blocked$cmd$, tablename);
      EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i4 ON jobs.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL$cmd$, tablename);
      EXECUTE jobs.job_table_format($cmd$CREATE INDEX job_i7 ON jobs.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL$cmd$, tablename);
      EXECUTE jobs.job_table_format($cmd$CREATE INDEX job_i9 ON jobs.job (name, id) WHERE blocking AND state = 'completed'$cmd$, tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i1 ON jobs.job (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short'$cmd$, tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i2 ON jobs.job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'$cmd$, tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i3 ON jobs.job (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately'$cmd$, tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i6 ON jobs.job (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'$cmd$, tablename);
      ELSIF options->>'policy' = 'key_strict_fifo' THEN
        EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i8 ON jobs.job (name, singleton_key) WHERE state IN ('active', 'retry', 'failed') AND policy = 'key_strict_fifo'$cmd$, tablename);
        EXECUTE jobs.job_table_format($cmd$CREATE INDEX job_i10 ON jobs.job (name, singleton_key, state DESC, created_on, id) INCLUDE (start_after) WHERE state < 'active' AND NOT blocked AND policy = 'key_strict_fifo'$cmd$, tablename);
        EXECUTE jobs.job_table_format($cmd$ALTER TABLE jobs.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = 'key_strict_fifo' AND singleton_key IS NULL))$cmd$, tablename);
      END IF;

      EXECUTE format('ALTER TABLE jobs.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE jobs.job ATTACH PARTITION jobs.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;
  ;
ALTER TABLE jobs.schedule ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'cron' CHECK (kind IN ('cron', 'rrule'));
UPDATE jobs.schedule SET kind = 'rrule'
              WHERE kind = 'cron'
                AND (cron ~* '(^|[[:space:]]|;)FREQ=' OR cron ~* '(^|[[:space:]])(DTSTART|RRULE|RDATE|EXDATE)[;:]');
UPDATE jobs.schedule SET timezone = 'UTC' WHERE timezone IS NULL;
ALTER TABLE jobs.schedule ALTER COLUMN timezone SET DEFAULT 'UTC';
ALTER TABLE jobs.schedule ADD COLUMN IF NOT EXISTS last_job_id uuid;
CREATE OR REPLACE FUNCTION jobs.job_now()
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
AS $function$
      SELECT pg_catalog.now();
    $function$
;

    CREATE OR REPLACE FUNCTION jobs.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
    tablename varchar := CASE WHEN options->>'partition' = 'true'
    THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
    ELSE 'job_common'
    END;
    queue_created_on timestamptz;
    BEGIN

    WITH q as (
    INSERT INTO jobs.queue (
    name,
    policy,
    retry_limit,
    retry_delay,
    retry_backoff,
    retry_delay_max,
    expire_seconds,
    retention_seconds,
    deletion_seconds,
    warning_queued,
    dead_letter,
    partition,
    table_name,
    heartbeat_seconds,
    notify,
    created_on,
    updated_on
    )
    VALUES (
    queue_name,
    options->>'policy',
    COALESCE((options->>'retryLimit')::int, 2),
    COALESCE((options->>'retryDelay')::int, 0),
    COALESCE((options->>'retryBackoff')::bool, false),
    (options->>'retryDelayMax')::int,
    COALESCE((options->>'expireInSeconds')::int, 900),
    COALESCE((options->>'retentionSeconds')::int, 1209600),
    COALESCE((options->>'deleteAfterSeconds')::int, 604800),
    COALESCE((options->>'warningQueueSize')::int, 0),
    options->>'deadLetter',
    COALESCE((options->>'partition')::bool, false),
    tablename,
    (options->>'heartbeatSeconds')::int,
    COALESCE((options->>'notify')::bool, false),
    jobs.job_now(),
    jobs.job_now()
    )
    ON CONFLICT DO NOTHING
    RETURNING created_on
    )
    SELECT created_on into queue_created_on from q;

    IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
    RETURN;
    END IF;

    EXECUTE format('CREATE TABLE jobs.%I (LIKE jobs.job INCLUDING DEFAULTS)', tablename);

    EXECUTE jobs.job_table_format($cmd$ALTER TABLE jobs.job ADD PRIMARY KEY (name, id)$cmd$, tablename);
    EXECUTE jobs.job_table_format($cmd$ALTER TABLE jobs.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES jobs.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);
    EXECUTE jobs.job_table_format($cmd$ALTER TABLE jobs.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES jobs.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);

    EXECUTE jobs.job_table_format($cmd$CREATE INDEX job_i11 ON jobs.job (name, priority DESC, created_on, start_after) WHERE state < 'active' AND NOT blocked$cmd$, tablename);
    EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i4 ON jobs.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL$cmd$, tablename);
    EXECUTE jobs.job_table_format($cmd$CREATE INDEX job_i7 ON jobs.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL$cmd$, tablename);
    EXECUTE jobs.job_table_format($cmd$CREATE INDEX job_i9 ON jobs.job (name, id) WHERE blocking AND state = 'completed'$cmd$, tablename);

    IF options->>'policy' = 'short' THEN
    EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i1 ON jobs.job (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short'$cmd$, tablename);
    ELSIF options->>'policy' = 'singleton' THEN
    EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i2 ON jobs.job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'$cmd$, tablename);
    ELSIF options->>'policy' = 'stately' THEN
    EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i3 ON jobs.job (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately'$cmd$, tablename);
    ELSIF options->>'policy' = 'exclusive' THEN
    EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i6 ON jobs.job (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'$cmd$, tablename);
    ELSIF options->>'policy' = 'key_strict_fifo' THEN
    EXECUTE jobs.job_table_format($cmd$CREATE UNIQUE INDEX job_i8 ON jobs.job (name, singleton_key) WHERE state IN ('active', 'retry', 'failed') AND policy = 'key_strict_fifo'$cmd$, tablename);
    EXECUTE jobs.job_table_format($cmd$CREATE INDEX job_i10 ON jobs.job (name, singleton_key, state DESC, created_on, id) INCLUDE (start_after) WHERE state < 'active' AND NOT blocked AND policy = 'key_strict_fifo'$cmd$, tablename);
    EXECUTE jobs.job_table_format($cmd$ALTER TABLE jobs.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = 'key_strict_fifo' AND singleton_key IS NULL))$cmd$, tablename);
    END IF;

    EXECUTE format('ALTER TABLE jobs.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
    EXECUTE format('ALTER TABLE jobs.job ATTACH PARTITION jobs.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;
  ;
UPDATE jobs.version SET version = '42';
    COMMIT;
  
-- inlined from jobs.job_table_run_async (migration v40, command: fetch_index_priority_build)
CREATE INDEX CONCURRENTLY IF NOT EXISTS job_common_i11 ON jobs.job_common (name, priority DESC, created_on, start_after) WHERE state < 'active' AND NOT blocked;
-- inlined from jobs.job_table_run_async (migration v40, command: fetch_index_retire)
DROP INDEX CONCURRENTLY IF EXISTS jobs.job_common_i5;
