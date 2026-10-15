# PR #100 seam map (B0)

Branch `feat/homework-worksheet-question-flow-20261015` at `20e94102`, read on 2026-10-15.
Every line below is a file and symbol that was opened in this pass. Nothing is inferred.
Blockers B1 to B6 extend these seams; none of them forks a parallel implementation.

Baseline on this commit, run from a fresh clone with `pnpm install --frozen-lockfile`:

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | 19 turbo tasks, 0 errors |
| Node tests | `pnpm --filter ./packages/app --filter ./packages/payload --filter ./apps/web test` | exit 0 |
| Print escape test | `node --conditions=react-server --import tsx --test lib/printable-homework.test.ts` (apps/web) | 2 pass |

`apps/web/package.json:test` does not include `lib/printable-homework.test.ts`; it runs only when invoked directly.
The package manager is pnpm 10.32.1 (`packageManager` field). There is no bun lockfile.

## 1. Worksheet state today (device-local only)

- `packages/app/features/capture/worksheet.store.ts:useWorksheetStore` — plain Zustand `create`, no `persist`; state is `current`; actions `restore(ownerId)`, `begin(input)`, `advance(ownerId)`, `clear(ownerId)`.
- `packages/app/features/capture/worksheet-session.ts:WorksheetSession` — `schemaVersion:1, id, ownerId, subject, title, instructions, createdAt, questions, currentIndex`.
- `packages/app/features/capture/worksheet-session.ts:readWorksheet / writeWorksheet / advanceWorksheet / clearWorksheet` — pure functions over `ProblemStorage`; key is `capture-worksheet-v1:<ownerId>`.
- `packages/app/features/capture/worksheet-session.ts:isWorksheetSession` — 1 to 50 questions, unique ids, cursor in range.
- `packages/app/features/capture/worksheet-questions.ts:WorksheetQuestion` — `{id, sourcePage, sourceNumber|null, text}`; the question-candidate type.
- `packages/app/features/capture/worksheet-questions.ts:extractWorksheetQuestions / questionForTutor / MAX_WORKSHEET_QUESTIONS` — parser, single-question prompt builder, cap of 50.
- `packages/app/features/capture/worksheet-review.tsx:WorksheetReview` — review and correction UI; local `useInstanceStore`; `onConfirm(questions, instructions)`.
- `packages/app/features/capture/capture-screen.tsx:CaptureScreen` — `startWithNatalie` calls `begin`, then `setProblem(questionForTutor(first), true)`, then `router.push('/tutor')`.
- `packages/app/features/capture/capture.store.ts:useCaptureStore` — `problem`, `problemIsReading`, `problemEvidence`, `setProblem`, `clearProblem`.
- `packages/app/features/capture/problem-storage.shared.ts:ProblemStorage / ProblemEvidence / readProblemEvidence / writeProblemEvidence` — storage interface and the server-issued `{questionId, revision}` handle.
- `packages/app/features/capture/problem-storage.native.ts:problemStorage` — `createMMKV({ id: 'capture' })`; web fork uses localStorage.
- `packages/app/features/capture/assessment-readiness.ts:assessmentReadiness / readyForEvaluation / readinessForTurn` — the client half of the refusal; worksheet questions are always `problemIsReading=true`, so `/api/tutor/evaluate` is never called for them.
- `packages/app/features/capture/index.ts` — barrel; does not export `WorksheetSession`, the session helpers, `ProblemEvidence` or the readiness symbols.

## 2. Tutor session (client and server)

