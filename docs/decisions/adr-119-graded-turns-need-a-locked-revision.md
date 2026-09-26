# ADR-119: a graded turn is bound to a locked current question revision

Status: implemented in code; migration `edu_questions` not yet applied to any database.
Date: 2026-09-16

## Problem

`evaluateTutorTurn` has declared a `withCurrentEvidence` port since the assessment gate was written, and nothing implemented it. With no repository behind the port the service refused every turn, so `POST /api/tutor/evaluate` returned `isCorrect: null` for correct and incorrect answers alike. The only other signal available was `sourceReadiness: 'verified'` in the request body — a client asserting that its own source was checked, which is a claim and not evidence, and which a forged request could set.

The gate was correct and inert. A gate nothing can pass is indistinguishable from a broken grader from the child's side.

## Decision

The server records the question it asked, and a grade is only written inside a transaction that holds that record's current revision.

`edu.questions` holds one row per issued question: owner, organization, current revision, `problem_digest`, an `evaluation_ready` flag, and a seven-day gradable window enforced by a CHECK rather than by the caller. `GET /api/tutor/next` writes the row before it responds and returns `{ questionId, revision }` alongside the problem.

`withCurrentEduEvidence` opens a transaction, takes `select … for update` on the row scoped by `question_id` **and** `ctx.learnerId`, runs the assessment inside that lock, and commits the transcript on the same connection. A miss — no row, another learner's row, or a superseded revision — returns `null`, which the service reads as an ungraded turn. Re-issuing a question updates the revision in place, so a client still holding the previous one has nothing to match.

`edu.transcripts` gains nullable `question_id` and `revision`: what authorized each grade, recorded beside it.

## Why a digest and not the problem

Doc 12 §4 keeps raw text out of the educational store, and the standing assertion at the foot of `edu_schema.sql` fails any migration that adds an unconstrained string column. A question a child is working on is exactly the string that assertion exists to keep out. `AssessmentEvidence` therefore carries `problemDigest` — SHA-256, hex, inside `edu.opaque_id` — and the service compares `problemDigest(input.problem)` against it. A learner who edits one character of the problem cannot reproduce the digest, which is the same strictness the string comparison had, without the store holding the homework.

## What this does not close

Only server-composed practice problems are issued, so only they can be graded. A photographed page still has no durable document/page/question revision behind it and therefore still grades nothing — `docs/verification/homework-v3/docs-and-status.md` lists that work, and this ADR does not claim any of it.

The lock and the pooled connection are held for the whole callback, including the Safety Plane call. The lock is on one learner's own row so it blocks nobody else's turn; the connection is shared, which is doc 12 §8's one-Postgres trade-off reaching the tutoring path. If that pool becomes the ceiling, the fix is to classify before opening the transaction, not to drop the lock.

Distillation is enqueued after the transaction commits rather than beside the insert, because a job enqueued before a rollback would name a transcript that does not exist and complete silently.

## Validation

`problemDigest` mismatch, a superseded revision, a foreign learner, a foreign organization, an unready row and an expired row are each asserted to write nothing, in `packages/app/features/tutor/source-readiness.server-test.ts`. The client's persisted handle — round trip, malformed records, and a rejected write clearing rather than keeping the previous pair — is covered in `packages/app/features/capture/problem-evidence.test.ts`.

Neither suite touches Postgres. The row lock, the transactional transcript write and the re-issue race are argued from the SQL and are not covered by an automated test; they are unverified until the migration is applied and the path is exercised against a database.
