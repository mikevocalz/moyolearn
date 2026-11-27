# Lane B migration record: homework prior-work, billing organization, SignalIQ marketing

Environment: **local scratch PostgreSQL (not staging, not production)**. No remote database was
touched. `DATABASE_URL` and `.env` files were not read. No Supabase or Neon MCP tools were called.

| Item | Value |
|---|---|
| Date (UTC) | 2026-11-25, 05:45:19 to 05:56:15 |
| Source tree (read-only) | `/Volumes/QNX/clones/moyolearn-v1-20261125`, branch `integrate/v1-main-20261125`, commit `1457ff92` |
| Scratch server | `PostgreSQL 14.24 (Homebrew) on aarch64-apple-darwin27.0.0`, binaries `/opt/homebrew/Cellar/postgresql@14/14.24_1/bin` |
| Listener | Unix socket only: `-p 54329 -k /Volumes/QNX/clones/lane-b -c listen_addresses=''` |
| Data dir | `/Volumes/QNX/clones/lane-b/pgdata` (deleted after `pg_ctl stop`, exit 0) |
| Repo test server | `PostgreSQL 18.7 (Homebrew)` from `/opt/homebrew/opt/postgresql@18/bin` (the test requires 16+) |
| Node | `v26.13.0` |
| Logs kept | `/Volumes/QNX/clones/lane-b/logs/{migrations,concurrency,repo-test-pg18,repo-test-pg18-sql}.log`, `pg.log`, `initdb.log` |
| Scripts kept | `/Volumes/QNX/clones/lane-b/run-migrations.sh`, `concurrency.sh`, `sql/*.sql` |

## 1. Binary versions

`/opt/homebrew/bin/postgres --version` printed `postgres (PostgreSQL) 14.24 (Homebrew)`. The
`/opt/homebrew/opt/libpq/bin/` tools printed `18.6` (`initdb`, `pg_ctl`, `psql`). Majors differ, so
the matching `initdb`/`pg_ctl`/`psql` from `/opt/homebrew/Cellar/postgresql@14/14.24_1/bin` were used
for the 14.24 cluster. `initdb` exit 0; `pg_ctl ... start` exit 0 (`server started`). No shared memory
error occurred (`grep -ci "shared memory\|could not" pg.log` = 0), so the `shared_buffers=16MB` retry
was not needed.

## 2. Baseline

The repo has no SQL migration that creates the `payload` schema or `payload_locked_documents*`
(Payload creates those in push mode). The baseline for those is the repo's own test fixture
`packages/payload/src/migrations/fixtures/homework-admin-lock.sql`, which the fixture header calls
"a migration test fixture, not a full Payload schema bootstrap". **The `payload` schema baseline is a
stand-in.** Roles `anon` and `authenticated` were created as `NOLOGIN` stand-ins because
`better_auth_schema.sql` line 40 revokes from them unconditionally.

Order applied to database `moyo_scratch` (every step `psql -X -w -v ON_ERROR_STOP=1`, all exit 0;
tally from `logs/migrations.log`: `15` steps with `exit=0`, 0 other):

| # | File | Exit | Notes |
|---|---|---|---|
| 00 | `sql/00-roles-db.sql` (scratch roles + database) | 0 | stand-in |
| 01 | `fixtures/homework-admin-lock.sql` | 0 | stand-in for Payload bootstrap |
| 02 | `migrations/homework_additive.sql` | 0 | creates `payload.homework_questions` |
| 03 | `migrations/better_auth_schema.sql` | 0 | creates schema `better_auth` |
| 04 | `migrations/better_auth_tables.sql` | 0 | creates `better_auth.organization`, `better_auth.subscription` |

`signaliq_marketing_additive.sql` references `better_auth.subscription` (line 57) and the `payload`
schema; both exist after step 04. No baseline step failed.

## 3. Target migrations, applied twice each

### 3a. `homework_prior_work_additive.sql`

Seed row inserted **before** the migration (`sql/10-seed-row.sql`, `INSERT 0 1` twice) and snapshotted
to `scratch.hq_before` as `to_jsonb(row)` with md5 `0d67cc2e5e8b17efa9676dd996f36cef`.

Apply 1 (exit 0): `DO DO ALTER TABLE ALTER TABLE ALTER TABLE ALTER TABLE`, no NOTICE.

Apply 2 (exit 0), NOTICEs verbatim:
```
homework_prior_work_additive.sql:13: NOTICE:  column "prior_work" of relation "homework_questions" already exists, skipping
homework_prior_work_additive.sql:15: NOTICE:  column "prior_work_confidence" of relation "homework_questions" already exists, skipping
homework_prior_work_additive.sql:17: NOTICE:  column "prior_work_source" of relation "homework_questions" already exists, skipping
homework_prior_work_additive.sql:19: NOTICE:  column "prior_work_revisions" of relation "homework_questions" already exists, skipping
```
The two `CREATE TYPE` blocks swallow `duplicate_object` silently, so they emit nothing on rerun.

