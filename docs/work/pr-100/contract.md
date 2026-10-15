# PR #100 shared contract

Decisions taken 2026-10-15 with the owner:

1. Skills run from the global harness; Mobbin pass uses the Mobbin MCP tools directly.
2. Migrations are hand-written idempotent SQL in `packages/payload/migrations/`, verified by `tooling/check-schema-applied.mjs`. No `payload migrate:create`.
3. `expo-print ~58.0.2` and `expo-sharing ~58.0.11` (MIT) are approved for `apps/mobile`.
4. Source crops expire 7 days after capture (`MEDIA_TTL_DAYS`). Corrected text outlives the image.

Types: `packages/app/features/homework/homework.types.ts`. Every agent imports from there and adds nothing to it without a note in its log.

## Data (B1 owns)

| Collection | Table | Key | Retention |
| --- | --- | --- | --- |
| `homeworkSubmissions` | `payload.homework_submissions` | `submissionId` unique | no `expiresAt`; erased by the account cascade |
| `homeworkQuestions` | `payload.homework_questions` | `questionId` unique; `(submissionId, orderIndex)` unique | row durable; `crop` nulled when `cropExpiresAt < now()` |
| `homeworkPracticeSets` | `payload.homework_practice_sets` | `practiceSetId` unique | durable; erased by cascade |

Fields follow `HomeworkSubmissionView`, `HomeworkQuestionView`, `PracticeSetView`. `revisions`, `crop`, `misconceptionTags`, `items` are `json` columns, as `tutorSessions.messages` is. Identity columns are `learner_auth_id`, `created_by_auth_id`, `guardian_auth_id` text pointers, never relationships to `users`. `versions: false`.

Evidence binding (ADR-119 extension): confirming a question issues an `edu.questions` row with `question_id = questionId`, `revision = currentRevision`, `problem_digest = problemDigest(text)`, `evaluation_ready = false`. A revise re-issues with the new revision. The evaluator keeps refusing photographed pages.

Erasure: both learner collections join `SUBJECT_COLLECTIONS` in `apps/web/lib/account-deletion.repository.ts`; `sweep.sql` gains the crop-null statement; `erasure.integration.test.mjs` covers the new tables.

## Routes (B1 owns the handlers; B2, B3, B4, B5 consume)

All under `protectedOperation`. The ward check is `loadGuardianWards(ctx)` and the target learner must be in it, or equal `ctx.learnerId`.

| Method and path | Body / query | Returns |
| --- | --- | --- |
| `POST /api/homework/submissions` | `CreateSubmissionInput` | `HomeworkSubmissionView` (200 on retry with the same `submissionId`) |
| `GET /api/homework/submissions?learner=<authId>` | | `HomeworkSubmissionSummary[]` newest first |
| `GET /api/homework/submissions/[submissionId]` | | `HomeworkSubmissionView` |
| `POST /api/homework/submissions/[submissionId]/questions/[questionId]/revise` | `ReviseQuestionInput` | `HomeworkQuestionView` |
| `POST /api/homework/submissions/[submissionId]/start` | `StartSubmissionInput` | `HomeworkSubmissionView` |
| `POST /api/homework/submissions/[submissionId]/advance` | `AdvanceInput` | `AdvanceResult`; `409 { error: 'stale-cursor', current: AdvanceResult }` |
| `GET /api/guardian/wards` | | `{ learnerAuthId, displayName, gradeBand }[]` from active guardianships |
| `POST /api/guardian/practice-sets` | `{ submissionId }` | `PracticeSetView` (draft) |
| `POST /api/guardian/practice-sets/[practiceSetId]/approve` | | `PracticeSetView` |
| `GET /api/guardian/practice-sets/[practiceSetId]/print?mode=sheet\|key` | | HTML, same headers as the report print route |

`advance` runs in one Payload transaction (`payload.db.beginTransaction` and `req` threading) so the outcome write and the cursor move land together or not at all.

## Client (B2 owns)

`packages/app/features/capture/worksheet.store.ts` becomes the cache of a `HomeworkSubmissionView`: `hydrate(submissionId)`, `advance(input)` with an optimistic cursor and reconciliation on `409`, `revise(questionId, input)`. MMKV id `capture`, key `homework-submission-v2:<learnerAuthId>`. `useTutorStore` and `tutor-screen.tsx` read the current question from it. Separate question bubbles and the first-load hydration guard stay as they are.

## Report (B4 owns)

`generateSessionSummary` reads `homeworkQuestions` for the session's linked submission and emits one `ProblemRow` per question with a new `QuestionRef` arm `{ kind: 'homework-question', questionId, text }`. Outcome maps to `ProblemStatus`: `solved-independently` → `solved-independently`; `supported-with-hints` → `solved-with-help`; everything else → `still-working`. The print route gains per-question outcome rows. Narrative never sees transcripts.

## Practice sets (B5 owns)

Generator: deterministic templates per skill tag, seeded. Checker: `packages/student-model/src/exact-math.ts:checkExactMath`. Every item's `answer` is verified by the checker before the set is saved; a failing item is dropped and logged. HTML for sheet and key comes from one pure module in `packages/app/features/homework/practice-sheet-html.ts`, used by the web print route and by `expo-print` on native, then `expo-sharing`.

## File ownership

| Agent | Writes only under |
| --- | --- |
| B1 | `packages/payload/**`, `apps/web/lib/homework.repository.ts`, `apps/web/lib/account-deletion.repository.ts`, `apps/web/lib/retention.repository.ts`, `apps/web/app/api/homework/**`, `apps/web/app/api/guardian/wards/**`, `packages/app/features/homework/homework.service.ts`, `packages/app/features/homework/*.server-test.ts`, `packages/app/server.ts` (exports only), `docs/decisions/adr-124-*.md`, `docs/work/pr-100/b1.md` |
| B2 | `packages/app/features/capture/worksheet*.ts`, `packages/app/features/capture/capture-screen.tsx`, `packages/app/features/capture/worksheet-review.tsx`, `packages/app/features/homework/homework.client.ts`, `packages/app/features/tutor/tutor-screen.tsx`, `packages/app/features/tutor/tutor.store.ts`, `docs/work/pr-100/b2.md` |
| B3 | `packages/app/features/family/**`, `packages/app/features/home/guardian-home-screen.tsx`, `packages/app/features/home/parent-home-content.tsx`, `packages/app/features/homework/guardian-*.tsx`, `packages/app/features/homework/use-*.ts`, `apps/mobile/app/(guardian)/**`, `apps/web/app/(guardian)/**`, `docs/design/mobbin/homework-*.md`, `docs/work/pr-100/b3.md` |
| B4 | `packages/app/features/summary/**`, `apps/web/lib/printable-homework*.ts`, `apps/web/app/api/guardian/reports/**`, `docs/work/pr-100/b4.md` |
| B5 | `packages/app/features/homework/practice-*.ts(x)`, `packages/student-model/src/practice-*.ts`, `apps/web/app/api/guardian/practice-sets/**`, `apps/mobile/package.json`, `pnpm-workspace.yaml` (two catalog lines), `docs/work/pr-100/b5.md` |
