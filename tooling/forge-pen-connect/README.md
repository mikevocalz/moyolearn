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

## Diagnostic7: measured attributes, notifications and OS pairing

The diagnostic extension uses the existing selected device and GATT callback.
It adds no input provider, pressure decoder, pose source, custom vendor write,
second connection, privileged permission or hidden Android API.

Public methods on the same native instance:

- `discoverGattServices(): Promise<string>` inventories actual services,
  characteristics, properties, permissions and descriptors after the matching
  successful service-discovery callback. Inventory keys include real instance
  IDs; subsequent operations accept only those observed keys.
- `readGattCharacteristic(key)` and `readGattDescriptor(key)` perform standard
  asynchronous reads, including actual Report Map/Report Reference attributes
  if the device exposes them. No HID IDs or bit offsets are invented.
- `setGattNotification(key, enabled)` requires observed NOTIFY/INDICATE properties
  and an actual standard 2902 CCCD. It enables the local callback and writes only
  the standard CCCD notification/indication/disable bytes. Success waits for the
  matching descriptor-write callback. This is an explicit standard write,
  rather than passive inspection.
- `getGattDiagnosticsJson()` returns version1 inventory, actual bond state,
  capture/operation state, subscriptions and a 128-event raw ring. Each raw value
  retains at most 512 bytes with actual length and explicit truncation. Sequence
  numbers remain monotonic across reconnects; notification timestamps are taken
  at callback reception. Inventory has explicit retained-size bounds/truncation.
- `stopGattDiagnostics()` stops local notification capture, retaining the GATT
  connection. Explicit unsubscribe or disconnect clears remote CCCDs. Cancelling
  or timing out an in-flight ATT request quarantines that session until reconnect
  so its late callback cannot resolve a newer request. Requests are serialized.
- `requestBond(): Promise<string>` performs user-requested public Android pairing
  for this selected device. It observes the matching device's protected bond
  broadcast and queries actual OS state; only real BONDED resolves successfully.
  The OS handles user confirmation. Its observer survives diagnostic capture
  stop/background, has a 60-second timeout, and is removed on disconnect. No PIN,
  custom authentication or HID-host privileged connect is attempted.

Android API33 uses byte-array read/notification callbacks and the memory-safe
`writeDescriptor(descriptor, bytes)` overload. Older Android devices use guarded
legacy callbacks. GATT/attempt and characteristic/descriptor identities protect
all callbacks. One main-handler owner holds diagnostic state.

