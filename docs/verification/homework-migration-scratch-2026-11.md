# Homework prior-work migration scratch check

Date: 2026-11-14. Latest result: the checked-in migration and production crop-retention SQL pass on isolated PostgreSQL 18.0 in single-user mode. Repository concurrency and deployed schema acceptance remain separate gates.

The regression is `packages/payload/src/migrations/homework-prior-work.test.mjs`:

```sh
node --test packages/payload/src/migrations/homework-prior-work.test.mjs
```

The test accepts PostgreSQL 16 or newer. `MOYO_PG_TEST_BIN` selects an explicit local installation; otherwise it discovers `pg_config`, Linux package directories and Homebrew paths. It creates a fresh private directory under the operating system's temporary directory, checks for 1.25 GB free, and builds a child environment without inherited database connection variables. It does not load repository `.env` files. Password/service files are explicitly disabled. Default socket mode starts a server accepting only a Unix socket in that private directory, with TCP listening disabled and a random port number. Cleanup stops only that scratch data directory's server.

`MOYO_PG_TEST_REQUIRED=1` fails if binaries are unavailable, so the new `homework migration and crop retention` CI job cannot pass through a skip. The migration test is also included in the normal Payload test script. `MOYO_PG_TEST_REPOSITORY=1` additionally runs five scenarios against the actual homework repository and Payload PostgreSQL adapter. Its test-only module loader substitutes unrelated auth/evidence/report imports, while keeping the repository functions, collection definitions, transaction adapter and database real. A separate connection holds the row before each race; the test observes both competing operations waiting on PostgreSQL locks before release. The scenarios cover mark-before-start, start-before-mark, simultaneous mark history, duplicate advances with marked-question skipping and resume, and all-marked reopening/learner scoping.

For environments that prohibit listening sockets, `MOYO_PG_TEST_MODE=single` executes the SQL with PostgreSQL's single-user backend. This mode opens no server or socket, rejects any SQL error, and requires both assertion markers. It cannot run the repository concurrency checks and refuses a request combining those modes.

The SQL sequence uses the checked-in files directly:

1. `src/migrations/fixtures/homework-admin-lock.sql` creates `payload` and a minimal `payload_locked_documents_rels` table. This satisfies the original homework migration's admin-lock column/foreign-key additions; it is not a full Payload schema bootstrap.
2. `migrations/homework_additive.sql` creates the existing homework schema.
3. `src/migrations/fixtures/homework-legacy.sql` inserts synthetic legacy data and snapshots the complete question row, including its crop and attempted outcome.
4. `migrations/homework_prior_work_additive.sql` runs once. Assertions require defaults `none`/null/empty history and exact preservation of all legacy fields. A guardian mark and generic source history are then written and snapshotted.
5. The same prior-work migration runs again. Assertions require unchanged mark/history, crop and learning outcome; the enum must match `none`/`partial`/`complete` and reject `correct`.
6. Synthetic expired and live crops are snapshotted. The complete production `src/retention/sweep.sql` runs, with empty minimal tutor-session/transcript prerequisites. Assertions require removal of only the expired crop, exact preservation of mark/history/text/outcome, and an unchanged live control row. This tests crop retention, not the account erasure cascade.

## Latest executed verification

The selected Linux workspace had no PostgreSQL installation or system package helper. PostgreSQL 18.0 was built into a task-owned directory from the [official source archive](https://ftp.postgresql.org/pub/source/v18.0/postgresql-18.0.tar.bz2); its SHA-256 matched the [official checksum](https://ftp.postgresql.org/pub/source/v18.0/postgresql-18.0.tar.bz2.sha256): `0d5b903b1e5fe361bca7aa9507519933773eb34266b1357c4e7780fdee6d6078`. No system service, production connection or privilege escalation was used.

`initdb` succeeded. Default socket mode then failed while binding its freshly minted Unix socket with `Operation not permitted`, before any SQL ran. The log was retained for diagnosis; no shared service was stopped or changed.

The explicit single-user check then passed:

```sh
MOYO_PG_TEST_REQUIRED=1 MOYO_PG_TEST_MODE=single \
  MOYO_PG_TEST_BIN=/path/to/postgresql/bin \
  node --test packages/payload/src/migrations/homework-prior-work.test.mjs
```

Observed: PostgreSQL 18.0; one passing test, zero failures, zero skips. Both SQL markers were returned:

```text
PASS: legacy defaults; unchanged legacy row/crop/outcome; guardian mark/history; idempotent rerun; enum rejection
PASS: expired crop removed; mark/history/text/outcome retained; live crop unchanged
```

The existing prior-work cursor/report tests passed 8/8, and the complete app server suite passed 132/132. Payload TypeScript and configured lint for the changed JavaScript files passed, as did Node syntax checking and `git diff --check`. The new repository concurrency child imports and minimal Payload config were checked, but its database operations remain unexecuted locally while socket creation is unavailable; CI must execute it before merging this follow-up. Production schema application, full account erasure and deployed phone acceptance are not established by these checks.

## Earlier macOS attempt

The first run used `/private/tmp/moyo-homework-scratch-2vf3eN`, with intended socket port 51730. PostgreSQL reported:

```text
postgres (PostgreSQL) 18.7 (Homebrew)
running bootstrap script ...
2026-11-14 05:31:16.247 UTC [45771] FATAL: could not create shared memory segment: Operation not permitted
DETAIL: Failed system call was shmget(key=527107729, size=56, 03600).
child process exited with exit code 1
initdb: removing data directory "/private/tmp/moyo-homework-scratch-2vf3eN/data"
```

`initdb` exited 1 before server startup. No PostgreSQL service started, no socket was opened by a running scratch server, and no SQL was applied. The test reported one failed initialization assertion. No retry, privilege escalation, canonical database connection or cloud substitution was attempted. The remaining scratch directory was empty apart from its empty socket directory (0 KB reported by `du`). Free space after the failure was approximately 2.17 GB.

At that earlier checkpoint, `node --check packages/payload/src/migrations/homework-prior-work.test.mjs` and `git diff --check` passed, but the SQL assertions had not executed. The later Linux single-user result above supersedes only that migration/crop-retention evidence gap.
