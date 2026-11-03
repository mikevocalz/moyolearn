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

- Nightly100 Nitrogen generation passed.
- Three actual installed adapter tests passed; mobile TypeScript passed.
- `:nitro-forge_bluetooth-v1:externalNativeBuildDebug` passed with the shared
  depth-2 pool. The actual arm64 library required `libNitroModules.so`, fbjni,
  jsi and reactnative. Its unstripped SHA256 was
  `4804cf7b134fa0b80f8787bfc6b8b66354e39ed2f2aa6c74e83619d1f798f9e6`.
- The combined Quest APK build did not finish: an unrelated existing package's
  CMake source disappeared when root node_modules was removed during the run.
  The previously compiled Bluetooth ELF was also in that removed tree.
  Restore frozen dependencies and rerun the bounded build before claiming a
  packaged or installed Bluetooth transport.
- No physical Bluetooth scan, connection or Muse input was verified here.

Recovery preserves app intermediates: run `pnpm install --frozen-lockfile` at
repository root after dependency deletion has stopped. From
`apps/mobile/android`, set Android SDK environment variables and
`ORG_GRADLE_PROJECT_moyoNativeJobPool=2`, then run
`./gradlew :nitro-forge_bluetooth-v1:externalNativeBuildDebug :app:assembleQuestDebug -PreactNativeArchitectures=arm64-v8a --max-workers=1 --no-parallel`.
Do not run clean or prebuild for this recovery.