- `packages/app/features/tutor/tutor.store.ts:useTutorStore` — plain `create`, not persisted; `sessionId` set only by `hydrate`.
- `packages/app/features/tutor/tutor.store.ts:TutorState.hydrate` — `fetchSession(problem)`; seeds bubble `problem-<sessionId>`; `budget.kind === 'session-complete'` sets `DONE_FOR_TODAY`.
- `packages/app/features/tutor/tutor.store.ts:TutorState.start` — appends `problem-<Date.now()>` bubble when the thread is empty or the problem changed (commit `7f351d1`).
- `packages/app/features/tutor/tutor.store.ts:TutorState.coach` — streams `{problem, message, sessionId, problemIsReading?, image?, lastOutcome?}`; persists via `postMessage`.
- `packages/app/features/tutor/tutor-screen.tsx:TutorScreen` — `hydratedOnce` ref is the first-load hydration guard (commit `d3c27cf`); `moveToNextWorksheetQuestion` calls `advance`, `setProblem`, `start`, then `coach`; `recordAttempt` returns early unless `readyForEvaluation`.
- `packages/app/features/tutor/session.client.ts:fetchSession / postMessage / patchAttachment` — raw `fetch`, no TanStack Query.
- `packages/app/features/tutor/session.types.ts:TutorSessionSnapshot` — `{sessionId, problem, messages, budget}`; no question id, no worksheet field.
- `packages/app/features/tutor/session.service.ts:openSession / addMessage / readBoardUpdate / saveBoardUpdate / attachUploadedMedia` — built on `protectedOperation`, scoped by `ctx.learnerId`.
- `packages/app/features/tutor/tutor.service.ts:evaluateTutorTurn` — server half of the refusal: without owned, current, unexpired evidence whose `problemDigest` matches, returns `{isCorrect: null}` (line 152).
- `packages/app/features/tutor/tutor.service.ts:TutorTurnInput` — carries `sourceReadiness?` and `evidence?: {questionId, revision}`.
- `packages/payload/src/collections/TutorSessions.ts:TutorSessions` — slug `tutorSessions`; fields `sessionId, learnerAuthId, problem, messages, board, closedAt, expiresAt`. No worksheet or current-question field.
- `packages/payload/src/collections/TutorMessages.ts:TutorMessages` — `attachments` json (`StoredAttachment[]`, the only place crops live today), own `expiresAt`.
- `apps/web/lib/tutor-session.repository.ts:loadOpenSession / createSession / appendMessage / readBoard / mergeBoard / patchAttachment / closeTutorSession`.
- `apps/web/lib/edu.repository.ts:issueEduQuestion / QuestionToIssue / withCurrentEduEvidence` — the only path that mints `{questionId, revision, problemDigest, evaluationReady}`; called only from `/api/tutor/next`, so captured worksheet questions never receive server evidence.
- `packages/payload/migrations/edu_questions.sql` — `edu.questions` DDL.
- Routes: `apps/web/app/api/tutor/session/route.ts:GET,POST` (POST closes), `session/message/route.ts:POST`, `session/attachment/route.ts:PATCH`, `session/board/route.ts:GET,PUT`, `tutor/next/route.ts:GET`, `tutor/evaluate/route.ts`, `tutor/coach/route.ts`.

## 3. API layer and query conventions

- `packages/app/core/api-url.ts:API_URL / resolveApiOrigin / assertApiOriginConfigured`.
- `packages/app/core/api-fetch.ts:getJson / ApiError / isNotFound / isUnauthenticated / isRetryableError` — shared fetch for TanStack Query hooks.
- `packages/app/core/protected-operation.ts:protectedOperation` — identity comes from ctx, never from request parameters.
- `packages/app/features/summary/use-reports.ts:useGuardianReports / useGuardianReport / useTeacherShare / useSummaryQueue / reportsQueryKey / reportQueryKey`.
- `packages/app/features/home/use-next-skill.ts` — `useQuery` on `/api/tutor/next`.
- Zustand persisted-store pattern: `packages/app/features/permissions/permissions.store.ts:usePermissions` (`persist` + `createJSONStorage` over `stateStorageOver`), adapter in `packages/app/features/onboarding/onboarding-storage.shared.ts:stateStorageOver`.
- `tooling/check-store-separation.mjs:EDU_SQL / FEATURE_ROOTS` — `edu.*` SQL allowed only in repository files; a new `edu` table must be added to the regex in the same commit.

## 4. Payload persistence

- `packages/payload/src/payload.config.ts:default` — `postgresAdapter({ push: process.env.PAYLOAD_PUSH === 'true', schemaName: 'payload' })`; no `migrationDir`.
- Collections (slug → file): `users` Users.ts (learners, guardians, tutors; no separate Learners collection), `media` Media.ts, `guardianships` Guardianships.ts, `handoff-codes`, `consents`, `skills`, `misconceptions`, `sessionTranscripts`, `tutorSessions`, `tutorMessages`, `studentModelFacts`, `safetyEvents`, `incidentReports`, `sessionSummaries`, `organizations`, `enrollments`, `tutorEngagements`, `classes`, `assignments`, `assignment-completions`, `families`, `leads`, `sessions`.
- `packages/payload/src/collections/Guardianships.ts` — `status` select `active | invited | revoked`, default `active`; no date fields. Active guardianship means `status = 'active'`.
- `packages/payload/src/collections/Media.ts:Media` — `access.read: () => true`, `upload: true`, one field `alt`. Learner uploads bypass it (presigned Bunny PUT).
- `packages/payload/src/collections/SessionSummaries.ts:SessionSummaries` — the doc 34 retention class: no `expiresAt`; deleted only by guardian erasure; `suppressed` keeps the row.
- All collections set `versions: false`; `tooling/check-versions-off.mjs` enforces it.
- Collection-level `access` is "signed in" only. Real scoping is in repositories through `protectedOperation`.