`\d payload.homework_questions` after both applies (new columns only; full output in
`logs/migrations.log` lines 137-198):
```
 prior_work            | payload.enum_homework_questions_prior_work        |           | not null | 'none'::payload.enum_homework_questions_prior_work
 prior_work_confidence | numeric                                           |           |          |
 prior_work_source     | payload.enum_homework_questions_prior_work_source |           |          |
 prior_work_revisions  | jsonb                                             |           | not null | '[]'::jsonb
```
Enum values: `prior_work_values = {none,partial,complete}`, `source_values = {detected,guardian}`.

No-row-change proof (same log, `sql/20-hq-verify.sql`):
```
 row_count | md5_before                       | md5_after_minus_new_cols         | pre_existing_columns_changed | prior_work | prior_work_confidence | prior_work_source | prior_work_revisions
         1 | 0d67cc2e5e8b17efa9676dd996f36cef | 0d67cc2e5e8b17efa9676dd996f36cef | f                            | none       |                       |                   | []
```
`to_jsonb(row)` minus the four new keys `IS DISTINCT FROM` the pre-migration snapshot evaluates to
`f`, and the md5 of that projection equals the pre-migration md5. The pre-existing columns are
byte-identical; the new columns hold their defaults.

### 3b. `better_auth_stripe_organization.sql`

Apply 1 (exit 0): `ALTER TABLE` then `DO`, no NOTICE. Apply 2 (exit 0):
```
better_auth_stripe_organization.sql:8: NOTICE:  column "stripeCustomerId" of relation "organization" already exists, skipping
```
The compatibility `DO $billing_schema$` block (lines 11-26) passed both times; it would have raised
`ERRCODE 55000` if the column were not a plain nullable `text` without default.

`\d better_auth.organization` after both applies shows `stripeCustomerId | text | | |` and
`Policies (row security enabled): (none)`. `information_schema.columns` row:
`stripeCustomerId | text | pg_catalog | text | YES | (null) | NEVER | NO`. `organization_rows = 0`
(no row data to change; the migration contains no DML).

The release path `apps/web/scripts/billing-migrate.mts` was **not run**: it requires `DATABASE_URL`
(line 46) and `pg`/`zod` from a finished install. Reading it: `--apply` wraps the same SQL file in
`BEGIN`, `SET LOCAL statement_timeout/lock_timeout = '5s'`, and
`pg_advisory_xact_lock(hashtextextended('moyo-billing-organization-schema-v1', 0))`, then runs the
same readiness query (lines 17-39) whose predicate matches the migration's `DO` block.

### 3c. `signaliq_marketing_additive.sql`

Apply 1 (exit 0). Even on a fresh database it emits 6 NOTICEs, because lines 14 and 46-50 are
`ADD COLUMN IF NOT EXISTS` for columns the `CREATE TABLE` on lines 5-13 and 38-44 already define:
```
signaliq_marketing_additive.sql:14: NOTICE:  column "prospect_id" of relation "marketing_inquiries" already exists, skipping
signaliq_marketing_additive.sql:46: NOTICE:  column "subscription_id" of relation "marketing_verified_payments" already exists, skipping
signaliq_marketing_additive.sql:47: NOTICE:  column "evidence_status" ... already exists, skipping
signaliq_marketing_additive.sql:48: NOTICE:  column "moyo_price_seen" ... already exists, skipping
signaliq_marketing_additive.sql:49: NOTICE:  column "next_verify_at" ... already exists, skipping
signaliq_marketing_additive.sql:50: NOTICE:  column "error_code" ... already exists, skipping
```
Both `UPDATE` statements (lines 15 and 53-66) reported `UPDATE 0`. The `DO` block on lines 77-81
found the stand-in `anon`/`authenticated` roles and executed the `REVOKE`s.

Apply 2 (exit 0): 16 NOTICEs, all `already exists, skipping` (5 tables, 5 indexes, 6 columns; log
lines 276-317). No ERROR.

Verification (`sql/40-marketing-verify.sql`): all five `marketing_*` tables have
`rls_enabled = t`, `rls_forced = f`, `policies = 0`; 12 indexes present including
`marketing_inquiries_billing_key`, `marketing_outbox_due`, `marketing_verified_payment_customer`;
`role_table_grants` for `PUBLIC`/`anon`/`authenticated` returned `(0 rows)`; all five tables have
`count = 0` (no row data existed to change).

## 4. Repo test `homework-prior-work.test.mjs`

