# pg-boss schema 38 → 42: is running it against production reversible?

**Subject:** `packages/payload/migrations/jobs_pgboss_schema_38_to_42.sql`
**Context:** `docs/incidents/2026-09-22-jobs-drain-outage.md`
**Analysed:** 2026-09-22, from `/Users/mikevocalz/moyo-onprod` on `fix/jobs-drain-on-deployed`.
**Method:** read-only. Every number below came from a `SELECT` or a catalog read against
production (`bhuvtvkvfjhcherprvod`, PostgreSQL 17.6, via the `pooler.supabase.com` URL).
No `INSERT`, `UPDATE`, `DELETE`, DDL, transaction probe or `EXPLAIN ANALYZE` was issued.

Sections keep the numbering of the seven questions asked but are ordered by how much they
bear on the decision: **2, 3, 1, 5, 4, 6, 7.**

---

## Verdict

**Running it is reversible, and nothing in it destroys data.** The migration adds four
nullable columns, backfills two of them, replaces two functions, sets a column default,
and stamps `jobs.version` to 42. It deletes no rows, truncates nothing, changes no column's
type, and rewrites no table. The single `DROP` in the file is
`DROP INDEX CONCURRENTLY IF EXISTS jobs.job_common_i5` — an index, not data, 16 kB over
12 rows, and pg-boss's own rollback plan recreates it with the identical definition. Against
measured sizes (the entire `jobs` schema is **424 kB**; `jobs.job_common` is **160 kB / 12
rows**; `jobs.schedule` is **0 rows**, so all three of its `UPDATE`s touch nothing) the
locks are held over empty or near-empty tables and the whole thing is a sub-second operation.
pg-boss 12.33.0 does ship a reverse path: `Contractor.rollbackPlans()` returns a complete
`uninstall` chain for 42→41→40→39→38, reproduced verbatim in §5, and every function and
column it depends on exists in production today. The only genuinely one-way part is the
16 kB `job_common_i5` index — reversible in content but not in physical identity, which is
a distinction without a difference for an index. **The thing that survives the migration is
not a data risk; it is the `jobs.version = 42` stamp, and that is a `UPDATE ... SET version`
away from being undone.** Given the coordinator's finding that the whole `main` lineage
passes its gate on 12.33.0, question 7's "one-way door" framing does not hold: no branch is
stranded that a one-line catalog edit cannot bring forward.

---

## 2. Is anything destructive?

**No.** Taking the three named categories in turn, each measured rather than reasoned about.

### Does it DROP any table, column, index or constraint currently holding data?

One `DROP`, and it is an index:

```sql
-- inlined from jobs.job_table_run_async (migration v40, command: fetch_index_retire)
DROP INDEX CONCURRENTLY IF EXISTS jobs.job_common_i5;
```

There is no `DROP TABLE`, no `DROP COLUMN`, and no `DROP CONSTRAINT` anywhere in the file.
Measured exposure of the one index:

| Fact | Value | Source |
|---|---|---|
| Index exists today | yes | `pg_indexes` |
| Size | 16 kB | `pg_relation_size` |
| Rows in the table it indexes | 12 | `select count(*) from jobs.job_common` |
| Lifetime scans | `idx_scan = 23`, `idx_tup_read = 28` | `pg_stat_user_indexes` |
| Definition | `CREATE INDEX job_common_i5 ON jobs.job_common USING btree (name, start_after) WHERE ((state < 'active'::jobs.job_state) AND (NOT blocked))` | `pg_indexes.indexdef` |

It is in use (23 scans), so this is not a dead index — but it is being *replaced*, not
removed. The statement immediately before it builds `job_common_i11`, whose leading column
and `WHERE` predicate are identical and whose key is a superset:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS job_common_i11
  ON jobs.job_common (name, priority DESC, created_on, start_after)
  WHERE state < 'active' AND NOT blocked;