### Migrations

- `packages/payload/migrations/` — 35 hand-written idempotent `*.sql` files, applied with the Supabase MCP `apply_migration`.
- `packages/payload/migrations/session_summaries_additive.sql` header — records why `payload migrate:create` is not used: no baseline, so it emits every table and offers a `down()` that drops the schema. `PAYLOAD_PUSH` is off for the same reason.
- `tooling/check-schema-applied.mjs` — against a live `DATABASE_URL`, checks every `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` in the migrations exists.
- `apps/web/package.json:payload:migrate / payload:migrate:create` — present, unused.

### Erasure, retention, media

- `apps/web/lib/account-deletion.repository.ts:SUBJECT_COLLECTIONS` — the registry of learner-scoped collections for account erasure (`{collection, fields}`); `eraseSubjectPayload` iterates it after deleting `sessionSummaries`. A new collection goes here.
- `packages/app/features/memory/memory.service.ts:forgetEverything` — S27 forget-all; ports `forgetLearnerRecord, forgetSessionSummaries, eraseLearnerMedia`.
- `apps/web/lib/summary.repository.ts:forgetSessionSummaries` — only deleter of summaries.
- `apps/web/lib/edu.repository.ts:forgetEduLearnerRecord / eraseEduSubject / eraseEduTranscriptCascade / eraseEduFactAndBlockTag`.
- `apps/web/lib/bunny.repository.ts:eraseLearnerMedia / eraseSubjectMedia` — Bunny objects by learner prefix.
- `packages/payload/src/retention/sweep.sql` — TTL sweep on `expires_at` for `tutor_sessions`, `session_transcripts`, `safety_events`, `incident_reports` (legal hold respected); shadow-table VALUES list at line 30.
- `apps/web/lib/retention.repository.ts:sweepVersionShadows / loadExpiredTranscripts / deleteTranscripts / deleteFacts`.
- `apps/web/app/api/retention/sweep/route.ts`, `.../cron/route.ts` — sweep doors; `vercel.json` cron 04:00, media sweep 03:00.
- `packages/payload/src/retention/erasure.integration.test.mjs` — proves the cascade against real rows.
- `packages/app/features/media/retention.ts:MEDIA_TTL_DAYS` — 7.
- `apps/web/lib/bunny-token.ts:signCdnUrl / SIGNED_URL_TTL_SECONDS` — 3600 s; `apps/web/app/api/media/view/route.ts:GET` is the single signed read door.
- `apps/web/lib/summary.repository.ts:resolveCaptureCrop` — unsigned crop URL from `tutorMessages.attachments[]`, null once expired.
- `docs/design/seq-erasure-cascade.md` — marks the guardian on-demand path "NOT YET IMPLEMENTED"; the forget-all and erase routes above exist, so the doc is stale.

### Jobs

- `packages/jobs/src/topology.ts:QUEUES / liveQueues / deadLetterFor`; `keys.ts:JobPayloads / summaryKey / distillKey / sweepKey`; `boss.ts:getBoss / ensureLiveQueues`; `drain.ts:drainQueues / JobHandlers`; `health.ts:QUEUE_HEALTH_RULES`.
- `apps/web/lib/jobs.ts:jobHandlers / drain / enqueueSummary / enqueueSweep / enqueueDistillation / enqueueIncidentFanOut`.
- A new queue needs `QUEUES`, `JobPayloads`, a key fn, `QUEUE_HEALTH_RULES` and `jobHandlers`.

## 5. Reports and print

