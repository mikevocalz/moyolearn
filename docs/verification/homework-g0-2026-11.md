# Homework upload G0 source audit

Date: 2026-11-14 UTC (2026-11-13 America/New_York). Source: `main` at `599456a7`.

G0 is incomplete. This audit inspected source and attempted one server test. The required parent-to-child phone run against the deployed backend has not happened. The coordinating device inventory found no reachable phone or Quest. No deployed schema, sign-in session, uploaded worksheet, or real-page evaluation set was inspected. No migration was applied and no feature code changed.

## Decision

The automatic prior-work pass is blocked at the photograph/per-question crop seam. The build prompt requires stopping when the photograph model path cannot take a per-question crop. The existing submission flow supplies no question crops, and its OCR contract supplies text detections rather than a prior-work classification. A verified question-to-stored-crop/model classification path is unestablished; this does not prove that the model cannot accept a cropped image. Implementing a classifier against an invented photo-model API would violate the prompt.

The prompt's guardian-ticked fallback needs a scoped follow-on: data and revision contracts, transaction-safe cursor selection, review UI, report treatment, and tests. This audit does not implement or claim that fallback. Automatic detection must remain off until the crop path and a real-page precision evaluation are established.

## Inspected seams

| Seam | Source finding |
| --- | --- |
| Parent entry | `apps/mobile/app/(guardian)/upload.tsx:GuardianUploadRoute` mounts the existing capture flow. |
| Capture submission | `packages/app/features/capture/capture-screen.tsx:startWithNatalie` validates subject/questions and sends every question with `crop: null`. Its source comment records that capture pages lack a storage key and pixel dimensions. Guardian creation returns to `/homework`; it does not start a child tutor session on the guardian device. |
| Native photograph reading | `packages/app/features/capture/read-attachment.native.ts:readAttachmentEvidence` loads `OCRModule.fromModelName(OCR_ENGLISH)` and delegates to `createNativeOcrReader`. |
| Native model contract | `packages/app/features/capture/native-ocr-evidence.ts:createNativeOcrReader` calls `model.forward(source)`. `nativeOcrEvidence` returns text, detection boxes, scores, and `masterTransform: 'unverified'`; scores describe recognition confidence. There is no `none`/`partial`/`complete` prior-work result. Boxes cannot be treated as verified master-image question crops. |
| Browser photograph reading | `packages/app/features/capture/ocr-web.ts:readHomework` calls `readPrinted`, which runs Tesseract. `readHandwriting` is a separate line-oriented TrOCR path. Neither contract identifies completed child work or distinguishes teacher marks and printed examples. |
| Question extraction | `packages/app/features/capture/worksheet-questions.ts:extractWorksheetQuestions` segments confirmed text with page and source numbers. `WorksheetQuestion` has no image region or crop reference. |
| Service authorization | `packages/app/features/homework/homework.service.ts:ownerFor` resolves ownership and calls `assertCanActFor`; active guardian wards govern cross-learner access. `reviseQuestionFor` currently accepts a caller-supplied transcription author and does not implement a guardian-only prior-work revision. |
| API and errors | `apps/web/app/api/homework/_shared.ts:homeworkPorts` binds repository ports. `homeworkError` maps unknown and forbidden submissions to 404, invalid input to 400, and submission conflicts to 409. Existing revision route is `submissions/[submissionId]/questions/[questionId]/revise/route.ts`. |
| Persisted data | `packages/payload/src/collections/HomeworkQuestions.ts:HomeworkQuestions` has transcription revisions, crop/expiry and learning outcomes. `packages/app/features/homework/homework.types.ts:HomeworkQuestionView` mirrors them. No prior-work fields were found in these contracts. Versions are disabled to prevent crop retention in history. |
| Creation/pipeline | `apps/web/lib/homework.repository.ts:createSubmission` persists confirmed questions with `status: 'ready'`, `pipelineStatus: 'extracted'`, and cursor index 0. Capture's upload queue precedes this creation; a submission-owned extraction worker was not found in the inspected path. |
| Start | `apps/web/lib/homework.repository.ts:startSubmission` updates session/status without a row lock and leaves the existing cursor unchanged. Adding a cursor selection here requires the same transaction/row ownership discipline as advance. |
| Advance | `apps/web/lib/homework.repository.ts:advanceSubmission` requires a transaction and locks `payload.homework_submissions FOR UPDATE`, scoped to learner/submission. It compares expected index, rejects completed/stale moves, writes outcome, and advances by exactly one in that transaction. Prior-work skipping belongs inside this existing writer. |
| Mid-problem boundary | `advanceSubmission` stamps the next question's `startedAt` immediately. `startSubmission` does not mark the first question started. A safe “between problems” revision boundary is not currently explicit; it must be specified before allowing edits during an in-progress submission. |
| Reports | `packages/app/features/summary/homework-rows.ts:homeworkFacts` counts learning outcomes; `homeworkProblemRows` and `homeworkNextStep` include all questions. Prior-work must remain separate from outcomes and be excluded from “still working” recommendations as appropriate. |
| Retention | `apps/web/lib/homework.repository.ts:asCrop` hides expired crops at read time. `packages/payload/src/retention/sweep.sql` nulls expired question crops. `packages/payload/src/retention/erasure.integration.test.mjs` includes crop sweep and guardian-upload erasure cases. New fields must not add image copies. |

