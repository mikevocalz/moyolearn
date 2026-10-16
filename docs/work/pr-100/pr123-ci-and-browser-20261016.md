# PR #123 checkpoint: CI repairs and guardian browser verification

<!-- What: fixes for reproduced CI failures and the first guardian UI walkthrough. -->
<!-- Why: typechecking alone did not catch hook order or invalid dialog markup. -->
<!-- SOT: GitHub run 38901595418; Android run 38901595549; this worktree's logs. -->
<!-- SOT-KEYWORDS: homework pr123 ci browser guardian modal autolinking verification handoff -->

## Changes

- Added the missing `server-only` boundary to `practice.service.ts`.
- Moved worksheet reconciliation and session-linking hooks above the tutor
  opening screen's early return. The reconciliation effect also observes the
  turn leaving `thinking`, so a server cursor received during a turn can be
  presented after that turn settles.
- Made the guardian upload dialog and its dismiss backdrop siblings. The former
  wrapper rendered a button containing the dialog's other buttons on web.
- Extended the existing Expo autolinking 58.0.5 patch to fill an omitted
  publication version from package metadata for bundled `local-maven-repo`
  artifacts only. Explicit versions remain authoritative; remote publications
  do not receive a guessed version. Both TypeScript source and published JS
  receive the fix, and the existing visionOS patch remains intact.
- Added an Android CI regression step using the installed resolver. It covers
  omitted/explicit versions, source-only and remote modules, and both real
  print/share packages against their bundled Maven POMs.

The Android failure occurred while decoding module publication JSON, before the
existing `buildFromSource` preference could run. The installed `expo-print`
58.0.6 and `expo-sharing` 58.0.18 omitted the version; their bundled POMs use the
package version. No Expo SDK or native-module version was changed for this fix.

## Verification

| Check | Result |
| --- | --- |
| Targeted lint before the fixes | Reproduced one server-only error and two conditional-hook errors. |
| `pnpm install --frozen-lockfile` | Passed after regenerating the patch hash. |
| `node --test tooling/expo-android-publication.test.mjs` | 5 passed; the missing-version cases failed before the patch. |
| Android autolinking JSON | Every resolved publication has a version. |
| Android `gradlew help --no-daemon --max-workers=1` | Passed, 33 tasks executed; configuration/decoder proof, not APK compilation. |
| Worksheet, homework-client, practice-draft and timeline tests | 30 passed, zero skipped/failed. |
| Practice authorization service tests | 3 passed, zero skipped/failed. |
| `pnpm --filter @acme/app lint` | Zero errors; 44 existing warnings remain. |
| `pnpm typecheck --force` | 19 successful tasks, zero cached. |
| CodeRabbit uncommitted review | Zero findings on the six listed tracked implementation/configuration files. |
| CocoaPods 1.17.0 with Node 24.22.0 | Installation completed, including ExpoPrint and ExpoSharing. |
| iOS simulator compilation | Running at this checkpoint; no installed-device or print/share result claimed. |

Local command output is under `.scratch/pr123/`, which is ignored by Git.
The package manager also deduplicated existing optional dependency resolutions
while regenerating the lockfile.

## Guardian browser evidence

Used Chromium 155 through Argent against a local Next.js server and the isolated
`pr123_ui_20261016` database. The database began with a schema-only copy of the
earlier scratch database. Account names and worksheet contents below are
synthetic. No production data or provider account was used.

The first walkthrough exercised the UI from Homework through the upload dialog,
Math selection, typing two numbered fraction questions, transcription review,
question confirmation, optional assignment title, Save for your child, and return
to the dated timeline. The saved row showed two questions and two not started.
This verifies typed capture, not camera, PDF, OCR or Bunny upload behavior.

After the dialog fix, a second guardian with two active ward links verified:

1. The selected first child shows the persisted `Fraction review` row.
2. Selecting the second child shows that child's empty state without the first
   child's worksheet.
3. The upload dialog names the selected second child.
4. The rendered document contains zero `button button` matches with the dialog
   open. The earlier nested-button warning no longer appears.
5. Escape closes the dialog and returns focus to its upload trigger.

Saved screenshots:

- [Selected child's timeline](screens-20261016/guardian-timeline.png)
- [Second child's empty state](screens-20261016/second-child-empty.png)
- [Upload dialog](screens-20261016/assign-dialog.png)
- [Escape and restored focus](screens-20261016/escape-focus-return.png)

This is desktop-browser evidence. It does not establish VoiceOver, TalkBack,
mobile, foldable, camera or native printing acceptance.

## Remaining gates

Native builds/device walkthroughs, crop metadata/retention integration, the
missing-grade-band decision, production migration and the wider acceptance
matrix remain open. The Business npm freshness gate separately reports WebGPU
0.16.0 against the current 0.13.1 admission. Its native compatibility and source
provenance must be reviewed before changing that pin. GitGuardian's two older
artifact findings remain unresolved.