How it connects: it never reads `DATABASE_URL`. It spawns its own cluster with
`initdb`/`pg_ctl`/`psql` from `MOYO_PG_TEST_BIN` (or `pg_config --bindir`, `/usr/lib/postgresql/*`,
`/opt/homebrew/opt/postgresql@18/bin`), under `tmpdir()`, with a random port 49152-65000 and a
private socket directory, env limited to `PATH LANG LC_ALL TZ PGPASSFILE PGSERVICEFILE PGSYSCONFDIR`.
It asserts `PostgreSQL 16 or newer`, so the 14.24 scratch server on port 54329 cannot be used; it was
pointed at PG 18.7 via `MOYO_PG_TEST_BIN=/opt/homebrew/opt/postgresql@18/bin`. The test shells out to
the binaries only, so it needs no `node_modules` in SQL mode.

Run 1, `TMPDIR` on the external drive (`logs/repo-test-pg18.log`): **fail 1**,
`initdb failed: spawnSync /opt/homebrew/opt/postgresql@18/bin/initdb ETIMEDOUT` after the test's
hard-coded 30 s `spawnSync` timeout. Measured: `initdb PG18 -> /Volumes/QNX/clones/lane-b/tmp :
exit=0 elapsed=44s` versus `1s` on the internal disk.

Run 2, `TMPDIR` at the session scratchpad: **fail 1**, `pg_ctl exited 1`; the cluster's
`postgres.log` said `Unix-domain socket path ".../moyo-homework-1UjDCY/socket/.s.PGSQL.60876" is
too long (maximum 103 bytes)` (117 bytes).

Run 3, `TMPDIR=/tmp/lb` (short internal path; deviation from "all files on the external drive",
forced by the two failures above; the test removes its cluster on success and `/tmp/lb` was then
deleted), `logs/repo-test-pg18-sql.log`, 05:55:54 to 05:55:57 UTC, `node --test exit=0`:
```
✔ prior-work SQL preserves legacy data, guardian marks and crop retention on an isolated PostgreSQL rerun (1666.771083ms)
ℹ postgres (PostgreSQL) 18.7 (Homebrew)
 PASS: legacy defaults; unchanged legacy row/crop/outcome; guardian mark/history; idempotent rerun; enum rejection
 PASS: expired crop removed; mark/history/text/outcome retained; live crop unchanged
ℹ scratch PostgreSQL stopped cleanly
ℹ tests 1  ℹ pass 1  ℹ fail 0  ℹ cancelled 0  ℹ skipped 0
```
The same four `already exists, skipping` NOTICEs appeared on its second apply (psql stdin lines
348-354). A `WARNING: password file "/dev/null" is not a plain file` is emitted by psql because the
test sets `PGPASSFILE=/dev/null` on purpose.

**Skipped:** the `MOYO_PG_TEST_REPOSITORY=1` variant (loads the real repository and Payload adapter
through `fixtures/homework-repository-check.mjs`). Reason: `/Volumes/QNX/clones/moyolearn-v1-20261125-install.log`
has no `exit=` line (still printing `Progress: resolved 0, reused 0, downloaded 1889, added 154`) and
`node_modules/@payloadcms/db-postgres/package.json` does not exist at the root, in `packages/payload`,
or in `apps/web`.

## 5. Concurrency: what the cursor functions execute

`apps/web/lib/homework.repository.ts` has exactly one `FOR UPDATE` site
(`grep -rn "for update" apps/web/lib/ packages/payload/src/` lists only line 561 in this file):

```
552  async function lockSubmission(
553    payload: Payload,
554    transactionID: string | number,
555    learnerAuthId: string,
556    submissionId: string,
557  ): Promise<void> {
558    const session = (payload.db as unknown as DrizzleSessions).sessions[String(transactionID)];
559    if (!session) throw new Error('transaction session missing');
560    await session.db.execute(
561      sql`select 1 from "payload"."homework_submissions" where "submission_id" = ${submissionId} and "learner_auth_id" = ${learnerAuthId} for update`,
562    );
563  }
```

All three cursor functions open a Payload transaction and call it first:

| Function | `beginTransaction` | `lockSubmission` call (FOR UPDATE) | `commitTransaction` |
|---|---|---|---|
| `startSubmission` (line 445) | 447 | **451** | 467, 471, 485 |
| `revisePriorWork` (line 494) | 496 | **500** | 540 |
| `advanceSubmission` (line 565) | 567 | **572** (comment 571: "Serialises concurrent advances on this one row") | 631 |

After the lock, each reads with `payload.find` (`findSubmission` line 174, `findQuestions` line 190,
both passing `req: { transactionID }`) and writes with `payload.update(... ...req)`. Those Payload
calls do not add `FOR UPDATE`; the row lock taken at 561 inside the same transaction is what
serialises them. `createSubmission` (line 325) takes no lock (fresh rows). Every exit path either
commits or calls `rollbackTransaction` (e.g. lines 488-489, 543-544, 633-634).

