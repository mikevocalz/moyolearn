# Homework prior-work migration scratch check

Date: 2026-11-14. Result: blocked during local PostgreSQL initialization. No migration SQL ran.

The regression is `packages/payload/src/migrations/homework-prior-work.test.mjs`:

```sh
node --test packages/payload/src/migrations/homework-prior-work.test.mjs
```

It uses the matching PostgreSQL 18 binaries in `/opt/homebrew/opt/postgresql@18/bin` (18.7 Homebrew on this host). `MOYO_PG_TEST_BIN` can select another local installation. It creates a fresh private `/private/tmp/moyo-homework-scratch-*` directory, checks that at least 1.25 GB is free, and builds a child environment without inherited database connection variables. It does not load repository `.env` files. Password/service files are explicitly disabled. The intended server accepts only a Unix socket in that private directory, with TCP listening disabled and a random port number. Its cleanup stops only that scratch data directory's server.

The planned SQL sequence uses the checked-in files directly:

1. `src/migrations/fixtures/homework-admin-lock.sql` creates `payload` and a minimal `payload_locked_documents_rels` table. This satisfies the original homework migration's admin-lock column/foreign-key additions; it is not a full Payload schema bootstrap.
2. `migrations/homework_additive.sql` creates the existing homework schema.
3. `src/migrations/fixtures/homework-legacy.sql` inserts synthetic legacy data and snapshots the complete question row, including its crop and attempted outcome.
4. `migrations/homework_prior_work_additive.sql` runs once. Assertions require defaults `none`/null/empty history and exact preservation of all legacy fields. A guardian mark and generic source history are then written and snapshotted.
5. The same prior-work migration runs again. Assertions require unchanged mark/history, crop and learning outcome; the enum must match `none`/`partial`/`complete` and reject `correct`.

## Observed failure

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

`node --check packages/payload/src/migrations/homework-prior-work.test.mjs` and `git diff --check` passed. The SQL assertions remain unexecuted. This artifact provides no production schema, service transaction, concurrency, retention or erasure evidence.