```

`job_common_i11` does not exist in production yet (confirmed against `pg_indexes`), so the
build is a create, not a no-op. Over 12 rows in a 160 kB table the planner's choice between
the two is immaterial either way.

### Does it DELETE or TRUNCATE rows?

**No `DELETE` and no `TRUNCATE` appear in the file at all.** There are four `UPDATE`
statements. All four are in-place column writes on rows that stay; none has a `DELETE`
shape. Measured exposure of each:

| Statement | Rows it can touch | Measured |
|---|---|---|
| `UPDATE jobs.queue SET monitor_claim_on = monitor_on WHERE monitor_claim_on IS NULL` | 12 (the column is brand new, so every row) | `jobs.queue` = 12 rows; `monitor_on` non-null on all 12, so it copies 12 real timestamps and writes no NULLs |
| `UPDATE jobs.schedule SET kind = 'rrule' WHERE ...` | 0 | `jobs.schedule` = **0 rows** |
| `UPDATE jobs.schedule SET timezone = 'UTC' WHERE timezone IS NULL` | 0 | `jobs.schedule` = **0 rows**, of which 0 have a NULL timezone |
| `UPDATE jobs.version SET version = '42'` | 1 | `jobs.version` = 1 row |

The `jobs.queue` backfill is the only one that writes anything of consequence, and it writes
*into a column that did not exist one statement earlier*. It cannot lose an existing value
because there is no existing value. Its source column `jobs.queue.monitor_on` is present
today (`timestamp with time zone`, nullable) — verified, because the `UPDATE` would error
if it were not.

### Does it alter a column type in a way that can lose precision or fail on existing values?

**There is no `ALTER COLUMN ... TYPE` in the file.** The only `ALTER COLUMN` is a catalog
metadata change:

```sql
ALTER TABLE jobs.schedule ALTER COLUMN timezone SET DEFAULT 'UTC';
```

`SET DEFAULT` touches `pg_attrdef` only. It does not read, rewrite or validate a single
existing row, and with `jobs.schedule` at 0 rows there are none to validate regardless.

The four `ADD COLUMN`s are all new columns, all confirmed absent today, so none can conflict
with an existing value:

| Column | Type | Present in prod today? |
|---|---|---|
| `jobs.version.reindex_on` | `timestamptz`, nullable, no default | no |
| `jobs.version.monitor_backoff_on` | `timestamptz`, nullable, no default | no |
| `jobs.queue.monitor_claim_on` | `timestamptz`, nullable, no default | no |
| `jobs.schedule.last_job_id` | `uuid`, nullable, no default | no |
| `jobs.schedule.kind` | `text NOT NULL DEFAULT 'cron' CHECK (kind IN ('cron','rrule'))` | no |

`jobs.schedule.kind` is the only one with a `NOT NULL` and a `CHECK`, which is the shape
that *can* force a validating scan. It does not here: the default is a constant, so
PostgreSQL 11+ takes the `attmissingval` fast path rather than rewriting, and the table has
**0 rows** to scan in any case.

**Conclusion for §2: nothing in this file can lose data.** The worst outcome available to it
is an index that has to be rebuilt, and §5 supplies the statement that rebuilds it.

---

## 3. Lock profile and duration

### Measured sizes — every table the migration touches

| Table | `pg_total_relation_size` | Bytes | Exact row count |
|---|---|---|---|
| `jobs.version` | 24 kB | 24 576 | **1** |
| `jobs.queue` | 96 kB | 98 304 | **12** |
| `jobs.schedule` | 16 kB | 16 384 | **0** |
| `jobs.job_common` | 160 kB | 163 840 | **12** |
| `jobs.job` (partitioned parent) | 0 bytes | 0 | 12 (all via `job_common`) |

Tables the migration does **not** touch, measured because the brief asked for them:

| Table | `pg_total_relation_size` | Exact row count |
|---|---|---|
| `jobs.queue_stats` (parent) | 0 bytes | **0** |
| `jobs.queue_stats_20260827` | 24 kB | 0 |
| `jobs.queue_stats_20260828` | 24 kB | 0 |
| `jobs.bam` | 16 kB | **0** |
| `jobs.archive` | **does not exist** | — |

`jobs.archive` is absent from this schema entirely — `information_schema.tables` for schema
`jobs` returns exactly 12 relations and `archive` is not among them. pg-boss 12 retired it.

**Whole-schema total: 424 kB (434 176 bytes).** That is the complete footprint of everything
the migration can possibly lock.

### Which statements take ACCESS EXCLUSIVE, and on what

| Statement | Lock | On | Rewrite? |
|---|---|---|---|
| `ALTER TABLE jobs.version ADD COLUMN reindex_on` | ACCESS EXCLUSIVE | `jobs.version` (24 kB, 1 row) | no — nullable, no default, catalog only |
| `ALTER TABLE jobs.version ADD COLUMN monitor_backoff_on` | ACCESS EXCLUSIVE | `jobs.version` | no |
| `ALTER TABLE jobs.queue ADD COLUMN monitor_claim_on` | ACCESS EXCLUSIVE | `jobs.queue` (96 kB, 12 rows) | no |
| `ALTER TABLE jobs.schedule ADD COLUMN kind ... NOT NULL DEFAULT` | ACCESS EXCLUSIVE | `jobs.schedule` (16 kB, 0 rows) | no — constant default, PG11+ fast path; 0 rows anyway |
| `ALTER TABLE jobs.schedule ALTER COLUMN timezone SET DEFAULT` | ACCESS EXCLUSIVE | `jobs.schedule` | no — `pg_attrdef` only |
| `ALTER TABLE jobs.schedule ADD COLUMN last_job_id uuid` | ACCESS EXCLUSIVE | `jobs.schedule` | no |
| `CREATE OR REPLACE FUNCTION jobs.create_queue` (×2) | no table lock | `pg_proc` row; blocks concurrent callers of that function | n/a |
| `CREATE OR REPLACE FUNCTION jobs.job_now` | no table lock | `pg_proc` | n/a |
| the four `UPDATE`s | ROW EXCLUSIVE | `jobs.queue` / `jobs.schedule` / `jobs.version` | n/a |
| `CREATE INDEX CONCURRENTLY job_common_i11` | SHARE UPDATE EXCLUSIVE | `jobs.job_common` (160 kB, 12 rows) | n/a — **after COMMIT** |
| `DROP INDEX CONCURRENTLY job_common_i5` | SHARE UPDATE EXCLUSIVE (per PostgreSQL docs; not measured) | `jobs.job_common` | n/a — **after COMMIT** |

Three tables take ACCESS EXCLUSIVE: `jobs.version` (1 row), `jobs.queue` (12 rows),
`jobs.schedule` (0 rows). **`jobs.job` and `jobs.job_common` — the tables that actually hold
queued work — never take ACCESS EXCLUSIVE at any point.** The only statements that touch
them are the two `CONCURRENTLY` index operations, which take SHARE UPDATE EXCLUSIVE and sit
outside the transaction.

No `ALTER TABLE` here needs a lock on a referencing table: `ADD COLUMN` and `SET DEFAULT`
do not revalidate the foreign keys `job_common` holds against `jobs.queue(name)`.

### Realistic duration

Instant, and here are the numbers behind that word rather than the assumption:

- Every ACCESS EXCLUSIVE lock is taken over a table of **≤ 96 kB holding ≤ 12 rows**. None
  of them rewrites. Each `ALTER` is a catalog write measured in microseconds.
- The largest table involved, `jobs.job_common`, is **160 kB / 12 rows**, and the index build
  over it is a `CONCURRENTLY` build outside the transaction.
- `CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY` each wait out transactions that
  predate them. At the time of measurement, **`pg_stat_activity` showed 0 backends with a
  transaction older than 30 seconds**, so there is nothing for them to wait on.
- The transaction sets `SET LOCAL lock_timeout = 30000`, so the failure mode if something
  *is* holding a conflicting lock is a clean abort after 30 s, not an indefinite queue behind
  the ACCESS EXCLUSIVE request.
- For scale: the brief's own reference points were 37 rows in `better_auth."user"` and 12
  rows in `jobs.job`. The 12 is confirmed exactly. The entire `jobs` schema is 424 kB.

The realistic answer is sub-second wall clock, and the worst case bounded by the file's own
`lock_timeout` is 30 seconds of waiting followed by a full rollback of the transactional
block.

---

## 1. Statement inventory

Twenty-one statements, in file order. "Additive" means it only adds a catalog object or
writes a column that did not exist a moment earlier; "rewriting" means it rewrites table
heap or index storage; "destructive" means it removes something.

| # | Kind | Target | Class |
|---|---|---|---|
| 1 | `BEGIN` | — | control |
| 2 | `SET LOCAL lock_timeout = 30000` | session | control |
| 3 | `SET LOCAL idle_in_transaction_session_timeout = 30000` | session | control |
| 4 | `SELECT pg_advisory_xact_lock(...)` | advisory lock `sha224(db || '.pgboss.jobs')` | control |
| 5 | `SELECT` (divide-by-zero guard) | `jobs.version` | read-only guard |
| 6 | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` | `jobs.version.reindex_on` | **additive** |
| 7 | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` | `jobs.version.monitor_backoff_on` | **additive** |
| 8 | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` | `jobs.queue.monitor_claim_on` | **additive** |
| 9 | `UPDATE` | `jobs.queue` (12 rows) | **additive** (backfills the column added in #8) |
| 10 | `CREATE OR REPLACE FUNCTION` | `jobs.create_queue(text, jsonb)` — v40 shape | **additive** (replaces a function body) |
| 11 | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT ... CHECK` | `jobs.schedule.kind` | **additive** |
| 12 | `UPDATE` | `jobs.schedule` (0 rows) | **additive**, no-op |
| 13 | `UPDATE` | `jobs.schedule` (0 rows) | **additive**, no-op |
| 14 | `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT` | `jobs.schedule.timezone` | **additive** (catalog only) |
| 15 | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` | `jobs.schedule.last_job_id` | **additive** |
| 16 | `CREATE OR REPLACE FUNCTION` | `jobs.job_now()` — **new function** | **additive** |
| 17 | `CREATE OR REPLACE FUNCTION` | `jobs.create_queue(text, jsonb)` — v42 shape, supersedes #10 | **additive** |
| 18 | `UPDATE` | `jobs.version` (1 row) → `42` | **additive** (the version stamp) |
| 19 | `COMMIT` | — | control |
| 20 | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` | `jobs.job_common_i11` | **additive** |
| 21 | `DROP INDEX CONCURRENTLY IF EXISTS` | `jobs.job_common_i5` | **destructive** (index only) |

**Nothing in the file is "rewriting".** No statement rewrites a table heap.

The single destructive statement, quoted in full:

```sql
-- inlined from jobs.job_table_run_async (migration v40, command: fetch_index_retire)
DROP INDEX CONCURRENTLY IF EXISTS jobs.job_common_i5;
```

There is nothing else in the file that deletes, drops, alters a column type, or rewrites a
table, so there is nothing else to quote under that heading. For completeness, the guard on
line 1 of the body — the statement that makes a second run refuse rather than half-apply:

```sql
SELECT version::int/(version::int-42) from jobs.version;
```

At `version = 38` this evaluates `38 / -4` and succeeds. At `version = 42` it divides by zero
and aborts the transaction.

**A note on #10 and #17.** `jobs.create_queue` is replaced twice in one transaction — the v40
body, then the v42 body that supersedes it. That is an artifact of the planner concatenating
each migration's `install` array in order, not a bug. Only #17's definition survives the
commit. The v42 body differs from the v40 body in exactly one way: it names `created_on` and
`updated_on` explicitly and fills them from `jobs.job_now()` instead of leaning on the column
defaults.

---

## 5. Is there a reverse path?

**Yes. pg-boss 12.33.0 ships a complete down-migration from 42 to 38, and this is the most
useful fact in the document.**

`node_modules/pg-boss/dist/contractor.js:39` exposes it:

```js
static rollbackPlans(schema = plans.DEFAULT_SCHEMA, version = schemaVersion, options = {}) {
    const config = planConfig(schema, options.backend);
    return migrationStore.rollback(schema, version, migrationStore.getAllForConfig(config), config.noAdvisoryLocks);
}
```

Each of migrations 39, 40, 41 and 42 carries a populated `uninstall` array in
`migrationStore.js` (lines 1655–1800). `migrationStore.rollback()` steps **one version at a
time** — it selects `migrations.find(i => i.version === version)` — so reversing 42 → 38 is
four invocations, run newest-first. Each emits its own `BEGIN … COMMIT` block with the same
advisory lock and the same divide-by-zero guard pointed at the *target* version, so the chain
refuses to run out of order.

Generated locally with
`Contractor.rollbackPlans('jobs', 42 | 41 | 40 | 39, {})` against the pg-boss 12.33.0
installed in this worktree. **Verbatim, in the order they must be run:**

### Step 1 of 4 — `rollbackPlans('jobs', 42)` → schema 41

```sql

    BEGIN;
    SET LOCAL lock_timeout = 30000;
    SET LOCAL idle_in_transaction_session_timeout = 30000;
    SELECT pg_advisory_xact_lock(('x' || encode(sha224((current_database() || '.pgboss.jobs')::bytea), 'hex'))::bit(64)::bigint);
SELECT version::int/(version::int-41) from jobs.version;

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
DROP FUNCTION jobs.job_now();
UPDATE jobs.version SET version = '41';
    COMMIT;
  ```

### Step 2 of 4 — `rollbackPlans('jobs', 41)` → schema 40

```sql

    BEGIN;
    SET LOCAL lock_timeout = 30000;
    SET LOCAL idle_in_transaction_session_timeout = 30000;
    SELECT pg_advisory_xact_lock(('x' || encode(sha224((current_database() || '.pgboss.jobs')::bytea), 'hex'))::bit(64)::bigint);
SELECT version::int/(version::int-40) from jobs.version;
ALTER TABLE jobs.schedule DROP COLUMN kind;
ALTER TABLE jobs.schedule DROP COLUMN last_job_id;
UPDATE jobs.version SET version = '40';
    COMMIT;
  ```

### Step 3 of 4 — `rollbackPlans('jobs', 40)` → schema 39

```sql

    BEGIN;
    SET LOCAL lock_timeout = 30000;
    SET LOCAL idle_in_transaction_session_timeout = 30000;
    SELECT pg_advisory_xact_lock(('x' || encode(sha224((current_database() || '.pgboss.jobs')::bytea), 'hex'))::bit(64)::bigint);
SELECT version::int/(version::int-39) from jobs.version;
DELETE FROM jobs.bam WHERE version = 40 AND status <> 'completed';

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

      EXECUTE jobs.job_table_format($cmd$CREATE INDEX job_i5 ON jobs.job (name, start_after) WHERE state < 'active' AND NOT blocked$cmd$, tablename);
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
SELECT jobs.job_table_run($cmd$CREATE INDEX IF NOT EXISTS job_i5 ON jobs.job (name, start_after) WHERE state < 'active' AND NOT blocked$cmd$);
SELECT jobs.job_table_run($cmd$DROP INDEX IF EXISTS jobs.job_i11$cmd$);
ALTER TABLE jobs.queue DROP COLUMN monitor_claim_on;
ALTER TABLE jobs.version DROP COLUMN monitor_backoff_on;
UPDATE jobs.version SET version = '39';
    COMMIT;
  ```

### Step 4 of 4 — `rollbackPlans('jobs', 39)` → schema 38

```sql

    BEGIN;
    SET LOCAL lock_timeout = 30000;
    SET LOCAL idle_in_transaction_session_timeout = 30000;
    SELECT pg_advisory_xact_lock(('x' || encode(sha224((current_database() || '.pgboss.jobs')::bytea), 'hex'))::bit(64)::bigint);
SELECT version::int/(version::int-38) from jobs.version;
ALTER TABLE jobs.version DROP COLUMN reindex_on;
UPDATE jobs.version SET version = '38';
    COMMIT;
  ```

### Every dependency the reverse path needs exists in production today

Checked, because a rollback plan that references a missing object is not a rollback plan:

| Dependency | Required by | Present? |
|---|---|---|
| `jobs.job_table_run(command text, tbl_name text DEFAULT NULL, queue_name text DEFAULT NULL)` | step 3 calls it with **one** argument | yes — `pronargs = 3`, `pronargdefaults = 2`, so a one-arg call resolves |
| `jobs.job_table_format(command text, table_name text)` | the restored `create_queue` bodies | yes |
| `jobs.bam` with columns `version`, `status` | step 3's `DELETE FROM jobs.bam WHERE version = 40 AND status <> 'completed'` | yes — table exists, both columns present, **0 rows**, so the delete is a no-op |
| `jobs.job_common` as the DEFAULT partition | the `job_table_run` fan-out | yes — `relpartbound = DEFAULT` |

### What the reverse path costs, and its one honest caveat

Step 3 recreates the index the forward migration dropped:

```sql
SELECT jobs.job_table_run($cmd$CREATE INDEX IF NOT EXISTS job_i5 ON jobs.job (name, start_after) WHERE state < 'active' AND NOT blocked$cmd$);
```

That definition matches production's current `job_common_i5` exactly — same columns
(`name, start_after`), same predicate (`state < 'active' AND NOT blocked`). So the content is
fully restored. Two caveats worth stating rather than glossing:

1. **The rebuild is not `CONCURRENTLY`.** Step 3 builds `job_i5` and drops `job_i11` inside
   its transaction, taking ACCESS EXCLUSIVE on `jobs.job_common` for the duration. Over
   160 kB and 12 rows that is milliseconds, but it is a stricter lock than the forward
   migration takes on the same table.
2. **The index gets a new OID.** Reversing restores the index's definition and contents, not
   its physical identity. For a b-tree over 12 rows that is a distinction with no practical
   consequence, but "byte-for-byte identical afterwards" would be an overclaim.

Everything else the reverse path removes — `jobs.schedule.kind`, `jobs.schedule.last_job_id`,
`jobs.queue.monitor_claim_on`, `jobs.version.monitor_backoff_on`, `jobs.version.reindex_on`,
and the function `jobs.job_now()` — are objects that **do not exist in production today**.
Dropping them returns the schema to exactly what is there now. The one thing the rollback
deliberately leaves behind is `jobs.schedule.timezone`'s `DEFAULT 'UTC'`; `migrationStore.js`
documents this as intentional, since a v40 client names the column on every write and so
never falls back to the default.

---

## 4. Is it idempotent / safely re-runnable?

### Does it run in a transaction, and can it?

**Partly, and the split is deliberate and necessary.** Statements 1–19 run inside one
explicit `BEGIN … COMMIT`. Statements 20 and 21 sit *after* the `COMMIT` because
`CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY` are prohibited inside a
transaction block by PostgreSQL. They cannot be pulled inside it.

The consequence is an operational constraint, not a defect: the file must be sent by a client
that does **not** wrap its input in a transaction. `psql -f` is correct; anything that opens
an implicit transaction around the whole script will fail at statement 20.

### If the connection drops mid-way, what state is the schema in?

Five distinct interruption points, with the recovery for each:

| Drops… | Resulting state | Re-runnable? |
|---|---|---|
| **A.** any time before `COMMIT` (#19) | Everything rolls back. `jobs.version = 38`, no new columns, no `job_now()`, `create_queue` unchanged. Identical to now. | **Yes** — re-run the whole file from the top. The guard passes at 38. |
| **B.** after `COMMIT`, before #20 | `jobs.version = 42`, all columns and functions in place, `job_common_i11` missing, `job_common_i5` still present. **Functional**: a 12.33.0 client starts cleanly. | **Yes** — re-run the file; see the `ON_ERROR_STOP` note below. |
| **C.** during #20 | `job_common_i11` exists but is marked **INVALID**. Not used by the planner, but still maintained on every write. | **No, not blindly** — see below. |
| **D.** after #20, before #21 | Both `i11` and `i5` exist. Harmless: one redundant 16 kB index. | **Yes.** |
| **E.** during #21 | `job_common_i5` may be left marked invalid/not-dropped. | **Yes** — `DROP INDEX CONCURRENTLY IF EXISTS` handles it. |

**Case C is the one genuine non-idempotency in the file**, and it is worth naming precisely.
An interrupted `CREATE INDEX CONCURRENTLY` leaves an invalid index behind, and
`CREATE INDEX CONCURRENTLY IF NOT EXISTS` will **skip** it on a re-run — the name exists, so
`IF NOT EXISTS` is satisfied and the broken index is never rebuilt. Detect it with:

```sql
SELECT c.relname, i.indisvalid
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'jobs' AND c.relname IN ('job_common_i11', 'job_common_i5');
```

If `indisvalid` is false, `DROP INDEX CONCURRENTLY jobs.job_common_i11` first, then re-run.
Over a 160 kB table this rebuild is instant, so the recovery is cheap — it just is not
automatic.

### Can the whole file simply be re-run?

**Yes, with one flag caveat.** Re-running at `jobs.version = 42` hits the guard:

```sql
SELECT version::int/(version::int-42) from jobs.version;
```

`42 / 0` raises `division by zero`, which aborts the transaction. What happens next depends
on `ON_ERROR_STOP`:

- **Default (`ON_ERROR_STOP` unset):** psql reports the error, every statement through #18 is
  skipped with *"current transaction is aborted"*, `COMMIT` degrades to `ROLLBACK`, and then
  statements 20 and 21 execute normally as standalone statements. Both carry
  `IF NOT EXISTS` / `IF EXISTS`, so they are no-ops when already applied — **and they are the
  repair for interruption case B.** A plain re-run self-heals.
- **`-v ON_ERROR_STOP=1`:** psql aborts at the guard and never reaches statements 20 and 21.
  Safe, but it will *not* finish an interrupted run. If you use `ON_ERROR_STOP=1` and land in
  case B or C, run the two tail statements by hand.

Everything inside the transaction is independently idempotent on its own terms — four
`ADD COLUMN IF NOT EXISTS`, three `CREATE OR REPLACE FUNCTION`, one `SET DEFAULT`, and four
`UPDATE`s whose `WHERE` clauses are self-limiting. The guard is belt-and-braces on top of
that, not the only thing holding it together.

---

## 6. The partition question

**The migration creates no partitions, requires none, and assumes none. It cannot fail
part-way on a missing partition, because it never names one.**

### It does not touch `queue_stats`

`grep` over the migration body (lines 48–256, below the comment header) returns **zero**
occurrences of `queue_stats`. The only `PARTITION` keywords in the file are inside the two
`CREATE OR REPLACE FUNCTION jobs.create_queue` bodies:

```sql
EXECUTE format('ALTER TABLE jobs.job ATTACH PARTITION jobs.%I FOR VALUES IN (%L)', tablename, queue_name);
```

That is a *function definition*, not an executed statement. `CREATE OR REPLACE FUNCTION`
stores the body; it does not run it. Nothing in the migration calls `jobs.create_queue`. And
the branch containing that `ATTACH PARTITION` is unreachable for this deployment anyway:
every queue in `topology.ts` is created with `partition: false`, so the function returns early
at `IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN RETURN`.

The only partitioned object the migration touches is `jobs.job_common` — the **DEFAULT**
partition of `jobs.job` (`pg_class.relpartbound = DEFAULT`, confirmed). It exists today, it
is named literally in statements 20 and 21, and no new partition of `jobs.job` is created.

### The interaction with `ensureQueueStatsPartitions` runs the *other* way

`plans.js:1309` builds a `DO` block that creates today's and tomorrow's `queue_stats`
partitions. Its date expression is:

```sql
d := (jobs.job_now() AT TIME ZONE 'UTC')::date + i;
```

**`jobs.job_now()` does not exist in production.** `pg_proc` for schema `jobs` returns exactly
five functions — `create_queue`, `delete_queue`, `job_table_format`, `job_table_run`,
`job_table_run_async` — and `job_now` is not among them. It is created by statement #16 of
this very migration.

So the dependency points forward, not backward: **12.33.0's partition-provisioning code cannot
run until this migration lands.** The migration is a prerequisite for `ensureQueueStatsPartitions`,
never a consumer of it. `ensureQueueStatsPartitions` is called from `boss.js:224` inside
`supervise()` — a runtime path, reached only after `Contractor.check()` has already passed. It
is not part of the 38→42 chain at all (`migrationStore.js:1589` wires it into migration **v35**,
which is long since applied).

The same is true of `insertQueueStats` (`plans.js:1372`), which also selects `jobs.job_now()`.

### Why the partitions stopped at 2026-08-28, and why it does not matter here

The stale partitions are **inert**, and the evidence is consistent end to end:

- `jobs.queue_stats` holds **0 rows**. Both partitions (`queue_stats_20260827`,
  `queue_stats_20260828`, 24 kB each) are empty.
- `boss.js:223` gates partition creation on `this.#config.persistQueueStats`, and `boss.js:290`
  gates the insert on the same flag. `persistQueueStats` is declared optional in
  `types.d.ts:154` and is **never assigned a default in `attorney.js`** — a `grep` for it
  across `dist/` finds it only in `boss.js` and `types.d.ts`. `packages/jobs/src/boss.ts`
  does not set it either.
- So both the provisioning and the insert are skipped on every `supervise()` call. Nothing has
  tried to write a `queue_stats` row since install, which is exactly what 0 rows says.
- The two partitions that *do* exist match the install plan: `plans.js:127` includes
  `ensureQueueStatsPartitions(schema)` in `create()`, and that runs "today and tomorrow" —
  2026-08-27 and 2026-08-28, the install date and the day after, per the incident timeline.

That resolves the partition gap as a leftover from the 2026-08-27 install rather than a
symptom. It also means it is **not** the cause of the `supervise()` failures the incident
tracks separately — a queue-stats insert that never runs cannot be failing on a missing
partition. That investigation should look elsewhere.

**Answer to the scenario in question 4:** there is no partition-shaped way for this migration
to fail part-way. The failure modes are the five in §4, none of which involve a partition.

---

## 7. What breaks in reverse (footnote)

### The code read is confirmed

`node_modules/pg-boss/dist/contractor.js`, verbatim:

```js
async check() {
    const installed = await this.isInstalled();
    if (!installed) {
        throw new Error('pg-boss is not installed');
    }
    const version = await this.schemaVersion();
    if (schemaVersion !== version) {
        throw new Error('pg-boss database requires migrations');
    }
}
```

`schemaVersion` is `packageJson.pgboss.schema` (line 7). The comparison is `!==`. A client
pinning 12.28.0 (schema 38) against a database at 42 throws exactly as a client at 42 against
a database at 38 does today. The incident's reading of this is correct.

### Which branches that disqualifies

Measured across every ref in this worktree (`git show <ref>:pnpm-workspace.yaml`):

| Pin | Remote branches | Local branches |
|---|---|---|
| `pg-boss: 12.28.0` | **17**, including `origin/main` | 17 |
| `pg-boss: 12.33.0` | 4 | 5 |
| no `pnpm-workspace.yaml` / no pin | 2 | 5 |

The 17 remote branches pinned at 12.28.0, all of which would fail `Contractor.check()` after
the migration:

`origin/main`, `origin/claude/bug-hunting-fixes-85ahpk`, `origin/codex/moyo-stripe-setup`,
`origin/design/reset-v2`, `origin/feat/homework-intelligence`, `origin/feat/natalie-human`,
`origin/feat/spatial-whiteboard-xr`, `origin/fix/jobs-drain-retention`,
`origin/fix/login-verification-natalie-voice`, `origin/fix/natalie-conversational-presence`,
`origin/fix/natalie-tutor-realism`, `origin/natalie-web-stage`, `origin/ops-dashboard`,
`origin/overhaul/phase1-audit`, `origin/tutor-presence-phase1`, `origin/web-vite-photo-swap`,
and the bare `origin` ref.

Already on 12.33.0 and therefore unaffected: `origin/fix/jobs-drain-on-deployed` (this
branch), `origin/fix/login-natalie-on-deployed`, `origin/upgrade/expo-sdk-58-beta`,
`origin/upgrade/expo-sdk-58-preview5`, plus the local-only
`codex/homework-scanner-audit-2026-09-21`.

Note that `origin/fix/jobs-drain-retention` — the branch the incident says carries the fixes —
pins **12.28.0**, so it is in the disqualified set. That is worth flagging before anyone plans
to deploy the incident's remediation and the migration together.

### Why this is a footnote and not the headline

The coordinator established that `packages/jobs/` is byte-identical between `origin/main` and
the deployed `8b2ae90`, that every pg-boss method the repo calls exists in 12.33.0, and that
the `main` lineage passes its full gate (build 5/5, lint 19/19 plus all 21 architecture
checkers, typecheck 19/19, 1,466 tests, 0 failures) once the catalog is moved to 12.33.0 and
`PGBOSS_SCHEMA_VERSION` to 42.

So "17 branches become undeployable" is true only for as long as those branches stay on a
one-line pin that is under this team's control. The migration does not strand them; it makes
a catalog edit due. The irreversible-looking part of the door has a handle on both sides.

**One loose end on this branch specifically:** `packages/jobs/src/boss.ts:52` still reads
`PGBOSS_SCHEMA_VERSION = 38` while `pnpm-workspace.yaml:245` on this same branch pins
`pg-boss: 12.33.0`. That is the mismatch the incident says `jobs.test.ts` asserts against, so
this branch's own guard should currently be failing. It needs to go to 42 as part of the
convergence.

### One detail that does not fit

`codex/homework-scanner-audit-2026-09-21` — the branch production is deployed from — **exists
only as a local branch in this worktree.** `git ls-remote origin` returns no ref matching
`homework-scanner`. Production is therefore running a commit whose branch is not on the
remote. That is not this migration's problem, but it bears on action item 7 of the incident
("decide whether production should ever deploy from a non-`main` branch") and someone should
confirm `8b2ae90` is still reachable on the remote at all before relying on a revert to it as
the fallback plan.

---

## What I could not determine

1. **Whether the two `CONCURRENTLY` statements survive the PgBouncer pooler.** The only
   connection string in `/Users/mikevocalz/moyolearn/.env` is the transaction-mode pooler
   (`aws-0-us-west-2.pooler.supabase.com:6543`). I used it for reads, but I did not run the
   migration and so did not test whether `CREATE INDEX CONCURRENTLY` behaves through it. The
   safe course is a **direct session-mode connection (port 5432)** for the actual run — the
   explicit `BEGIN … COMMIT` block needs server-connection affinity, and `CONCURRENTLY`
   statements are simplest to reason about on an unpooled session. I did not locate a direct
   connection string; someone will need to pull it from the Supabase dashboard.

2. **Lock behaviour of `DROP INDEX CONCURRENTLY` is cited from PostgreSQL documentation, not
   measured.** I did not run it, and `EXPLAIN ANALYZE` and transaction probes were off-limits
   by instruction. The SHARE UPDATE EXCLUSIVE claim in §3 is from the docs. Everything else in
   the lock table follows from statement kind, which is deterministic.

3. **Whether `jobs.version` has ever been anything other than 38 on this database.** There is
   no migration history table to read — pg-boss keeps a single integer, not a ledger. The
   value today is 38 and that is all the database can tell me.

4. **Why `boss.supervise()` has been failing since 2026-08-28.** §6 rules *out* the stale
   `queue_stats` partitions as the cause, since `persistQueueStats` is unset and so neither the
   partition-creation nor the insert path runs. That narrows it but does not answer it. The
   incident is right to track it separately, and it is not resolved by this migration.

5. **Whether `8b2ae90` is still reachable on `origin`.** The branch name is not, and I did not
   query the remote for the bare SHA. If option (b) from the incident — reverting production to
   a 12.28.0 build — is under consideration, verify this first.

6. **Runtime behaviour after the migration.** Every claim here is about schema shape and the
   SQL the two pg-boss versions emit. I did not start a pg-boss instance against production, so
   "12.33.0 works afterwards" rests on the coordinator's 1,466-test gate rather than on
   anything I observed against this database.
