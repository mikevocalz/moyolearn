# Native dependency admission, 2026-11-14

Scope: independent source and binary-artifact checks on Linux for the PR freshness repair. This report does not qualify a native application build or physical-device behavior. Exact package URLs, verified registry SHA-512 values, binary hashes and check results are recorded in `native-dependency-admission-2026-11-14.json`.

## Packages and source identity

Downloaded and independently verified the actual npm archives for WebGPU `0.21.4`, shared Dawn `158.0.0`, all three Graphite `158.0.0` platform packages, React Native Skia `2.14.0` and Gesture Handler `3.5.0`. No install lifecycle scripts ran while unpacking the audit copies.

Graphite Android/iOS/macOS and shared Dawn all report publisher commit `9f61caf3f4a59e488fa4cf5c557d7b2e4846d854`. The Graphite manifests declare `m158`; shared Dawn declares source `1716e88cc9e58398fab5d4473f7f2e858667b677` with the three admitted patches. WebGPU requests exactly that shared-Dawn version and declares `chrome-m158`.

The admission's three private Skia headers were downloaded from pinned Skia commit `75584a96108b2bf0b1c74b0536126fa4917b64a8` and verified by the production checksum routine. Cold and warm executions of `enableSkiaGraphite` both passed against the actual artifacts. All 16 installer contract tests passed after the cache fix below.

## Fixed a stale Android binary override

The installed React Native Skia Gradle file gives its local `libs/android` directory precedence over the npm Graphite package. The previous installer invalidated only its `.version` file. An older locally built `libskia.a` could therefore override the newly admitted package while the installer wrote the new Dawn marker.

The installer now removes this generated local Android directory before publishing the admission markers. The independently verified npm package remains the binary source. A regression covers both cold and warm installs; an execution against the real 158 artifacts also removed a deliberately seeded stale local override. Existing package/source/header checks and the shared-Dawn guards remain active.

## Binary checks and their limits

For all four Android ABIs, staged Dawn bytes exactly match the shared-owner package and every LOAD segment is aligned to 16 KiB. The 107 Dawn imports referenced by each Graphite `libskia.a` are all exported by the corresponding shared library. The arm64 Dawn binary declares Android API 26 and NDK r27d; the app's configured minimum is API 26, with higher headset flavor floors. Compared with 157.1.0, its newly referenced external functions are `fabs@LIBC` and `pthread_setname_np@LIBC`. Native linking and runtime acceptance still belong to the platform build/device lanes.

All library files declared by the downloaded Apple XCFramework manifests exist. Graphite iOS provides device, simulator and Catalyst slices; Graphite macOS provides arm64/x86_64. Shared Dawn provides those platforms plus tvOS. None provides an xros slice. Preserve the repository's visionOS autolinking exclusions.

The actual Skia 2.14 `Package.swift` explicitly selects Ganesh and excludes the Graphite sources. Moyo's `ios-native` workflow uses SwiftPM. That lane can validate the new WebGPU/Dawn dependency with the existing Ganesh Skia backend; its success cannot establish an iOS Graphite build. The CocoaPods Graphite path and the WebGPU SwiftPM manifest retain their version-mismatch guards. This repair does not change backend ownership.

## visionOS lock evidence

The existing `patches/react-native-gesture-handler.patch` applies cleanly to the actual 3.5.0 archive. It retains the visionOS refresh-rate guard; the package's own podspec declares visionOS and reads version 3.5.0 from its manifest.

The committed visionOS lock still records `RNGestureHandler (3.4.0)`. Do not manufacture its new spec checksum. On the native runner, `tooling/prepare-visionos.mjs` builds pinned ViroKit and runs `pod install`; `.github/workflows/visionos.yml` already uploads the resulting `apps/mobile/visionos/Podfile.lock` in `visionos-native-diagnostics`. Retrieve that generated lock and compare it with the committed file after the new dependency set resolves, then retain the app compile result separately.

Android/iOS application builds with the final regenerated lockfile, visionOS resolution/build with Gesture Handler 3.5.0, and physical rendering/input/lifecycle checks remain required. Host artifact inspection does not substitute for those results.

## Workspace verification

The regenerated lock changes only seven package versions. A frozen install with the repository's pinned pnpm 10.32.1 completed successfully, followed by the production Graphite installer against those installed packages. The 40 dependency-policy contracts and 16 installer contracts all pass (56 total, zero skipped). `business-studio-npm.mjs --check` passes against the live registry with the regenerated lock and committed receipt.
