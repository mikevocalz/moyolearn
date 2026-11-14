# Homework and hands build gates

Date: initial audit 2026-11-14 UTC; follow-up source review 2026-11-14 America/New_York.
Reviewer: independent verifier subagent E. This reviewer writes no feature code.

## Verdict

Historical device baseline: Quest 3S `340YC10GC3014S` became reachable through Argent. Installed `com.moyolearn.app` reported version 1.0.0/code 1, last updated 2026-11-03 10:46:33. Launch timed out; subsequent accessibility inspection and activity metadata confirmed MainActivity foreground with React Native “Unable to load script” redbox. User confirmed the requested controllers-off-and-unpaired setup; hand input was not exercised. Dependency restoration encountered network errors and ENOSPC. Safe cache/build-output recovery and resulting space are recorded in `disk-recovery-2026-11.md`; this supersedes the initial no-cleanup state.

Latest owner-reported runtime status: Metro is now listening on 57756 and transforms are ready. The headset is asleep, with wake/user input and Argent restart pending. The candidate renderer has not been installed and exercised in a fresh APK. A ready bundler does not prove a successful hands-only run or deployed-backend phone journey.

Neither pass has satisfied G0 or any device acceptance gate. No merge or release sign-off is given. A source audit is not a successful parent-to-child run or a hands-only headset run.

The initial inventory reported no reachable phone or Quest and absent dependency directories; the follow-up above supersedes that inventory. Exact dependency restoration now permits package TypeScript checks and test suites. Device observations and build/test results are owner-supplied evidence unless explicitly marked independently checked below. This reviewer performed no dependency installation, build, test suite, migration, deployment, credential read, or physical-device interaction.

## Current working implementation review

A guardian-only prior-work fallback is now in the working tree. Automatic detection remains OFF. This is source work in progress, not a device-qualified or release-approved result. The initial-source table below is historical baseline evidence; start, cursor selection and question contracts have since changed.

The reviewed diff adds separate prior-work fields/revisions, guardian authorization, a submission row lock for start/revision/advance, first-undone selection, review marks and saved guardian review, learner progress marks, and report exclusion. Prestart edits only is the deliberately constrained fallback; the original between-problems revision criterion is still unmet. An additive migration and regenerated Payload types exist; database application and integration behavior remain unverified. Generic guardian source/time history avoids adding guardian identity retention.

Review findings communicated to implementation owners:

1. Resolved in source re-review: `worksheet-cache.ts:start` now flushes pending moves, checks owner/selection epoch/submission, adopts the full server view, and excludes racing local advance with a closure-scoped starting set. Added cache regressions cover authoritative mark/cursor/all-done adoption and advance during start. Database/device behavior remains unverified.
2. Resolved in source re-review: `homeworkQuestionCounts` counts every question in total, separates prior-complete count, and tallies learning outcomes only for the rest. Repository summaries consume the helper, avoiding the contradictory seven not started plus three already done example.
3. Resolved in final source re-review: `tutor-screen.tsx` renders the all-prior-done state and guards initial start, hydration, automatic question requests and opening coaching. `tutor.store.ts:endForPriorWork` stops audio, increments a Zustand-owned generation and sets ended. Start also increments that generation; hydrate snapshots it before awaiting and rejects obsolete responses. Coach rejects obsolete/ended/problem-changed work after headers, before every event, in catch and at EOF, covering the previously reported late stream/hydrate writers. This is source-level resolution; no runtime stream-cancellation or screen transition pass is claimed.

No concrete blocking defect remains from the three findings in the inspected source. The stream generation checks were reviewed directly, without a runtime streaming test. Required runtime/database validation and release sign-off remain open.

## Latest checks and native artifact review

Owner-run results, not rerun by this reviewer:

