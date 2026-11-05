# PR #123 checkpoint: worksheet discovery, child isolation, question identity

<!-- What: three correctness fixes found while wiring the guardian practice route. -->
<!-- Why: an empty device could not see guardian-assigned work; switching children could show a sibling's rows; identical question wording could mis-attach worksheet state. -->
<!-- SOT: worksheet-cache.ts; use-homework-timeline.ts; worksheet.store.test.ts; tutor-screen.tsx. -->
<!-- SOT-KEYWORDS: homework pr123 worksheet discovery cursor epoch child switch question identity handoff -->

## Delivered

### 1. Cold-device worksheet discovery

`hydrate()` previously returned `null` whenever the device had no cached
record, so a learner opening a second device never saw homework a guardian
uploaded for them. Now a cache miss tries the v1 migration, then calls the new
`HomeworkClient.listSubmissions()` — `GET /api/homework/submissions` with the
caller identity coming only from the session — filters to the requesting
learner, prefers an `in-progress` then `ready` submission, fetches its view,
and commits it as `confirmed`.

While discovery is in flight the store is `syncing`; a network failure is
`pending`, an authorization failure `error`, and "no open worksheet" is `idle`.
An explicit `submissionId` argument restricts discovery to that row.

A per-owner selection epoch now guards every async commit (`hydrate`,
`begin`, `start`, `advance`, `revise`, flush). A response that lands after the
learner changed — or after `clear` ran — is discarded instead of resurrecting
the wrong worksheet. Server views whose `learnerAuthId` does not match the
requesting learner are rejected and never written to that learner's cache key.
Cached records are also validated to own their learner on read.

### 2. Child-switch placeholder leak

`useHomeworkTimeline` used `keepPreviousData`, so switching children briefly
rendered the previous child's rows under the newly selected name. The
placeholder was removed; a different query key means a different child, so the
hook now shows that child's own loading state. Verified in Chromium: with the
submissions fetch delayed 10 s, selecting the second child showed skeletons,
then "No homework for PR123 Second Learner yet" — never the first child's
worksheet.

### 3. Duplicate-question identity

`activeWorksheet` compared the tutor problem's text to the worksheet prompt.
A worksheet with two identically worded questions could attribute turns to the
wrong question and advance the cursor wrongly. `isCurrentWorksheetQuestion`
now requires the server-issued evidence handle (`questionId` +
`currentRevision`) when the prompt is ambiguous; an unambiguous prompt still
matches without evidence for sessions that predate the handle.

## Verification

- `worksheet.store.test.ts`: 12/12 — including new tests for cold discovery,
  finished-vs-active selection, offline discovery, late-hydrate and
  clear-mid-flight races, and duplicate-wording identity. Each test failed
  against the pre-change code first.
- `homework.client.test.ts`: 7/7 — including that `listSubmissions` sends no
  identity parameter.
- `guardian-homework-timeline.test.ts`: 8/8 — including the new QueryObserver
  test that proved the sibling-rows bug before the fix.
- `@acme/app` ESLint on all touched files: clean. `tsc --noEmit`: clean.
- Browser: delayed-response child switch shows only loading, then the second
  child's own empty state.

Logs: `.scratch/pr123/{cold-discovery,child-switch,question-identity}-*.log`.

## Open work

- iOS arm64 simulator build is running; the previous attempt failed on disk
  space after Pods compiled (~8.9 GiB DerivedData removed with user approval).
- `use-homework-timeline` still exposes no in-flight discovery hook for the
  tutor's initial entry; `hydrate` covers it but screen-level copy may want a
  "still checking" state.
- Generated iOS project files (`project.pbxproj`, `Podfile.lock`,
  `PrivacyInfo.xcprivacy`) and the user-edited `payload-types.ts` remain
  uncommitted pending review.
- Crop persistence, native print/share runtime evidence, physical-device QA,
  GitGuardian findings and the WebGPU freshness gate remain open.
