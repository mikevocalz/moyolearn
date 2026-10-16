# PR #123 checkpoint — iOS simulator build and launch

<!-- What: native build/install evidence for the homework worktree. -->
<!-- Why: records what the arm64 simulator build proved and what it did not. -->
<!-- SOT-KEYWORDS: homework pr123 ios simulator build dyld expoprint verification -->

## Build result

`xcodebuild -workspace Moyo.xcworkspace -scheme Moyo -configuration Debug
-sdk iphonesimulator -destination "generic/platform=iOS Simulator"
ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO` produced

`** BUILD SUCCEEDED **` with
`Debug-iphonesimulator/Moyo.app` under
`.scratch/pr123/DerivedData/Build/Products` (log:
`.scratch/pr123/ios-arm64-build4.log`). This is compile evidence only.

## Install and launch crash

The prior iPhone Duo simulator no longer existed (device list was empty
under iOS 27.1). Created `Moyo iPhone Duo`
(`FBD4C2E9-F56D-4DFD-91FA-603B11135D20`, foldable device type) and
installed the app (`com.moyolearn.app`). The process aborted at launch:
dyld reported `Symbol missing` —
`ExpoModulesCore.AppContext.fileSystem` referenced from
`ExpoPrint.framework` but absent from the bundled
`ExpoModulesCore.framework` (crash report
`Moyo-2026-10-16-103424.ips`).

Podfile.lock is consistent (ExpoPrint 58.0.6 → ExpoModulesCore 58.0.8),
so the mismatch is stale incremental framework output from the
interrupted pod/build churn earlier today, not a dependency error.
Deleted `.scratch/pr123/DerivedData` (regenerated output only) and
restarted the same clean arm64 build (log:
`.scratch/pr123/ios-arm64-build5.log`).

## Root cause and the dependency refresh

The crash was not only stale output: the workspace pinned
`expo-modules-core@58.0.8` while `expo-print@58.0.6` (npm latest) was
compiled against a newer `ExpoModulesCore` that exports the
`AppContext.fileSystem` resilient thunk. Per instruction the stack was
brought to npm latest:

- `expo` 58.0.0-preview.8 → 58.0.12 (SDK 58 stable), all `expo-*` pins
  bumped; `react-native` 0.88.0-rc.2 → 0.88.0.
- Skia moved from `@shopify/react-native-skia@2.14.0` to the unscoped
  continuation `react-native-skia@3.6.1`, which ships the same admitted
  Dawn/graphite 154.3.0 artifacts as its own dependencies and stages
  them in its podspec. `tooling/enable-skia-graphite.mjs` ADMISSION
  renderer updated accordingly; the `@shopify/react-native-skia` catalog
  entry was replaced by `react-native-skia` in the audited TARGETS, and
  `packages/ui` keeps an `npm:react-native-skia@3.6.1` compat alias
  because `react-native-graph@1.4.0` still imports the scoped name.
- `onSize` was removed from skia's `Canvas` in v3;
  `guided-frame.native.tsx` now writes `onLayout` into the shared value.
- Two versioned patches retargeted: `expo-modules-autolinking` (Android
  publication fix is upstream in 58.0.13; only the visionOS Ruby hunk
  remains) and `expo-keep-awake` 58.0.3. `expo-modules-core`'s patch was
  dropped — upstream added visionOS guards in 58.0.20.
- `apps/mobile` direct `~58.0.x` pins that shadowed the catalog moved to
  `catalog:`; `expo-asset`, `expo-file-system`, `expo-background-task`,
  `expo-task-manager` (not in the catalog) bumped to latest.
- Held deliberately (documented holds or breaking majors):
  `react-native-executorch` 0.9.3, better-auth family 1.7.2, quickdraw
  trio, `react-native-webview`, `three`, payload canary set (npm latest
  is the 3.x line — a downgrade), `graphql` (^16 peer), `typescript`
  ~6.0.3 (latest is the 7.x native toolchain), `eslint` 9, `@types/node`
  ^24 (engines bound), `stripe` 22, the sentry pair (release-train
  coupling), `@tanstack/react-table` 8, `vite-plugin-react-native-web`
  2.x, and the vendored `@reactvision`/`@expo-pico`/nitro-canvas set.
- `tooling/business-studio-npm.mjs --check` passes against live registry;
  `pnpm install --frozen-lockfile` is consistent.

Checks: `pnpm typecheck` 19/19 tasks; 35 focused homework/worksheet
tests; eslint clean on touched files. `verify-native-compile-pools`
shows 4 pre-existing macOS-only failures (`/var` vs `/private/var`
realpath in the test fixture; identical on the pre-change file, CI runs
on Linux).

`expo-updates@58.0.17` expects its podspec's `vendor_bsdiff_src!` to have
vendored `vendor/bspatch/bspatch.c` into `ios/EXUpdates/BSPatch/`; the
dir was missing after `pnpm install`, so the file was copied by hand.
Watch for this on fresh installs.

## Runtime result — app launches (iPhone Duo, iOS 27.1)

With the refreshed stack (`ios-arm64-build8.log`):

- The dyld symbol failure is gone — `ExpoModulesCore` 58.0.20 ships the
  `AppContext.fileSystem` accessor ExpoPrint 58.0.6 was compiled
  against.
- First JS load surfaced two follow-ons: the dev build kept defaulting
  to `localhost:8081`, which another session's Metro owns — fixed by
  writing `RCT_jsLocation=localhost:8082` into the sim's app defaults —
  and a real bundling fault: `react-native-graph` still imports the
  pre-fork `@shopify/react-native-skia` specifier, which the pnpm
  `npm:` alias staged as a second physical copy; both instances then
  registered the `SkiaView` native component. Fixed in
  `apps/mobile/metro.config.js` by rewriting the scoped specifier to
  `react-native-skia` before resolution — one module identity, same
  pattern as the existing vendored-navigation/three aliases.
- After that the app rendered to first screen on the foldable cover:
  learner home "Hi Maya" with Snap-your-homework / Talk-to-Natalie /
  My-Stuff and the physical right navigation rail. Accessibility tree
  read cleanly (`Main navigation` rail at x 0.82–1.0).

The `RiveFileFactory` HybridObject error seen during the detour came
from the other project's Metro on :8081, not this bundle — our tree has
no such specifier; `nitro-canvas-in-Vision` registers only
`CanvasSurfaceFactory` on iOS (RivePanelFactory is Android-only by
`nitro.json`), and it registers fine.

## CI state at `6a79e14c`

GitGuardian, contracts, verify, turbo (build/typecheck/lint/test), all
four app jobs, lifecycle and dom-regression pass. `simulator`, `quest`
and `visionOS simulator build` were still pending when checked.
CodeRabbit reports review skipped because the PR is a draft.

## Still open

- Result of the clean rebuild and a successful app launch to first
  screen; only then can guardian/practice/print flows be exercised.
- Physical-device, foldable posture, VoiceOver/TalkBack, camera, and
  native print/share runtime acceptance remain unverified.
- Crop metadata/retention integration and expiration sweep.
- Missing-grade-band product decision; production migration/rollout
  checks.