- `packages/app/features/summary/summary.service.ts:closeSession` (line 892) — `closeTutorSession` then `enqueueSummaryJob`. This runs on session close.
- `apps/web/app/api/tutor/session/route.ts:POST` — calls `closeSession`, then `after(() => drain({ only: ['summary.generate'] }))`.
- `packages/app/features/summary/summary.service.ts:generateSessionSummary` (line 156) — evidence → narrative → `lintNarrative` → safety screen → `published | suppressed`; `sessionKind` hard-coded `'ai-tutor'`.
- `packages/app/features/summary/summary.service.ts:guardianSummaryReport / GuardianReportPorts` (lines 460 to 476) — active-ward filter plus published-only filter; marks viewed on first open.
- `packages/app/features/summary/summary.service.ts:resolveQuestion` — crop → text → expired fallback via `questionRef`.
- `packages/app/features/summary/honesty.ts:ABILITY_PRAISE / EMPTY_PRAISE / MINUTES_AS_ACHIEVEMENT / COMPARISON / PREDICTION / lintNarrative` — the praise and grade-talk ban for narratives.
- `apps/web/lib/summary.repository.ts:loadGuardianWards` (line 272) — `guardianships` where `guardianAuthId = ctx.learnerId` and `status = 'active'`, `pagination: false`.
- `apps/web/lib/summary.repository.ts:saveSummaryReport / loadSummaryBySession / loadSessionForSummary / markGuardianViewed / loadSummaryQueue`.
- `apps/web/app/api/guardian/reports/[sessionId]/print/route.ts:GET` — `?mode=report|practice`; auth through `guardianSummaryReport`; headers no-store, CSP `default-src 'none'`, `X-Frame-Options: DENY`, noindex.
- `apps/web/lib/printable-homework.ts:printReportHtml / PrintableMode` — escaped HTML; practice mode keeps `still-working` and `solved-with-help` rows only; `window.print()` at line 70.
- `apps/web/lib/printable-homework.test.ts` — injection test, green.

## 6. Guardian surfaces

- `packages/app/features/home/guardian-home-screen.tsx:GuardianHomeScreen`; `parent-home-content.tsx:ParentHomeContent` (its comments say `setChildren` is never called); `parent-home.data.ts:CHILDREN / THIS_WEEK / UPCOMING` are fixtures.
- `packages/app/features/family/family.store.ts:useFamilyStore / useActiveLearnerId` — the only client store of wards; starts empty; `setChildren` has no caller anywhere in `apps/` or `packages/`.
- `packages/app/features/family/child-switcher.tsx:ChildSwitcher` — exported from `packages/app/index.ts` only; no screen mounts it.
- `apps/web/app/api/account/learners/route.ts:GET` — the only ward-listing API; consumed only by `account-deletion.store.ts`. No `useWards` hook exists.
- `packages/app/features/summary/reports-pane-content.tsx:ReportsPaneScreen` — AdaptivePanes host; `report-content.tsx:SessionReportScreen`.
- No guardian homework timeline surface exists.
- Mobile routes: `apps/mobile/app/(guardian)/_layout.tsx:GuardianShell`, `(drawer)/(tabs)/{family-home,family,reports,alerts}.tsx`, `(guardian)/reports/[sessionId].tsx`.
- Web routes: `apps/web/app/(guardian)/layout.tsx`, `(guardian)/{family,children,alerts}/page.tsx`, `apps/web/app/reports/page.tsx`, `(site)/reports/[sessionId]/page.tsx`.

## 7. Adaptive layout, sheets, tokens, copy