Official guidance read for this implementation:
[BLE data transfer](https://developer.android.com/develop/connectivity/bluetooth/ble/transfer-ble-data),
[Gatt callbacks](https://developer.android.com/reference/android/bluetooth/BluetoothGattCallback),
[Gatt operations](https://developer.android.com/reference/android/bluetooth/BluetoothGatt),
[public createBond](https://developer.android.com/reference/android/bluetooth/BluetoothDevice#createBond()),
and [Bluetooth broadcast receiver flags](https://developer.android.com/develop/background-work/background-tasks/broadcasts).

The immutable7 archive was generated against nightly100. Current source templates
now generate8;7 remains retained as the exact hardware-tested baseline. To preserve existing
native outputs during iteration, capture an unrelated-source fingerprint with
`tooling/sync-forge-bluetooth-installed.mjs /tmp/native-before.json --snapshot`,
regenerate with `tooling/vendor-forge-pen-connect.mjs /path/to/nitro-forge --bluetooth-only`,
update only the archive dependency lock using `pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile`,
then run the sync tool with the same fingerprint path. It copies changed BLE
files only, compares all packed/installed bytes, and rejects changes to other
native source/config mtimes. It preserves all build/.cxx directories. A frozen
lock-only check and the integrity regression must pass afterward.

Diagnostic7 verification:

Exact native JVM test/build invocation used, from `apps/mobile/android`:

```sh
ANDROID_HOME=/Users/mikevocalz/Library/Android/sdk \
ANDROID_SDK_ROOT=/Users/mikevocalz/Library/Android/sdk \
ORG_GRADLE_PROJECT_moyoNativeJobPool=2 \
./gradlew :nitro-forge_bluetooth-v1:testDebugUnitTest \
  :nitro-forge_bluetooth-v1:externalNativeBuildDebug :app:assembleQuestDebug \
  -PreactNativeArchitectures=arm64-v8a --max-workers=1 --no-parallel
```

CI can set its own Android SDK paths. The JVM-only task is
`:nitro-forge_bluetooth-v1:testDebugUnitTest`; its JUnit XML is under the installed
package's `android/build/test-results/testDebugUnitTest/` directory.

- Three actual JVM tests pass for the production ATT request gate and raw ring:
  stale completion isolation, timeout quarantine, and byte/count bounds.
- Four Node adapter/integrity tests pass, including actual archive SHA512 versus
  the frozen lock and byte equality for every installed package source file.
- Mobile TypeScript passes. The focused native tests + Quest assembly passed
  in 45 seconds with 1433 of 1523 tasks up to date.
- The sync recorded 14 changed BLE files, 18 identical files retained, and 18,836
  unrelated native source/config files with unchanged sizes and mtimes.
- APK SHA256: `152c0334d4558964ffd6a7cd99948b134b25899adc7571703f9df55ad4b46879`.
  Dex includes the diagnostic session, OS bond helper and new methods. The APK
  contains one arm64 Bluetooth library and one host Nitro runtime.
- Native pool verification passes: 932 compile/31 link edges across 20 builds.
- These are build/source proofs. Actual inventory, bonding, tip contact and
  pressure/input results must be recorded separately from physical hardware.

## Observed Quest outcome: bonded and discovered, no tip input

The physical Quest run of diagnostic7 produced real bond-state transitions
10 ->11 ->12 and a successful service-discovery callback with7 services.
The retained native snapshot has `bondState:12`, `inventoryTruncated:false`,
`totalNotifications:0` and no active subscriptions. The HID service1812 includes:

| Instance | Characteristic | Advertised properties | Descriptors |
| --- | --- | --- | --- |
|49|2A4D Report|READ +NOTIFY|2902 CCCD,2908 Report Reference|
|53,56|2A4D Report|READ +WRITE WITHOUT RESPONSE +WRITE|2908|
|59,62,65|2A4D Report|READ +WRITE|2908|
|68|2A4B Report Map|READ|none|
|70|2A4A HID Information|READ|none|
|72|2A4C HID Control Point|WRITE WITHOUT RESPONSE|none|
|47|2A4E Protocol Mode|READ +WRITE WITHOUT RESPONSE|none|

Reading the actual Report Map instance68 failed immediately with Android's
`BLUETOOTH_PRIVILEGED` SecurityException; diagnostic event11 records that error.
The wrapper reported it and cleared the pending operation. No Report Map bytes,
HID report bytes, tip contact, pressure or pose were obtained. Only the Generic
Attribute Service Changed indication was explicitly enabled and then disabled;
no app HID CCCD subscription or HID control-point write was attempted.

Evidence source: `/tmp/moyo-quest-muse-post-map.json`, SHA256
`f77d8dabed1aa6657106253455f5c162fb2ecb187503868ef480f1731afaad14`.
The main agent/OS inspector additionally observed HID_HOST policy100 allowed,
HidHost state2 connected, an OS HID GATT client alongside Moyo's client and UHID
registration, but no Logitech stylus in fresh InputReader output. These are
separate OS observations, not evidence of working application tip input.

The [Android14 GattService source](https://android.googlesource.com/platform/packages/modules/Bluetooth/+/refs/tags/android-14.0.0_r1/android/app/src/com/android/bluetooth/gatt/GattService.java)
classifies HID2A4A/2A4B/2A4C/2A4D and their descriptors as restricted handles.
Its public read and notification paths enforce the privileged permission.
Consequently, reading Report2A4D as an initial snapshot, reading2908 beneath it,
or subscribing its2902 is not an alternative public-app path around the Report
Map denial. Advertised READ/NOTIFY properties do not override Android policy.
No retries on those protected channels, privilege request, target downgrade,
reflection or hidden HID-host API is part of this implementation.

The measured result is successful transport, OS bonding and service inventory.
A normal OS input/provider event or a documented supported platform integration
is still needed before claiming that this Muse pen draws from actual tip input.
The cause of the missing OS input registration has not been established by these
measurements; bonding alone does not establish tip compatibility.

## Diagnostic8: quarantine after Android permission rejection

The archived 7 package remains unchanged and its physical evidence remains
explicitly labeled 7. Current source templates generate the new 8 artifact,
without repacking 7. Development package files have been synced to 8 and its APK
has been built. The main agent subsequently installed 8 with data-preserving
`adb install -r` (Success); no protected channel was retried or tip proof obtained.

The [Android14 BluetoothGatt implementation](https://android.googlesource.com/platform/packages/modules/Bluetooth/+/refs/tags/android-14.0.0_r1/framework/java/android/bluetooth/BluetoothGatt.java)
sets its private ATT busy flag before the Binder call in `readCharacteristic`
(lines1317-1326) and `readDescriptor` (lines1527-1536). Its failure cleanup catches
RemoteException/TimeoutException, but not SecurityException. The normal callback
or connection-state path clears the busy flag. Therefore a permission-denied
read can leave that client rejecting a later read immediately.

After the observed Report Map denial, a Protocol Mode2A4E read (advertised READ
and outside Android14's protected-characteristic list) returned `Android rejected GATT read request`. Later metadata reads were not
attempted. That rejection does not establish a new characteristic restriction,
unsupported firmware or a peripheral read failure; it is consistent with the
verified framework busy-state path. The client busy flag was not inspected or
modified through hidden/reflection APIs.

The8 fix quarantines the diagnostic gate on SecurityException,
clears/rejects the pending request and reports `blocked:true` with an explicit
reconnect requirement. It preserves the permission boundary. It does not retry
HID reads, request privileged permission or reset Android's private busy flag.
A fresh connection can be used only for legitimate unrestricted diagnostics.

Two new gate regressions cover SecurityException quarantine after cleanup and
stale-error isolation/ordinary failure behavior. All five native JVM tests pass.
Four Node adapter/integrity tests, mobile TypeScript, frozen lock-only validation,
and the native pool verifier also pass. The focused JVM/native/Quest build used
the exact command documented above and passed in 24 seconds (1452 of 1523 tasks up
to date).

Content-aware sync changed only 4 BLE files (gate/session/test/manifest), retained
28 identical packed files, and verified all 18,836 unrelated native source/config
sizes and mtimes unchanged. The public spec, index, generated JavaScript/types
and C++ spec are byte-identical7 ->8. The archive and installed source match the
SHA512 integrity in the frozen lock. No full dependency relink or postinstall
was used.

Artifact8 APK SHA256:
`bec2b85d89a435d83059fa12238d89fd7b6a0685d51b8ee02453664873e074cd`.
It contains one arm64 Bluetooth library and one host Nitro runtime. This is
build/install proof. The hardware diagnosis above remains evidence from 7;
no protected read was retried, and metadata recovery and actual tip input after 8
have not been verified.

## Baseline6 verification recorded on 2026-11-02

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