- App unit suite: 708 passed, zero failed; focused extraction/cache/cursor/report subset: 30 passed. Full server suite: 132 passed, zero failed; homework-specific server subset: 12 passed.
- App, mobile, web and Payload package `tsc --noEmit` checks passed after exact dependency recovery. Payload types regenerated; existing media schema preserved.
- Targeted changed-app and Checkbox ESLint checks exited zero. Two pre-existing warnings remain in the XR screen (unused `SPATIAL_STYLUS_SOURCE`, effect dependency `boardExport`). This is not a claim that an unrestricted repository lint/build lane passed.
- Renderer/config tests: 16 passed, one merged-APK manifest test skipped because no fresh APK exists. Bridge contract checks: four passed.
- Reviewed native prototype commit `1471b3faf4470b91710db573a37634e4ab65161c` completed all 307 arm64 native build tasks. Host C++14 tests and ABI checks passed; provenance records NDK 27.1.12297006, source baseline, inputs and flags. Candidate strength 0.75/0.55 and distance 20/25mm hysteresis remain unqualified on device.
- Scratch migration regression stopped at host `initdb` shared-memory denial before SQL ran. No migration or database concurrency/retention integration pass is claimed.

Independently reviewed `packages/ui/Checkbox.tsx` against installed `@expo/ui/src/universal/Checkbox/types.ts`, `index.android.tsx` and `index.ios.tsx`: `label` is a real prop. Android makes the labeled row toggleable with checkbox semantics and a 48-unit checkbox target; iOS forwards it to native Toggle. Removing the detached sibling label in favor of this prop is supported by the installed API. VoiceOver/TalkBack acceptance is still pending. Rechecked `endForPriorWork`/`sessionGeneration`: cancellation state remains Zustand-owned, no native handles were serialized, and hydrate/stream stale checks remain present.

Independently measured new AAR SHA-256 `a733a97e0f15f25eb42f384c749eb12906842a750527fac0e784cd69b8e0d762`, matching provenance and Gradle/prebuild pins. Compared both ZIP contents byte-for-byte: no added or removed members; only `jni/arm64-v8a/libviro_renderer.so` changed. The saved source patch appends separate hand/grip IDs 13–16, routes poses/buttons through the existing native dispatch and adds hysteresis/cancellation. This confirms packaging scope, not on-device correctness. ABI report retains all 9,750 baseline symbols/JNI, adds two exports, and records no new undefined imports, with matching AArch64/SONAME/dependencies/16KiB alignment.

The mobile bridge declaration now matches the existing `.1` root override; source event fields already accept numeric source IDs, so no new event API or tarball was required. Tutor Room now explicitly enables hand tracking. The renderer pin and prebuild updater select the new AAR/checksum. App window/orientation/manifest metadata and scene geometry were not changed. Native work is a far-input prototype, not “no hands code”: direct touch, hand coach and physical input qualification remain absent.

The release branches were initially absent. The coordinator created them from the audited app and renderer baselines and opened draft reviews: Moyo data/API #153, stacked UI #154, Moyo artifact integration #155, and ViroCore native #121. Nothing was merged into a release branch or deployed; draft publication is not release qualification.

## Independently checked initial-source seams (historical baseline)

| Seam | Observation | Gate implication |
| --- | --- | --- |
| `packages/app/features/capture/capture-screen.tsx:startWithNatalie` | Questions are sent with `crop: null`; the comment identifies missing storage keys and pixel dimensions. | No established submission-question crop linkage for prior-work detection. This does not prove an OCR model cannot accept a cropped image. |
| `packages/app/features/capture/read-attachment.native.ts:readAttachmentEvidence` | Uses `createNativeOcrReader` with ExecuTorch `OCR_ENGLISH`. | Recognition exists; this seam supplies no prior-work classifier contract. |
| `packages/app/features/capture/ocr-web.ts:readHomework` | Calls `readPrinted`, backed by Tesseract. | OCR text is not evidence of completion or grading. |
| `packages/app/features/homework/homework.service.ts:startSubmissionFor`, `advanceSubmissionFor` | Resolve ownership and delegate persistence to ports. | Cursor changes belong in the existing repository ownership path. |
| `apps/web/lib/homework.repository.ts:createSubmission` | Initial persisted cursor is index zero. | Existing initial selection does not skip prior work. |
| `apps/web/lib/homework.repository.ts:startSubmission` | Updates session/status without the advance transaction or row lock. | Do not describe start as already protected by the advance transaction. |
| `apps/web/lib/homework.repository.ts:advanceSubmission` | Begins a transaction, locks the submission `FOR UPDATE`, checks expected index and question, advances by one. | Preserve this single-writer concurrency boundary. |
| `packages/app/features/tutor/tutor-xr-screen.native.tsx:BoardScene` | Mounted `ViroController`; no `handTrackingEnabled` or `onHandUpdate` reference in this file. | No verified hands integration at this app seam. |
| `apps/mobile/android/settings.gradle:viroPackageRoot`, `apps/mobile/android/app/build.gradle` | Renderer project derives from resolved react-viro package; app links `:viro_renderer`. | Loose AARs in `vendors` do not prove which renderer the app links. |
| `package.json:pnpm.overrides`, `apps/mobile/package.json:dependencies` | Override points to `3.0.1-moyo.1` tarball; mobile requests `3.0.1-moyo.0`. | Installed resolution must be demonstrated after restoring dependencies. |

