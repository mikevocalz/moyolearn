# What is checked in but not applied, measured 2026-09-22

Written because there is no ledger to ask. `payload.payload_migrations` holds
**one** row — `name: dev`, `batch: -1`, `created_at: 2026-08-26` — against **33**
checked-in files in `packages/payload/migrations/`. Those files are applied by
hand, and nothing records which have been. The only way to answer the question is
to probe production for the objects each one creates, which is what this is.

## Method

For every migration, the first `CREATE TABLE` (or `ADD COLUMN`) target was
extracted and checked with `to_regclass` against production. Read-only.

## Result — one gap, plus the two this week's work adds

| Migration | Target | State |
|---|---|---|
| `edu_questions.sql` | `edu.questions` | **NOT APPLIED** |
| `jobs_pgboss_schema_38_to_42.sql` | `jobs.version` → 42 | not applied — new, see ADR-123 |
| `learner_email_verified_backfill.sql` | 14 learner rows | not applied — new, see the login incident |

Nineteen of the twenty checkable targets are present:
`payload.{assignment_completions, assignments, classes, enrollments, families,
handoff_codes, incident_reports, leads, organizations, safety_events,
session_summaries, sessions, tutor_engagements, tutor_sessions}`,
`edu.{blocked_tags, embeddings, inference_budget, transcripts}`, `jobs.version`.

So the drift is not broad. It is one file, and it has been unapplied long enough
that the code shipped past it.

## The `edu.questions` gap

`edu.questions` does not exist. The same migration also adds two columns to a
table that does exist:

```sql
ALTER TABLE "edu"."transcripts" ADD COLUMN IF NOT EXISTS "question_id" "edu"."opaque_id";
ALTER TABLE "edu"."transcripts" ADD COLUMN IF NOT EXISTS "revision"    "edu"."opaque_id";
```

Neither column is present — `edu.transcripts` carries only its original set. So
the migration did not partially apply; it never ran at all.

This is a live defect independent of the pg-boss decision, and it is not fixed by
choosing either branch: the file is checked in on the deployed lineage and the
code that reads it shipped without it. It needs its own issue, with the querying
path named before anything is applied — a table that has been absent for weeks
may have a read path that has been failing silently for just as long, which is
the same shape as the drain outage.

## The actual finding

Not the one missing table. It is that **a hand-applied migration directory with a
ledger that records nothing cannot answer "is production up to date?"** — the
question had to be answered by probing twenty objects one at a time. Both live
incidents open on 2026-09-22 have the same root: a state the code asserts and
nothing checks. `jobs.test.ts` now holds the pg-boss half of that; the payload
half has no equivalent.