### Two-session reproduction (`concurrency.sh`, `logs/concurrency.log`, 14.24 scratch, row seeded in 3a)

Statement under test is the line-561 SQL with the seed values bound. Session 1: `BEGIN; <lock>;
select pg_sleep(8); COMMIT;`. Session 2: `SET lock_timeout='2s'; BEGIN; <lock>;`.
```
S1 [05:53:35] BEGIN; <lock>; pg_sleep(8); COMMIT
S2 [05:53:37] attempt 1: SET lock_timeout='2s'; BEGIN; <lock>   (S1 still holds the row)
S2  ERROR:  canceling statement due to lock timeout
S2  CONTEXT:  while locking tuple (0,1) in relation "homework_submissions"
S2 attempt 1 psql exit=1 [05:53:39]
S3 [05:53:40] observer: who holds / waits on the row
S3   32124 | active | Timeout         | PgSleep    | BEGIN; select 1 from "payload"."homework_submissions" where "submissio
S2 [05:53:40] attempt 1b: lock_timeout=2s again, S1 still sleeping (expected: blocks ~2s, fails again)
S2  ERROR:  canceling statement due to lock timeout
S2  CONTEXT:  while locking tuple (0,1) in relation "homework_submissions"
S2 attempt 1b psql exit=1 [05:53:42]
S1  COMMIT
S1 [05:53:43] committed
S2 [05:53:43] attempt 2: same lock_timeout=2s, after S1 COMMIT (expected: succeeds)
S2  COMMIT
S2 attempt 2 psql exit=0 [05:53:44]
```
Session 2 blocked for the full 2 s and failed (exit 1) twice while session 1 held the tuple lock,
then acquired the lock and committed (exit 0) one second after session 1's COMMIT.

## 6. Rollback notes

Dropping a column or table **loses every value written to it after apply**. Take a backup first.
These statements were not executed here.

`homework_prior_work_additive.sql`:
```sql
ALTER TABLE "payload"."homework_questions" DROP COLUMN IF EXISTS "prior_work_revisions";
ALTER TABLE "payload"."homework_questions" DROP COLUMN IF EXISTS "prior_work_source";
ALTER TABLE "payload"."homework_questions" DROP COLUMN IF EXISTS "prior_work_confidence";
ALTER TABLE "payload"."homework_questions" DROP COLUMN IF EXISTS "prior_work";
DROP TYPE IF EXISTS "payload"."enum_homework_questions_prior_work_source";
DROP TYPE IF EXISTS "payload"."enum_homework_questions_prior_work";
```
Drops guardian marks, detected-prior-work confidence and the revision history written since apply.

`better_auth_stripe_organization.sql`:
```sql
ALTER TABLE "better_auth"."organization" DROP COLUMN IF EXISTS "stripeCustomerId";
```
Drops the organization-to-Stripe-customer link; `@better-auth/stripe` 1.7.2 organization billing
stops working until re-applied.

`signaliq_marketing_additive.sql` (order respects the two composite foreign keys into
`marketing_inquiries`; `CASCADE` would also work):
```sql
DROP TABLE IF EXISTS payload.marketing_outbox;
DROP TABLE IF EXISTS payload.marketing_updates;
DROP TABLE IF EXISTS payload.marketing_verified_payments;
DROP TABLE IF EXISTS payload.marketing_rate_limits;
DROP TABLE IF EXISTS payload.marketing_inquiries;
```
Drops all inquiries, their consent timestamps, the delivery ledger, verified payments and rate-limit
windows. The `UPDATE ... SET state='blocked', event=null` on lines 53-66 is destructive in the
forward direction too (it nulls `event` on unproven orders) and has no SQL undo; on this scratch
run it matched `UPDATE 0` rows. There is no DROP for the `REVOKE`s; they removed grants that
`anon`/`authenticated` should not hold anyway.

## 7. Out of scope

Applying any of these to staging or production needs that environment's `DATABASE_URL`
(`billing-migrate.mts --preflight` then `--apply` for the organization column; the migration runner
for the other two) and is outside this lane. Nothing here touched a remote database.

## 8. Housekeeping

`pg_ctl stop` exit 0 (`database system is shut down`), `pgdata` deleted, `/tmp/lb` deleted. Internal
disk was at 4.8 GiB free (under the 10 GB floor): `npm cache clean --force` ran (exit 0, 259M).
Xcode DerivedData and CoreSimulator caches were already 0B and `~/.gradle/caches` absent; the
`rm -rf` for them was denied by the permission system but there was nothing to remove. pnpm store
prune was **not** run because the background `pnpm install` in the clone is still writing to that
store. Free after: 5.3 GiB. `/Volumes/QNX` has 873 GiB free. No clones were created by this lane.
