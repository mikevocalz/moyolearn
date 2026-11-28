# Homework upload implementation and verification

Date: 2026-11-14. Status: local guardian-marked fallback; automatic detection OFF. This is not a deployed-device acceptance report.

## Implemented

- `HomeworkQuestions` records prior work independently of learning outcomes, with generic guardian source and revision time. No new image copies or guardian identity history were added. Payload types were regenerated with the existing media schema preserved.
- Capture review lets an authenticated guardian mark completed problems. The saved timeline has a review list, counts and an all-done state with unticking before tutoring begins.
- Create and start select the first unmarked problem. Start, mark revisions and advance serialize on the existing submission row lock. Advance skips marked problems without recording a learning outcome for them. Active session relinking preserves the cursor.
- The device cache follows that selection offline and adopts the complete authoritative start response. An advance cannot race an outstanding start. Learner progress retains marked positions.
- Reports and timeline outcomes exclude marked problems from work with Moyo. All-marked sheets end locally without a stale question; generation checks stop late hydration/coach output from reviving the ended worksheet.
- The shared native Checkbox now passes its label into the installed Expo control, whose native adapters support labeled interaction. VoiceOver/TalkBack acceptance remains untested.

## Scope limits

Marks are guardian-selected only and editable before start. Between-problems editing remains unsupported because the existing server has no explicit between-problems boundary. The photo-to-question crop/classifier seam, 20-real-page evaluation, precision threshold and automatic detection remain unresolved. No automatic prior-work inference is enabled. Existing pipeline/retry behavior was not replaced or qualified by this patch. The headset question handoff remains outside this fallback.

## Checks actually run

- App package TypeScript check passed: `node node_modules/typescript/bin/tsc --noEmit -p packages/app/tsconfig.json`.
- Payload package TypeScript check passed. Actual Payload type generation completed; existing `Media.prefix` was preserved by enabling the installed storage plugin's schema using explicitly nonsecret local generation values.
- App unit suite: 708 passed, zero failed. Focused extraction/cache/cursor/report subset: 30 passed, zero failed, including stale-start and start/advance race tests.
- Homework server suite: 12 passed, zero failed, including guardian authorization, foreign-family refusal, source attribution and relinking behavior.
- `git diff --check` passed.
- Web/mobile TypeScript checks initially failed on incomplete dependency exports; both passed after exact dependency recovery. Full app server suite: 132 passed, zero failed. Targeted configured ESLint recovery remains separately tracked; executable startup alone is not a passing lint run.

Logs from this session: `/private/tmp/moyo-app-unit.log`, `/private/tmp/moyo-homework-focused-tests.log`, `/private/tmp/moyo-homework-typecheck.log`, `/private/tmp/moyo-homework-mobile-tsc.log`, `/private/tmp/moyo-homework-web-tsc.log` and `/private/tmp/moyo-homework-lint.log`.

## Database and device gates

`packages/payload/migrations/homework_prior_work_additive.sql` is additive and has not been applied to a database in this pass. The new isolated migration regression stopped during PostgreSQL initialization because shared-memory creation was denied; no SQL ran. See `homework-migration-scratch-2026-11.md`. Database concurrency/retention integration tests have not run. Production homework schema is not confirmed. No phone parent-to-child upload run, native accessibility run or deployed web/mobile build is claimed. The Quest is connected but does not substitute for the phone G0.

Independent source review found and rechecked fixes for authoritative cache start adoption, timeline double-counting and stale all-done tutor output. This is source review, not runtime streaming acceptance or release approval. See `build-prompts-gates-2026-11.md` and the design handoff for remaining gates.
