# ADR-124: a captured worksheet is a server row, and the device caches it

Status: proposed. Collections, repository, service and routes are in code; migration `homework_additive.sql` has been applied only to a scratch Postgres, twice, to prove it parses and is idempotent. No shared database has it.
Date: 2026-10-15

## Problem

The first worksheet slice kept the whole worksheet in a device-local Zustand store keyed by owner (`packages/app/features/capture/worksheet-session.ts`, MMKV key `capture-worksheet-v1:<ownerId>`). Three things followed from that, and none of them could be fixed on the device:

1. A child who started question 4 of 10 on a phone could not resume on the family laptop. The cursor existed in one place.
2. A guardian could not see what was done or upload for a child. There was no row to read and no owner to check against.
3. Captured questions never received server evidence. `issueEduQuestion` ran only from `/api/tutor/next`, so a photographed question had no `edu.questions` row at all. The evaluator refused it, which was correct, but by accident rather than by a recorded `evaluation_ready = false`.

## Decision

Three Payload collections in schema `payload`, all `versions: false`:

| Collection | Key | Retention |
| --- | --- | --- |
| `homeworkSubmissions` | `submissionId` unique, client-minted | no `expiresAt`; account cascade only |
| `homeworkQuestions` | `questionId` unique; `(submissionId, orderIndex)` unique | row durable; `crop` nulled 7 days after capture |
| `homeworkPracticeSets` | `practiceSetId` unique | no `expiresAt`; account cascade only |

Identity columns are `*AuthId` text pointers to Better Auth users, never relationships. Collection access is "signed in"; scoping is in `apps/web/lib/homework.repository.ts`, which only runs after `homework.service.ts` has applied the ward rule: the target learner is `ctx.learnerId` or is in `loadGuardianWards(ctx)` (ACTIVE guardianships), else `Forbidden`.

The cursor (`currentIndex`, `currentQuestionId`) lives on the submission. `advance` takes the index the client believed was current, locks the submission row `FOR UPDATE` inside a Payload transaction, compares, writes the outgoing question's outcome and moves the cursor, then commits. A mismatch rolls back and answers `409 { error: 'stale-cursor', current }`.

Confirming a question (create, or revise) issues an `edu.questions` row: `question_id = questionId`, `revision = currentRevision`, `problem_digest = problemDigest(text)`, `evaluation_ready = false`, `learner_id` = the child even when a guardian confirmed. The `false` is a literal in the service. ADR-119's evaluator keeps refusing photographed pages.

## Trade-offs

**`revisions` as a JSON column, not a Payload `array` field.** An array field is a side table with its own migration every time a revision gains a property, and the list is always read and written whole. `tutorSessions.messages` made the same call. The cost: Postgres cannot index or constrain a revision's fields, and append-only is repository discipline rather than a constraint. Accepted, because the only writer is one function and the only query against revisions is "give me all of them".

**The cursor on the submission, not a separate cursor table.** A separate table would let several cursors exist per worksheet (one per device or per session). The product has one: the child is on one question. Keeping it on the row means the lock that serialises `advance` is the same row the timeline reads, and a 409 can return the authoritative state without a join. If a future feature needs per-session cursors, that is a new table, added beside this one.

**Seven-day crop TTL as COPPA data minimisation.** The crop is a photograph of a child's page and can carry a name, a school, handwriting. The text the child or guardian confirmed is the record of work; the image only exists so the confirmation can happen. `MEDIA_TTL_DAYS` (7) is the shortest window in the product, the server stamps `crop_expires_at` at capture so a client cannot ask for longer, `sweep.sql` nulls the column after it passes, and the repository already reads an expired crop as `null` before the daily sweep runs. The cost is that a guardian opening a report after a week sees the text and no image. That is the intended trade.

## Erasure

`homeworkQuestions` (by `learnerAuthId`), `homeworkSubmissions` (by `learnerAuthId` or `createdByAuthId`) and `homeworkPracticeSets` (by `learnerAuthId` or `guardianAuthId`) are in `SUBJECT_COLLECTIONS`. `eraseSubjectPayload` additionally deletes the questions under submissions the subject uploaded for a ward first, because those rows carry the ward's id and would otherwise outlive the submission that grouped them.

## Rollback

Unregister the three collections from `payload.config.ts` and remove the routes. Drop nothing: the tables, enums and lock-table columns are additive, nullable where they touch existing tables, and harmless when nothing reads them. Clients fall back to the device-local worksheet store that B2 is replacing. Erasure keeps working, because `SUBJECT_COLLECTIONS` entries are removed in the same change that unregisters the collections.

## Validation

- `packages/app/features/homework/homework.server-test.ts`: revoked guardianship → `Forbidden`; sibling read → `Forbidden`; stale cursor returns `stale` with no write; revise issues `evaluationReady: false` bound to the child.
- `packages/app/features/homework/practice.server-test.ts`: revoked ward and learner caller → `Forbidden`; draft does not print.
- `homework_additive.sql` applied three times to a scratch Postgres 0-exit; the partial crop index, four unique constraints and three lock-table FKs present; the crop-null statement nulls an expired crop and keeps an unexpired one.
- `erasure.integration.test.mjs` covers the crop sweep and a guardian erasure across all three tables. Not run: it needs a migrated database in `.env`, and none was pointed at.