- `packages/ui/adaptive-panes/index.tsx:AdaptivePanes` (`.Column` / `.Inspector`, `usePaneOpen`, `PaneToggle`, `DetailNavbar`); `types.ts:AdaptivePanesProps / AdaptivePanesCommands`.
- `packages/ui/adaptive-panes/use-window-size-class.ts:useWindowSizeClass`; `constants.ts:WindowSizeClass` (compact, medium, expanded, large, extraLarge from `@acme/theme` `widthClassMinDp`).
- `packages/ui/adaptive-panes/fold-layout.ts:FoldPosture ('flat'|'book'|'tabletop') / resolveVerticalFoldPanePlan`; `use-fold-layout.native.ts:useFoldLayout`; signal from `apps/mobile/modules/reserved-regions` (Expo Modules; Android Jetpack WindowManager FoldingFeature, iOS Swift).
- Learner pane ban is prose only: `docs/decisions/adr-107-learner-pane-ban-reaffirmed.md`, `docs/design/reset/02-binding-constraints.md:249`. No tooling check encodes it.
- `packages/ui/BottomSheet.tsx:BottomSheet / SheetSurface` — wraps `@expo/ui` BottomSheet, not Gorhom; snap 0.55 and 0.85. `@gorhom/bottom-sheet` 5.2.14 is used only in `apps/mobile/components/BookingSheet.tsx` and the provider in `apps/mobile/app/_layout.tsx:131`. No Popover component; the popover-on-expanded rule is prose (`docs/pack/04-screen-briefs.md:53`).
- `packages/theme/tokens.ts:palette / semantic / accentRoles / roleTheme / widthClassMinDp` — the token registry. Names are plum, coral, teal, lavender (internal scales flame, lagoon, sun). No "amber" key was found.
- `tooling/check-role-accent.mjs`, `tooling/check-contrast.mjs` (WCAG pairs; does not ban inline hex), `tooling/check-barrels.mjs`, `tooling/check-utilities.mjs`, `tooling/check-references.mjs` (requires a `// Mobbin:` header on feature surfaces), `tooling/check-copy-law.mjs:RULES` (scans `apps/web-vite/src/**` only; bans answer-key and "does your homework" phrasing, not "correct").
- Bands: `packages/student-model/src/voice-band.ts:VOICE_BANDS / BAND_FRAMES / BAND_EXAMPLES` (`k-2, 3-5, 6-8, 9-12`); `packages/app/features/summary/summary.types.ts:SummaryBand`; `packages/app/features/capture/age-band.ts:captureLabelsForBand` uses `young|child|teen|adult`, not K-12 bands.
- Header convention (commit `20e9410`): `// Mobbin: <url> (<note>) · <url> (<note>)` then `// SOT:` and `// SOT-KEYWORDS:`; Mobbin pass docs live in `docs/design/mobbin/*.md` as a table of App / Link / Structural move adopted.

## 8. Camera, native modules, PDF, E2E

- `react-native-vision-camera` 5.2.3 (catalog); v5 Output API in use: `packages/app/features/capture/guided-frame.native.tsx` (`usePhotoOutput`, `capturePhotoToFile`, `<Camera outputs={[photoOutput]}>`). No `takePhoto` or `photo={true}` anywhere. `patches/react-native-vision-camera.patch` touches only `android/build.gradle`.
- `react-native-mmkv` 4.3.2, `react-native-nitro-modules` 0.37.1, `react-native-nitro-fetch` 1.6.2 (catalog). No Nitro HybridObject, `nitro.json` or `nitrogen/` exists in repo source. Local Expo modules: `apps/mobile/modules/reserved-regions`, `apps/mobile/modules/board-texture`.
- `expo-print`, `expo-sharing`, `react-native-share`: absent from every `package.json` and from the catalog. Present: `pdfjs-dist` 6.3.289 (read only), `expo-file-system` 58.0.3. Expo 58 preview pins `expo-print ~58.0.2` and `expo-sharing ~58.0.11` in `node_modules/expo/bundledNativeModules.json`; both MIT.
- E2E: Playwright 1.63.0 (catalog) with scripts in `apps/web-vite/e2e/*.mjs`, no `playwright.config.*`. Maestro, Detox and `.argent/` are absent. `qa/walkthroughs/*.md` are manual notes.
- Sentry: `tooling/check-sentry-invariants.mjs` bans every replay integration on every surface, requires `sendDefaultPii: false`, traces off, tag allowlist `band, surface, release, runtime, queue, jobId`. Scrub is `packages/app/core/telemetry-scrub.ts:scrubTelemetryEvent` with `packages/app/core/telemetry-mask.ts:maskTelemetryText`, wired in `apps/web/sentry.server.config.ts` and `apps/web/instrumentation-client.ts`.

## 9. Open questions surfaced by this pass

1. The repo has no `.claude/skills/` directory. The prompt's skill list is installed globally in the harness as `design:*`, `engineering:*`, `frontend-design`, `react-native-vision-camera`, `react-native-mmkv`, `build-nitro-modules`, `api-design`, `callstack-react-native-best-practices`, `no-ai-slop`. No skill named `mobbin-pass`, no "pinned Moyo foldable skill", no Stitch or UI/UX Pro Max skill exists anywhere.
2. The prompt requires `payload migrate:create`; the repo documents why that command cannot be used here and ships hand-written idempotent SQL instead.
3. B5 needs PDF bytes on device. `expo-print` and `expo-sharing` are not installed; adding them is a new dependency.
4. Source crops are child images. Today they live only in `tutorMessages.attachments` with a per-turn `expiresAt`, and media objects expire after 7 days. B1 needs a declared retention for crops.
5. B3 names a Gorhom sheet; the kit sheet is `@acme/ui` `BottomSheet` over `@expo/ui`.
6. No native E2E runner (Maestro or Detox) is installed; the device matrix in B6 has no automation to run on.
