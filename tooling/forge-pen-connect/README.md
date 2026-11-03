# PR20 Bluetooth consumer adaptation

Source: mikevocalz/nitro-forge PR20, commit
`c213f1ca3f1d604a27ccf922362f0de3e4605831`.

`node tooling/vendor-forge-pen-connect.mjs /path/to/nitro-forge`
recreates both private tarballs and updates their hashes in
`vendors/forge-source-lock.json`. Board and icon source pins remain intact.

Consumer changes, applied before packing:

- Match Nitro, nitro-core and Nitrogen exactly to Moyo's installed nightly100;
  regenerate native and JS bindings. No nightly115 runtime is installed.
- Declare the Bluetooth public constructor that the PR's usage requires.
- Add the missing Android Gradle entry, preserve host ABI selection, enable
  Prefab and include generated autolinking. Explicit RN configuration registers
  ForgeBluetoothPackage on Android and disables iOS. The package's existing
  Bluetooth permission manifest merges into the host; no Horizon window,
  orientation or manifest metadata is replaced.
- Use the nightly100 manual Promise API for callback-owned GATT completion.
  The first actual Kotlin compile rejected PR20's Promise.async(resolve,reject).
- Give each scan ownership so an obsolete scan's finally block cannot stop
  the newly started scanner after cancellation/rescan.
- Remove build-only devDependencies from the consumed archives.

Run `node --test tooling/forge-pen-connect/vendor.test.mjs` against the actual
installed artifact to check scan cancellation ownership and runtime pinning.
The app's controller integration test checks that a GATT link remains linked,
awaiting verified native input.

This package scans for real nearby BLE devices after permission and explicit
user action. It connects only a selected result. A successful GATT connection
is not Logitech Muse pressure, buttons, positioning, or 6DoF support. No Muse
UUID, vendor packets or Quest compatibility is invented. Device scan/link
results must be reported separately from the native build result.

Native connection ownership additionally differs from PR20: an attempt identity
owns its GATT, timeout, and promise. Closing cancels and rejects a pending
attempt; stale callbacks and old timeouts close only their own GATT and cannot
mark a replacement connection linked. The adapter forwards cancellation only
while its own native connection is pending. A regression exercises cancellation
through the actual installed adapter without a hardware success claim.

Native scan callbacks also check the current callback identity before changing
candidates or errors, so queued callbacks from a stopped scanner cannot affect
a rescan. Device labels use the real advertising name, then cached name, then
an explicit unnamed label with an address suffix; unnamed real advertisements
are not silently discarded. Permission revocation while reading an address
ignores that result.

## Verification recorded on 2026-11-02

For final `0.1.0-moyo.6` artifacts:

- Nightly100 Nitrogen generation and frozen dependency restore passed.
- Three actual installed adapter tests passed; mobile TypeScript passed.
- The bounded arm64 Quest build passed in 15m39s (1516 tasks). Command from
  `apps/mobile/android`, with Android SDK environment variables set:
  `ORG_GRADLE_PROJECT_moyoNativeJobPool=2 ./gradlew :nitro-forge_bluetooth-v1:externalNativeBuildDebug :app:assembleQuestDebug -PreactNativeArchitectures=arm64-v8a --max-workers=1 --no-parallel`.
- APK: `apps/mobile/android/app/build/outputs/apk/quest/debug/app-quest-debug.apk`.
  SHA256: `8429b165dea3dde7b22c642cfcab6345731ac47e2b713c632932dad20078d35e`.
  ZIP inspection found arm64 only, one `libNitroForgeBluetoothV1.so`, one
  `libNitroModules.so`, and the Bluetooth package/implementation classes in dex.
  The installed host runtime and lock select only nightly100.
- Actual APK manifest inspection confirmed SCAN/CONNECT, legacy Bluetooth
  permissions capped at API30, the established 1024x640dp window, and unchanged
  unspecified MainActivity orientation. No privileged Bluetooth permission.
- Actual Bluetooth arm64 ELF links NitroModules, fbjni, jsi and reactnative;
  exports JNI_OnLoad; and uses 16KiB LOAD alignment. Unstripped SHA256:
  `4804cf7b134fa0b80f8787bfc6b8b66354e39ed2f2aa6c74e83619d1f798f9e6`.
- The generated native pool verifier passed: 932 compile and 31 link edges in
  20 arm64 Debug builds. An obsolete unbounded app cache was preserved outside
  the project at `/tmp/moyo-app-unbounded-cxx-1i4p4x69`; the current bounded app
  cache and all APK outputs remain in place.
- No physical Bluetooth scan, connection or Muse input was verified by this
  build agent. Those results must be recorded separately from this build proof.

An earlier combined build stopped when dependency source files disappeared;
its cause was not established. Frozen restore and the final bounded build above
completed successfully without clean or prebuild. App intermediates and the
previous APK were preserved during recovery.
