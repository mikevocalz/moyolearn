# Hands-first implementation and verification

Date: 2026-11-14. Status: native far-input prototype built and locally pinned; no hands-only runtime acceptance.

## Native source and artifact

The isolated checkout `/private/tmp/moyo-hands-native-0ea780701` contains reviewed commit `1471b3faf4470b91710db573a37634e4ab65161c`, based on the exact prior renderer `0ea78070138a3357858af5d702e8fdbb095d0e6a`. User changes in the original sibling checkout were preserved. The source patch is saved beside this report.

Hand ray/grip IDs 13–16 are appended after existing source values. Pose, hit, hover, click, drag and ray mapping use those IDs consistently. Pinch uses candidate strength hysteresis 0.75/0.55 and fallback distance hysteresis 20/25 mm. Tracking loss, invalid joints and FB system/menu gestures cancel and require release before rearming. Invalid fallback directions are rejected. Meta-specific behavior remains gated by the existing optional extension flag. These thresholds have not been qualified on a headset.

All 307 native build tasks completed using installed NDK 27.1.12297006 and CMake 3.22.1. The exact protobuf archive was found and hash verified. The earlier 14.8 GiB figure was historical free space, not a minimum build requirement. Measured build output was about 365 MiB. Disposable Ninja outputs were cleaned after preserving the artifact, symbols, source and logs; debug symbols were subsequently gzip-compressed losslessly.

`vendors/viro-renderer-1471b3faf.aar` SHA-256: `a733a97e0f15f25eb42f384c749eb12906842a750527fac0e784cd69b8e0d762`. Adjacent provenance records commands, input hashes, build flags and qualification limits. ABI checks retained all 9,750 baseline exported symbols, including JNI, and found no new undefined imports. DT_NEEDED, SONAME, AArch64 architecture and three 16 KiB LOAD alignments match baseline. An independent archive comparison confirmed only `jni/arm64-v8a/libviro_renderer.so` changed. This is ABI/build evidence, not runtime feature parity.

## Moyo integration

The renderer pin and prebuild updater reference the new artifact and checksum. The Tutor Room explicitly sets `handTrackingEnabled`. The mobile package declaration now matches the existing resolved `3.0.1-moyo.1` bridge tarball/root override. The bridge's click/drag/controller source fields are already typed as numbers; no new event API or bridge tarball was needed. Frozen offline lockfile verification passed without lockfile changes.

No scene geometry, app window dimensions, orientation, manifest metadata or board drawing authority was changed. The existing board-pointer and stylus arbitration remain the sole drawing paths. The original local renderer/config run passed 16 cases and skipped the merged-APK manifest case because that machine had no fresh APK. The later CI build below supersedes the APK-build gap, but did not run that manifest assertion.

## PR completion and packaging evidence

GitHub Actions [Android native run 43563693132](https://github.com/mikevocalz/moyolearn/actions/runs/43563693132/job/132352759920) built merge revision `81546678f2ce6b8a3ed9f60d6a2c3ae46e181ae2`, combining PR head `34fe959130077759e992256fa50c34087b96ee9f` with release base `599456a794ec54aee8444488043c6683a67f7d4a`: `:app:assembleQuestDebug` completed successfully on 2026-11-14 at 06:24 UTC. The run uploaded diagnostic reports only. Its APK was not retained, and it did not run the merged-manifest assertion or inspect the packaged renderer. Build success alone does not establish either check or physical-device acceptance.

The updated Android workflow runs the existing renderer/config tests after assembly with `MOYO_REQUIRE_MERGED_QUEST_MANIFEST=1`. Missing generated manifests now fail that CI step instead of skipping it. `tooling/verify-quest-apk.mjs` verifies the selected AAR checksum, its renderer member against provenance, and the renderer extracted from the actual APK. If AGP strips symbols, the verifier reproduces that transform with the workflow's pinned NDK tool before comparing hashes. A prior or modified renderer fails verification.

Only after those checks succeed, CI retains the debug APK, output metadata, merged manifest and checksum report for seven days under `quest-debug-<checkout SHA>`. The report records the exact checkout, renderer source commit and APK hash. This is a development APK that needs Metro; it is not a standalone competition build or a device acceptance result. No private environment file, signing credential or broad build directory is included in that artifact.

Follow-up validation in the Linux checkout: all five APK-verification tests passed, including a real host ELF strip and rejection of an altered ELF. The existing plugin suite passed 16 tests and skipped only the unavailable local merged manifest; a separate strict-mode run correctly rejected that missing manifest instead of skipping. Workflow YAML parsing, Node syntax and whitespace checks passed. Independent extraction of both AARs confirmed only `jni/arm64-v8a/libviro_renderer.so` changed, all 9,750 baseline exports remain, no new undefined symbols were added, and dependencies plus 16 KiB LOAD alignment match. The C++14 host regression from the committed native source patch passed with `-Wall -Wextra -Werror`. These are host/source checks; the updated post-build CI checks and device installation require their own results.

Skills read for the follow-up: the pinned `mikevocalz-foldable-layouts` skill (blob `69a051ad0a924f778ed54f9222fe8af0c5eef701`) and Expo `expo-dev-client` (blob `a155ce90b6b4c6b8d3b276e3771a8ca8d02e1b07`). The existing Expo flavor build, Viro pin/provenance, config tests and board-input authority remain the implementation seams; app-window and navigation policies are unaffected by the packaging checks.

## Runtime evidence and remaining work

Argent sees Quest 3S `340YC10GC3014S`, SDK 34. The existing debug app is version 1.0.0/code 1, last updated 2026-11-03. Initial launch reached an “Unable to load script” React Native screen. That installed APK has not been rebuilt with the candidate AAR; no candidate native input is claimed to have run on it.

JavaScript dependency recovery restored exact lockfile pins and made TypeScript checks pass. The Metro transformer smoke test passed and the session-owned server is running on 8081. The Quest reported Asleep with no running app process at the restart attempt; the pending restart was canceled while waiting for the user to wake it. No device bundle was qualified. The current public mobile environment selects mock auth/persona and localhost API. It cannot establish the prompt's deployed-backend homework journey.

Direct-touch ink is not implemented. Existing native plane-drag calculations can feed the current panel surface funnel, but fingertip/poke registration, depth hysteresis and near/far ownership still need a native implementation. The explicit fallback scope is ray pinch only, pending runtime qualification; do not describe touch-to-write as available. No first-run hand coach, two-foot reach qualification, left/one-hand pass, voice/tray acceptance, PICO Java build or entry recording is claimed.

## Checks

- Host C++14 tests passed with `-Wall -Wextra -Werror`: strength/distance boundaries, cancellation/rearm, independent state and invalid direction.
- Native arm64 build completed with exit 0. ABI/archive checks passed.
- App/mobile/web/Payload TypeScript checks passed after exact dependency repair.
- Existing unit/server suites and local pin/config tests are recorded in the homework and gate reports; they do not establish hands behavior.
- Source review was independent of the native author. The initial Quest APK build has now passed in CI. Packaged-renderer and manifest qualification in the updated workflow, device input, frame pacing and release approval remain pending.
