# Open PR dispositions, 2026-11-04

Every open PR on 2026-11-04 got one of BUILD, STRIKE or DEFER. Each line names the evidence and, for anything not merged, the condition that moves it.

## Process decisions

| Decision | Disposition | Reason |
| --- | --- | --- |
| Docs-only PRs merge as implementation contracts | BUILD | 21 PRs (#99, #101–#106, #108–#112, #114–#120, #124, #133) each add one Markdown file. Their "do not merge" lines were replaced with "Merged 2026-11-04 as the implementation contract; implementation is a separate PR that must satisfy every acceptance box. Nothing in this doc is implemented." No runtime code changed. |
| Native CI on Markdown-only diffs | Cancelled | 41 iOS simulator and Quest runs on those 21 PRs were cancelled. A one-file `.md` diff cannot change a native build, and the runs were holding the account's runner queue (Kinetrell PR #29 sat queued for 22+ minutes). Web, typecheck, lint and turbo still gated every merge. |
| `business-studio-npm.mjs --check` fails on main | BUILD (refresh) | npm `latest` moved: react-native-skia-graphite-* 157.0.0 → 157.1.0 (2026-11-02) and react-native-webgpu 0.19.2 → 0.21.0 (2026-11-03). `docs/business/npm-policy.md` forbids falling back to an old release, so the catalog, lockfile, receipt and Dawn admission move forward on `chore/npm-latest-2026-11-04`. Blocks #107, #134, #136, #137 until merged. |
| Unowned uncommitted Forge pen diagnostics | Parked | Committed to `wip/forge-pen-diagnostics-2026-11-04` and pushed. No live session claimed them. `vendors/viro-renderer-*.aar` left untracked. |

## Code PRs

| PR | Disposition | Evidence and next condition |
| --- | --- | --- |
| #134 auth Payload adapter preflight | BUILD | Failures were the npm gate and a pnpm rename race on the iOS runner, neither from the diff. Merge after the npm refresh and a re-run. Live backfill and cutover sign-off need production credentials and stay open. |
| #121 world-language foundation | BUILD | Green on a base 78 commits old; merges cleanly. Merge main, re-run, merge. RTL and mic QA are device work. |
| #122 multilingual Whisper | BUILD | Same as #121. Human-transcribed sample corpus stays open. |
| #107 Qwen candidate | BUILD | Only failure is the npm gate. Provider child-data agreement needs a signed agreement before routing turns on; the code ships fail-closed. |
| #113 AI Model Control Center | BUILD | Own bug: `AiModelRoutes.ts(29,5)` TS2322, `access.admin` must return boolean. Fix, add the Payload migration it registers, then merge. |
| #137 Spark desktop preview | Superseded by PR-D01 | Research on Spark 0.0.2: #137's contract test forbids the `init-template.cjs` postinstall Spark requires, and its Nitro override skips Spark's AppKit-patched 0.37.0 tarball. PR-D01 regenerates `apps/desktop` from `@legendapp/spark@0.0.2` and carries #137's Moyo files over; #137 closes with a link. |
| #136 Forge board single document | BUILD after fixes | Own failures: `packages/ui/ForgeBoardIcon.tsx` imports `react-native-svg` into web bundles (needs a `.web.tsx` fork like every other SVG component) and lacks a Mobbin reference line. About 37 MB of APK/AAR and unused tarballs get pruned. Quest headset checks stay open. |
| #123 homework end to end | Rebuild | Four failures come from the branch's own dependency bumps (pg-boss 12.38 needs schema 46, next 16.4.2 Turbopack, deleted `expo-modules-core.patch`). Rebuild on main with only the homework commits. |
| #135 npm latest + Skia v3 | DEFER | Its head `712b27ad` was pushed by `github-actions[bot]`, so CI sits at `action_required`; its "latest" is already stale (Skia 3.9.1 out, branch pins 3.8.1). Re-target after the refresh and #134 land. |

## Desktop and motion pack

| Item | Disposition | Evidence |
| --- | --- | --- |
| Spark channel | `@legendapp/spark@0.0.2` (`latest`) | `next` resolves to 0.0.1-next.10 (SDK 54 / RN 0.81), which is older than 0.0.2 (SDK 55 / RN 0.83.10). `spark upgrade` stays on the channel an app was created on. |
| Nitro on desktop | Spark's patched 0.37.0 | Moyo mobile pins `1.0.0-alpha.nightly.100.g107f6fc66597`; the two cannot share one graph ("Nitro was installed twice"). PR-D03 targets 0.37.0 inside `apps/desktop`. |
| `@acme/ui` on desktop | DEFER | Depends on Nitro v1, `@expo/ui`, `expo-router` and Viro across 37 non-story files. Desktop uses `@acme/theme` (no imports) and its own controls from `@legendapp/spark/ui` until a desktop-safe UI subpath exists. |
| `@legendapp/spark/message-dialog` | Not a real path | Message dialogs export from `@legendapp/spark/dialogs`. |
| Kinetrell PR-M00 | BUILD | Kinetrell PR #29: RN 0.88.1, Expo 58.0.23, Reanimated 4.7.1, one native CI lane. Tag `0.1.0-alpha.2` only after CI and local `npm run verify` pass. Hardware fixture numbers stay open for the device pass. |
