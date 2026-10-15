# Homework experience: ten questions, one at a time

Status, 2026-10-15: the capture/question-navigation and report-printing work on
this branch is a **draft first slice**, not a production-complete end-to-end
feature. The authenticated, cross-device worksheet evidence store, guardian
uploads, new assessments and native PDF generation remain required work.

## The job

The learner or an authorized parent chooses the child and subject, attaches
paper/PDF/photos/voice/typed work, watches actual extraction progress, checks
the original against ten separate questions, corrects misread handwriting
and signs, then starts question one with Natalie. The other nine questions
must not be dumped into a single tutor prompt.

Natalie coaches steps, records honest attempts, hints, skips and misconceptions,
and never just reveals the solution. A parent sees a date-labeled session with
question-by-question evidence, skill gaps, and a professionally formatted
generated follow-up assessment they can save as PDF and print.

## Screen contract

| Screen | Primary action | Truth the screen must show |
| --- | --- | --- |
| Student Today | Resume Q4/10 or choose subject and Snap | Current, real submission and saved cursor |
| Parent Home | Select child, Upload work for child, latest work | Guardian's actual wards, never placeholder children |
| Capture | Choose Math/Reading/Science/etc., take photos/import PDF | Source files, pages, reliable OCR status, retries |
| OCR Review | Check source side-by-side, correct individual question popup | Raw versus corrected text, exact ordering and count |
| Homework Ready | Start Q1 of 10, optional revisit before starting | Reviewed source, captured date, title and subject |
| Natalie Tutor | Attempt Q1, ask for hints, explicit next/skip/revisit | Current question, 1/10 progress, no next answer in prompt |
| Student Activity | Resume or revisit any unfinished question | Only source-backed attempted/completed statuses |
| Parent Daily Work | Read what was worked on and struggled with | Child, date, 10-question count, attempts and evidence |
| Parent Assessment | Generate fresh adaptive practice, review, print | Actual target misconceptions and verified answer key |
| PDF | Print/download report, assessment and key | Paginated math-compatible PDF, not a UI screenshot |

Phone uses a single stack with explicit next/back; tablet/foldable exposes a
source page and editable question inspector in a hinge-safe AdaptivePanes pair.
Never require a secondary pane to access a function. Maintain the existing
Natalie stage, whiteboard, scene placement and XR entry.

Correction dialog needs original image crop, one editable question, cancellation,
undo, confidence notice and explicit save. Include add/remove/reorder, two-column
scan warning, unequal question count warning, inaccessible camera fallback,
permission handling, offline drafts and native handwriting examples. A transfer
marked done is not the same as parsing done.

## State of implementation

First-slice: conservative numbered-question parser, failure-to-split warnings,
review/correction dialog, per-learner device-local question cursor, exact first
question sent to Natalie, explicit next-question control, and guardian-authorized
browser printing from existing authentic session reports. Follow-up print sheets
reuse previously difficult source questions, not novel AI-generated tests.

Critical remaining work:

1. Add Payload homework submissions and question revisions to the existing
   database, without introducing a second data system. Raw OCR and corrected
   revisions must be retained with source crop, confidence, correction author,
   ordering, subject, child, local date, tutor session reference and state.
   Migrations are additive; update the existing erasure/retention cascade.
2. Authorize student self-upload and guardian child selection via active
   guardianships, never a trusted childId in client JSON. Keep child-owned
   data isolated from siblings and other families.
3. Persist OCR/process pipeline status, per-page recoverable failures and
   idempotent processing jobs. Preserve math notation and column reading order.
4. Adopt each confirmed question on the trusted server and atomically advance
   its cursor. Source text is not yet verified mathematical grading evidence;
   preserve assessment-readiness refusal. Persist attempts, hints, skips,
   server-issued question/revision IDs and misconception tags.
5. Merge submission/date grouping with existing session-summary reports,
   then create accurate parent timeline/counts and child switcher.
6. Generate NEW curriculum-aligned assessment questions from supported skill
   gaps, verify solution/answer key independently, provide parent review,
   generate real PDF and separate answer key, add native Expo print/share.
7. Run real-device, server and database E2E before any production merge.

## Accuracy, consent and security

A corrected OCR transcription is **not** a scored problem. The student can
confirm what a page says, but the evaluator still needs server-owned question
provenance. Never claim completion merely because the student pressed Next.
Distinguish unattempted, skipped, attempted, supported with hints, independently
solved and unresolved. No fabricated proficiency score, no automatically
shared raw work, no learning-derived CRM sales targeting. The guardian report
must be restricted to active wards and preserve deletion rights.

All documents print from authenticated, authorized endpoints with private,
no-store cache controls. Answer keys are guardian-only; original media needs
signed URLs with expiry, not plain CDN keys. Failed uploads must retry without
a second homework record. Errors must never masquerade as zero work.

## UX references and skills

Mobbin structure-only references:
- https://mobbin.com/screens/9c8e39a1-23fe-4f31-8d45-cda3c44e3ccc — Google photo-homework entry
- https://mobbin.com/screens/2c66cb2e-4d24-4048-a31f-e096aebc990a — Quizlet study flow
- https://mobbin.com/screens/eb2dfe9f-185e-4fdc-887c-611714a660bc — Brilliant study stage
- https://mobbin.com/flows/4a43592e-d21d-4f08-83c3-6c36e9dadea4 — Brilliant guided lesson

Use pinned Moyo foldable/duo design guidance, expo/skills, React Native and
native testing skills, Anthropic frontend-design, Google stitch-skills,
ui-ux-pro-max-skill, FloWritesCode swiftui-iphone-duo adaptive principles,
Mobbin for flow references, mattpocock/skills, Argent/agent-device,
pbakaus/impeccable, petergyang/no-ai-slop. Keep semantic @acme/ui components,
repo tokens, Kinetrell-only animations, Zustand state, and existing Payload
and tutoring safety boundaries. Only the standalone print document is HTML;
do not build app screens from raw HTML.

Engineering reviewers: principal learning-product designer, staff Expo/Solito
engineer, foldable/adaptive specialist, math OCR expert, principal Payload
engineer, learning-science/assessment expert, tutor safety engineer, privacy
reviewer, accessibility lead, and device/CI QA owner.

## Release acceptance — real 10-question sheet

- [ ] Ten printed math problems become ten ordered source-backed records.
- [ ] Minus/fraction handwriting OCR error is corrected and logged before start.
- [ ] Q1 coach context contains only Q1, never Q2–10 or the answer.
- [ ] Skips, hints, attempts and independent grades are correctly distinguished.
- [ ] Q4 and ink resume on a second device, even after an app restart.
- [ ] Parent sees today's worksheet for the correct child, with real evidence.
- [ ] Guardian cannot guess/access another child's report or answer key.
- [ ] Fresh adaptive assessment is mathematically verified before delivery.
- [ ] Assessment PDF, answer-key PDF and report print with correct pagination.
- [ ] Upload retries, offline, fold/unfold and changed guardian memberships pass.
- [ ] Privacy erasure covers image, OCR revisions, notes, assessment and exports.
- [ ] Full app typechecks, migrations and real-device end-to-end tests pass.

A passing parser unit test does not close the acceptance checklist.