## Migration and deployed-schema evidence

`packages/payload/migrations/homework_additive.sql` is the checked-in additive schema. `docs/work/pr-100/b6.md` records two successful scratch-database passes and explicitly separates that work from production and the outstanding device walk-through. It is not evidence that the currently deployed backend has the schema.

`tooling/check-schema-applied.mjs` probes tables and additive columns from checked-in SQL against an explicitly supplied database connection. No connection was read or used in this audit. The installed Payload configuration sets generated type output in `packages/payload/src/payload-types.ts` (`payload.config.ts:typescript.outputFile`). Package dependencies were unavailable for validating installed Payload select/number types or running type generation.

## Checks actually run

Command, from `packages/app`:

```sh
node --test --conditions=react-server features/homework/homework.server-test.ts
```

Result: exit 1 before tests executed, `ERR_MODULE_NOT_FOUND: Cannot find package 'server-only'`. Node reported v24.19.0. This is a dependency-resolution blocker, not a failed authorization assertion. Existing tests cover revoked wards, sibling isolation, stale cursor behavior, and unready evidence, but they were not verified in this run. Typecheck, lint, database tests, web/mobile builds and device acceptance were not run.

## Follow-on implementation boundaries

1. Restore the repository's locked dependencies and verify the existing gates before changes.
2. Complete the deployed phone G0 run and check the exact backend schema through an authorized connection; retain raw evidence without child images beyond existing expiry.
3. Resolve whether guardian-only prior-work marks should proceed while automatic detection is blocked. Specify guardian identity, append-only revision attribution, all-done reopening, and the between-problems boundary.
4. For that scoped fallback, add separate prior-work fields with conservative defaults, an additive migration and generated types; use the submission row lock for start, advance and prior-work revisions. Preserve existing outcome and evidence semantics.
5. Add tests for first-undone selection, interior skips, all-done, untick/reopen, forbidden families, active-question edit denial, concurrent cursor/revision operations, report exclusion, erasure and crop expiry. Then wire existing review/progress/timeline surfaces.
6. Revisit automatic classification only after a source-linked question crop can reach a verified model contract. Record at least 20 real pages, confusion counts and complete precision before enabling it. No evaluation results exist from this pass.

## Skills used

Read the repository-local `api-design` and `react-native-vision-camera` skills for API/capture audit guidance, and the installed `no-ai-slop` skill for this report. No camera API, native module or dependency was changed. The specialized prior-work research/design/precision procedures remain outstanding; no such skill load or output is claimed here.
