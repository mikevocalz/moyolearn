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
