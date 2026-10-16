# PR #123 completion checkpoint — native print authorization

<!-- What: implementation and verification handoff for the native print fix. -->
<!-- Why: cached answer keys must not bypass a revoked guardianship. -->
<!-- SOT: homework.client.ts; practice-print.native.ts; practice.service.ts. -->
<!-- SOT-KEYWORDS: homework pr123 handoff native print guardian approval verification -->

## Change

The browser print route calls `practiceSetForPrint`, which rechecks the active
guardianship and the stored approval. Native printing previously passed the
cached preview straight to `practiceSheetHtml`. A guardian whose access was
revoked after loading the preview could still export its answer key.

Native now calls `loadPracticePrintHtml` before creating a PDF. The request uses
the same authenticated route as web, includes credentials, requests no cache,
and rejects failures or non-HTML responses. It sends only the set ID and print
mode. It never sends cached answers and has no offline fallback. Web and native
share `practicePrintPath`. The server's existing approval and guardianship checks
remain the authority.

This protects future exports; it cannot revoke a document an authorized adult
already downloaded.

## Verification

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; existing nested Expo patch warnings remain. |
| `node --test packages/app/features/homework/homework.client.test.ts packages/app/features/homework/practice-draft.test.ts` | 14 passed, zero failed/skipped. |
| `node --test --conditions=react-server packages/app/features/homework/practice.server-test.ts` | 3 passed, zero failed/skipped; revoked guardians, learner sessions and unapproved drafts refused. |
| `pnpm typecheck --force` | 19 successful tasks, zero cached; 36.68 seconds. |
| `pnpm --filter @acme/app exec eslint features/homework/homework.client.ts features/homework/homework.client.test.ts features/homework/practice-print.native.ts features/homework/practice-print.web.ts` | Exit 0. |
| `coderabbit review --agent -t uncommitted` | Completed, zero findings across the four changed code/test files. |
| `git diff --check` | Passed. |

The new client tests first failed because the authorized HTML loader did not
exist, then passed after implementation. They verify escaped IDs, credentials,
cache policy, server refusals, offline failure and unexpected response types.
Existing service tests exercise the real authorization boundary with fake ports.
These are unit/service results, not a device print/share result.

Logs on this host: `/tmp/moyolearn-homework-{install,typecheck,print-tests,review,pods}.log`.
Baseline branch head: `b9c24758dc6449bbae854ef75ddefe4ba6a1a3ba`.
Worktree: `/Users/mikevocalz/moyolearn-homework-completion`.
Branch: `finish/homework-pr123-20261016`.

## Native build attempt and blocker

Used CocoaPods 1.17.0 at `/opt/homebrew/bin/pod` with Node 24.22.0 on PATH.
Changed `~/.netrc` permissions from 0644 to 0600 without reading its contents,
resolving the earlier CocoaPods permission failure.

`pod install` then failed while extracting `React-Core-prebuilt` with
`No space left on device`. The disk had 348 MiB free at failure. Removed only
this session's partial `apps/mobile/ios/Pods` and the coordination worktree's
reinstallable root `node_modules`; free space recovered to about 931 MiB.
No lockfile change resulted. No simulator was booted and no app was installed.
Argent inventory showed a connected Surface Duo, a shutdown iPhone Duo simulator,
and no Android AVDs. Device inventory is not device validation.

Do not repeat the native install until enough disk space is available for the
framework extraction and Xcode build. Restore dependencies in the coordination
worktree with its frozen lockfile if needed; this homework worktree retains its
dependencies.

## Skills and remaining work

Loaded for this slice: Expo overview/networking, Software Mansion React Native
best practices, coding standards, systematic debugging, security review,
backend patterns, CodeRabbit review, verification-before-completion, no-ai-slop,
Argent interaction and React Native workflow. The exact generic design/engineering
skill names referenced by the wider PR queue were not found during discovery;
this checkpoint makes no claim that they were loaded. No new screen design was
introduced.

PR #123 remains draft. Existing blockers remain: crop metadata and retention
integration, guardian screens rendered with real authorization, native print/share,
the recorded missing-grade-band product decision, accessibility/device evidence,
and the production migration/rollout checks. This commit fixes one security gap;
it does not complete the PR or authorize claiming native verification.
