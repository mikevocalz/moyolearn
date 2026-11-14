# Hands-first implementation and verification

Date: 2026-11-14. Status: native far-input prototype built and locally pinned; no hands-only runtime acceptance.

## Native source and artifact

The isolated checkout `/private/tmp/moyo-hands-native-0ea780701` contains reviewed commit `1471b3faf4470b91710db573a37634e4ab65161c`, based on the exact prior renderer `0ea78070138a3357858af5d702e8fdbb095d0e6a`. User changes in the original sibling checkout were preserved. The source patch is saved beside this report.

Hand ray/grip IDs 13–16 are appended after existing source values. Pose, hit, hover, click, drag and ray mapping use those IDs consistently. Pinch uses candidate strength hysteresis 0.75/0.55 and fallback distance hysteresis 20/25 mm. Tracking loss, invalid joints and FB system/menu gestures cancel and require release before rearming. Invalid fallback directions are rejected. Meta-specific behavior remains gated by the existing optional extension flag. These thresholds have not been qualified on a headset.

All 307 native build tasks completed using installed NDK 27.1.12297006 and CMake 3.22.1. The exact protobuf archive was found and hash verified. The earlier 14.8 GiB figure was historical free space, not a minimum build requirement. Measured build output was about 365 MiB. Disposable Ninja outputs were cleaned after preserving the artifact, symbols, source and logs; debug symbols were subsequently gzip-compressed losslessly.

`vendors/viro-renderer-1471b3faf.aar` SHA-256: `a733a97e0f15f25eb42f384c749eb12906842a750527fac0e784cd69b8e0d762`. Adjacent provenance records commands, input hashes, build flags and qualification limits. ABI checks retained all 9,750 baseline exported symbols, including JNI, and found no new undefined imports. DT_NEEDED, SONAME, AArch64 architecture and three 16 KiB LOAD alignments match baseline. An independent archive comparison confirmed only `jni/arm64-v8a/libviro_renderer.so` changed. This is ABI/build evidence, not runtime feature parity.

## Moyo integration

The renderer pin and prebuild updater reference the new artifact and checksum. The Tutor Room explicitly sets `handTrackingEnabled`. The mobile package declaration now matches the existing resolved `3.0.1-moyo.1` bridge tarball/root override. The bridge's click/drag/controller source fields are already typed as numbers; no new event API or bridge tarball was needed. Frozen offline lockfile verification passed without lockfile changes.

No scene geometry, app window dimensions, orientation, manifest metadata or board drawing authority was changed. The existing board-pointer and stylus arbitration remain the sole drawing paths. Renderer/config regression tests passed 16 cases; the merged-APK manifest case was skipped because no fresh APK exists. Source inspection does not replace that skipped build check.

## Runtime evidence and remaining work

Argent sees Quest 3S `340YC10GC3014S`, SDK 34. The existing debug app is version 1.0.0/code 1, last updated 2026-11-03. Initial launch reached an “Unable to load script” React Native screen. That installed APK has not been rebuilt with the candidate AAR; no candidate native input is claimed to have run on it.

JavaScript dependency recovery restored exact lockfile pins and made TypeScript checks pass. Metro recovery remains separately tracked; a listener alone does not prove a usable bundle. The current public mobile environment selects mock auth/persona and localhost API. It cannot establish the prompt's deployed-backend homework journey.

Direct-touch ink is not implemented. Existing native plane-drag calculations can feed the current panel surface funnel, but fingertip/poke registration, depth hysteresis and near/far ownership still need a native implementation. The explicit fallback scope is ray pinch only, pending runtime qualification; do not describe touch-to-write as available. No first-run hand coach, two-foot reach qualification, left/one-hand pass, voice/tray acceptance, PICO Java build or entry recording is claimed.

## Checks

- Host C++14 tests passed with `-Wall -Wextra -Werror`: strength/distance boundaries, cancellation/rearm, independent state and invalid direction.
- Native arm64 build completed with exit 0. ABI/archive checks passed.
- App/mobile/web/Payload TypeScript checks passed after exact dependency repair.
- Existing unit/server suites and local pin/config tests are recorded in the homework and gate reports; they do not establish hands behavior.
- Source review was independent of the native author. Device input, frame pacing, APK/manifest generation and release approval remain pending.