At initial audit, a targeted `rg` search found no `priorWork` references in the audited homework feature directory or `HomeworkQuestions.ts`. That bounded baseline search is now superseded by the working fallback implementation; it was never a database-schema audit.

## Cross-review of owner audits

Reviewed `homework-g0-2026-11.md` and `hands-g0-audit.md` after they were written. Their dispositions agree with the independently checked seams above. The homework owner attempted `node --test --conditions=react-server features/homework/homework.server-test.ts` from `packages/app`: dependency resolution failed on `server-only` before assertions. That result is recorded from the owner's audit, not a second test execution. It is neither a passing suite nor a failed authorization assertion.

Independently measured the pinned `vendors/viro-renderer-0ea780701.aar` SHA-256 as `184e39d034cf22eb0b45f056d0258234b31e61d07454fdf7a4f1405816f4a1b5`, agreeing with the hands audit. Confirmed `apps/mobile/android/build.gradle:ext.moyoViroRendererAar` selects that artifact. Inspected pinned native source with `git show 0ea780701:android/sharedCode/src/main/cpp/VROInputControllerOpenXR.cpp`: `initHandTracking` exists, hand sources reuse controller IDs, and aim pinch strength uses `0.7f`. The missing-hand-code stop condition is therefore not established by source inspection. Neither source nor artifact hash proves installed APK contents or physical event delivery.

At initial audit, no feature diff existed to approve. The original owner audits accurately recorded that baseline. The current fallback feature diff is tracked in the working implementation review above; runtime qualification, classifier evaluation and release delivery remain outstanding.

## Acceptance ledger

- [ ] Homework: deployed phone flow through subject, capture, processing, review, start and two advances.
- [ ] Homework: partially completed, blank, fully completed and printed-example fixtures behave as required.
- [ ] Homework: guardian correction, usable detection failure and retained-page retry.
- [ ] Homework: cross-family isolation, reporting separation and crop expiry verified by tests.
- [ ] Homework: at least 20 real evaluation pages and defensible complete precision.
- [ ] Homework: production schema and additive migration state confirmed.
- [ ] Hands: cold launch and every tray action with controllers off and unpaired.
- [ ] Hands: continuous near/far ink, ownership arbitration, system gesture and tracking loss.
- [ ] Hands: voice/audio/captions/lips, recenter, exit, resume and sleep.
- [ ] Hands: left-hand and one-hand full pass, measured frame pacing and video.
- [ ] Hands: PICO build and controller regression pass.
- [ ] Both: TypeScript, lint, unit/server/native lanes and required builds pass.

Every line remains unsigned because the required evidence has not been produced. No precision, latency, target-size qualification or device success numbers are inferred from code.

## Review tooling and limits

Read `/Users/mikevocalz/.agents/skills/code-review/SKILL.md`. Checked `coderabbit --version`: `0.7.6`. No CodeRabbit API review was run; this document records direct local source review. No authentication or secret inspection was needed.

The homework prompt's section 10 requires reporting when the per-question photograph-model crop path cannot be established. Detection stays OFF; no 20-page evaluation or complete-precision number exists. The hands prompt's direct-touch requirement is unmet: the explicit prototype scope is far ray/pinch, still awaiting runtime qualification. Outstanding gates include deployed phone G0, production schema, scratch/additive SQL and database integration, full web/mobile APK builds and generated manifest, runtime stream/all-done/accessibility checks, controller-free hand/tray/voice/left-hand/one-hand/seated/lifecycle runs, PICO Java/controller regression, frame pacing, recording, and release PR/merge. Neither TypeScript nor native compilation substitutes for these gates.
