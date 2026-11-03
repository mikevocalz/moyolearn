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

## Artifact9: bonded selection and explicit ASA host session

Bluetooth `0.1.0-moyo.9` and portable controller `0.1.0-moyo.7` retain the exact
host Nitro nightly100 runtime. Foreground discovery seeds its bounded selection
with actual OS-bonded BLE/dual devices, which may not advertise while connected
to Android. Their real names and `bonded:true` are retained; RSSI is omitted until
actually measured. Connection still requires a device selected from that current
scan/OS inventory, and a bonded candidate's actual bond is rechecked.

The observed service `e277e685-64cb-4a32-bf65-8766e708a037` and its three
characteristics match Apple's public Spatial Accessory Service, not an inferred
vendor protocol. See [Accessory Design Guidelines R32 Update1](https://developer.apple.com/accessories/Accessory-Design-Guidelines.pdf),
section19.4.8 and tables19-14 through19-17. Version `e3ab6c3d-3e94-7a2c-db59-b8b91723cad4`
and UTI `8640382c-df0a-4e46-9cab-36c05467949e` are READ; Host Version
`3c7f9bdc-3bcb-a75f-c969-9bbd7f058f2b` supports READ/WRITE. Read these actual
freshly discovered attributes before considering negotiation. Earlier reads
following the protected HID Report Map exception did not exhaust this public path.

`configureSpatialAccessoryHost(): Promise<string>` is a narrow explicit developer
action. It requires a successful Version read from this same GATT/discovery and
validates the documented1.1 packet before constructing Host Version1.1 with all
optional feature bits zero. It accepts no address, characteristic, bytes or
protocol version from JS. It writes only the current ASA Host Version object's
acknowledged WRITE and resolves only its matching successful native callback.
The operation shares the existing ATT gate, timeout and connection lifecycle;
start exceptions quarantine it, and cancellation/timeout require reconnect.
Rediscovery/disconnection invalidates the cached version. Events record actual
write bytes/status and do not assert tracking, pressure, tip input or pen readiness.
No automatic write occurs on connection/discovery. No HID/SMP/DFU or firmware
writes, protected-attribute retries, privileged permission or guessed L2CAP channel
are introduced.

The pure policy tests cover the documented version/features layout, allzero
common features, unsigned feature length and rejection of malformed/unknown
versions. The actual portable adapter test preserves a bonded candidate without
fabricating RSSI. Reproduce native tests/build with the exact bounded command
above; hardware reads and any explicit negotiation results are separate evidence.

Artifact9 verification: native JVM10/10 tests and adapter/integrity5/5 tests
passed; app/mobile typechecks passed. Frozen lock-only validation and the native
pool verifier passed (932 compile/31 link edges across20 arm64 Debug builds).
The exact bounded test/build command above succeeded in33 seconds with75 tasks
executed and1448 up to date. Content-aware BLE sync changed10 files and retained
24 identical files, verifying18,836 unrelated native files unchanged. Portable7
changed only its manifest, adapter and types; no dependency relink occurred.

APK: `apps/mobile/android/app/build/outputs/apk/quest/debug/app-quest-debug.apk`.
SHA256: `07e3a761ca06c62fdcf966ef6d8a17238e75776fb20c392d4e98db755271287e`.
ZIP inspection confirms arm64 only, one Bluetooth library and one Nitro runtime;
renderer remains SHA256 `8a0e6d02f4d1bd7dffd55a880c800c3634058d412582fbfbbc1d8a19dc6880a5`.
Actual APK manifest retains SCAN/CONNECT, no BLUETOOTH_PRIVILEGED permission,
MainActivity unspecified orientation and1024x640dp layout, and the Quest VR
activity category. Seven renderer/VR classification checks passed. This build
agent performed no installation or physical ASA write; hardware results are
recorded separately.

## Artifact10: measured advertisement metadata

Bluetooth `0.1.0-moyo.10` adds no Nitro API or protocol operation. Each actual
advertisement retains `serviceUuids` (max32), `serviceData` entries with UUID and
hex bytes, and `manufacturerData` entries with numeric manufacturer ID and hex
bytes. Each collection is capped at16 entries and each byte value at128 bytes;
`actualLength`, per-value `truncated` and overall `advertisementTruncated` expose
any loss. `isConnectable` comes from ScanResult, `scanTimestampNanos` is the real
monotonic scan timestamp, and `scanAgeMs` is calculated against elapsed realtime.
Bonded-only candidates have no invented advertisement fields or RSSI.

Names/RSSI are retained as before. Service/manufacturer identifiers do not assert
Muse identity. A received advertisement refreshes the measured bond flag using
actual Android bond state; it does not inherit a previous bonded seed's flag.
Known candidates continue receiving updates when the50-device cap is reached.
Connection rejects an explicitly non-connectable advertisement when the selected
device is not currently OS bonded, with instructions to enter pairing mode and
select a fresh connectable advertisement. No arbitrary address path is added.

Three JVM regressions exercise actual JSON metadata values, bounds/truncation and
the explicit non-connectable/unbonded rejection policy. Artifact9's ASA API,
cache validation, acknowledged write lifecycle and all generated signatures are
unchanged. This artifact does not initiate any scan, connection or write itself.

Artifact10 verification: native JVM13/13 tests, adapter/integrity5/5 tests,
mobile TypeScript and frozen lock-only checks passed. The bounded build command
above succeeded in18 seconds (71 executed/1452 up to date). Final content-aware
sync and integrity comparison preserve all18,836 unrelated native files; only
four BLE source/test/manifest files differ from9. The public Nitro spec and every
generated binding remain byte-identical9→10. Shared depth2 pools still cover
932 compile/31 link edges across20 builds.

APK SHA256: `6cab73ca52d8b1c696d81850c8af49cb70ed1d09479d972c3b27be206cf907b3`.
The APK retains one arm64 Bluetooth library, one Nitro runtime, the same verified
renderer, MainActivity1024x640dp/unspecified orientation and Quest VR category.
SCAN/CONNECT remain present; BLUETOOTH_PRIVILEGED remains absent. No hardware
actions were performed by this build agent; measured advertisements and any
physical read/negotiation results remain separate evidence.

## Artifact11: include extended advertisements

Apple's [Accessory Design Guidelines](https://developer.apple.com/accessories/Accessory-Design-Guidelines.pdf),
section19.4.7.2/table19-12, require the spatial accessory discovery data in an
extended advertisement payload. Android's [ScanSettings.Builder.setLegacy](https://developer.android.com/reference/android/bluetooth/le/ScanSettings.Builder#setLegacy(boolean))
defaults to legacy-only results. The previous scanner did not override that
default and could therefore exclude the required advertisements. This is a
concrete discovery configuration defect; it does not prove the cause of every
prior connection failure or establish any physical device's firmware behavior.

Bluetooth `0.1.0-moyo.11` explicitly sets legacy=false only when the public
adapter reports extended advertising support, preserving legacy=true otherwise.
No PHY selection or hardware filter is guessed. Two policy tests verify both
capability branches, and metadata records actual ScanResult.isLegacy when an
advertisement is received. The existing selection/ownership guards and bounded
metadata remain intact. No new API, host negotiation, firmware or protected HID
operation is introduced. The same explicit ASA action from9 remains available;
no operation runs automatically.

Artifact11 verification: native JVM15/15 tests (including both extended-scan
branches), adapter/integrity5/5 tests and frozen lock-only checks passed. The
bounded build command above succeeded in20 seconds (71 executed/1452 up to date).
Content-aware sync changed6 files and retained32 identical files while verifying
all18,836 unrelated native files unchanged. Public spec and every generated
binding remain byte-identical10→11; shared depth2 pool verification passed.

APK SHA256: `a9f8f9df4185462b5234a76730557c95d4b7ac64b6742b256e2bd1560baa65ae`.
APK inspection confirms arm64 only, one Bluetooth library/one Nitro runtime,
unchanged renderer, preserved MainActivity1024x640dp/unspecified orientation and
Quest VR category, SCAN/CONNECT present and privileged Bluetooth permission
absent. Source peer review found no material issue. No hardware scan/connect or
write was performed by this build agent; physical discovery proof remains pending.

## Artifact12: scanner capability is not advertiser capability

Artifact11's preflight used `BluetoothAdapter.isLeExtendedAdvertisingSupported`,
an advertiser capability, to gate scanner results. That assumption was incorrect.
Bluetooth `0.1.0-moyo.12` initially requests `ScanSettings.setLegacy(false)` on
all supported Android versions. It does not consult advertiser capability or
select a PHY. Only an actual current `onScanFailed` callback with
`SCAN_FAILED_FEATURE_UNSUPPORTED` (4) permits one legacy-only retry. Other errors
remain visible. A new foreground scan gets its own single retry budget.

The fallback checks current callback/scanner identity before stopping/restarting,
and cancellation racing the Binder start stops only that obsolete callback.
Queued work cannot claim a newer scan. `getGattDiagnosticsJson()` now also returns
`scanConfiguration` with `requestedLegacyOnly`, `fallbackUsed` and `fallbackError`
(null when unused), without requiring a GATT connection or changing its signature.
Four policy regressions cover initial extended results, one unsupported-feature
fallback, no fallback for other errors and independent per-scan budgets.

The Android [scanner source](https://android.googlesource.com/platform/packages/modules/Bluetooth/+/refs/tags/android-14.0.0_r1/framework/java/android/bluetooth/le/BluetoothLeScanner.java)
and [ScanSettings API](https://developer.android.com/reference/android/bluetooth/le/ScanSettings.Builder#setLegacy(boolean))
are the governing scanner path; advertiser support is not a substitute for its
actual failure result. Apple's extended-advertisement requirement above remains
applicable. Artifact11's build proof remains valid, but its capability gating is
superseded by12; its physical scan did not identify an ASA candidate.

Artifact12 verification: JVM17/17 and adapter/integrity5/5 tests plus frozen
lock-only validation passed. Bounded native/Quest build succeeded in18 seconds
(71 executed/1452 up to date). Content-aware sync changed4 files and retained34;
all18,836 unrelated native files remained unchanged. Public spec and every
binding remain byte-identical11→12. Shared depth2 pool verification passed.

APK SHA256: `54552d454e3ae953d23aee194a87c34a1183a69f26dd73d617b7c47529f26c36`.
APK remains arm64 only with one Bluetooth library/one Nitro runtime and unchanged
renderer. Manifest retains MainActivity1024x640dp/unspecified orientation, Quest
VR category and SCAN/CONNECT; privileged Bluetooth permission remains absent.
This build agent did not install or perform hardware operations.

## Artifact13: public system companion-device chooser

Bluetooth `0.1.0-moyo.13` and portable `0.1.0-moyo.8` add an explicit
“Choose Muse with Quest” action when the public companion-device feature/service
is available. The actual Quest exposes this feature and installed system service;
its location service is enabled. No app location permission, privileged role or
Bluetooth permission change is made. The module declares the companion feature
as optional so other Android devices retain their existing path.

The native availability/choose/cancel methods use the public
[CompanionDeviceManager flow](https://developer.android.com/develop/connectivity/bluetooth/companion-device-pairing).
A BLE name filter matching Muse requests a single-device OS chooser. Its actual
IntentSender is launched from the current React activity. Resolution requires a
matching activity request/result, RESULT_OK and a genuine selection with an
association owned by this application, verified against public association data.
API34 uses the actual associated ScanResult when available; older supported APIs
use their actual device/association result. No device address is supplied by JS.
A selected actual native device joins the bounded candidate set; unknown RSSI is
omitted. This does not connect, bond or prove pen readiness automatically.

The native request has a120-second timeout, unique request code, owner generation,
activity listener cleanup and host-destruction cancellation. Pausing for the OS
chooser is allowed. Cancellation invalidates ownership immediately before queued
UI cleanup; stale queued results cannot insert into a replacement scan, and
queued cancellation captures only its old request. Raw diagnostics retain chooser
generation/state, actual activity result and confirmed association ID separately.

Portable source overrides are reviewed in `portable/src`; the generator copies
them after the previous consumer patches. The controller enters system-pairing
while Android UI is open, then exposes only the actual selected device as found
for a normal explicit connection. Closing/cancellation never claims input ready.
Eight actual controller/adapter boundary tests cover capability, real selection,
stale cancellation, permission races and old-link cleanup. They run with:
`node --import tsx --test tooling/forge-pen-connect/portable/tests/system-chooser.test.ts`.
The OS chooser and physical selection require separate hardware proof.

Artifact13 intermediate verification: the bounded native/Quest build succeeded in17 seconds
(71 executed/1452 up to date). Existing native JVM17/17, portable chooser8/8 and
adapter/integrity5/5 tests passed, as did frozen lock-only and shared depth2 pool
checks. Native codegen is exact nightly100. The first sync verified18,836
unrelated native files unchanged; portable8 then intentionally updated only its
manifest and four source overrides. Subsequent BLE fixes used a new baseline
after that intentional portable manifest update and preserved it. No full
package relink or prebuild was used. Both consumed archives match every installed
source byte and their frozen lock integrity.

Intermediate uninstalled APK SHA256: `f121432d746da7e453d38552a173b759b6762dfb680e42935934a2a3131aaf9b`.
This build preceded the final atomic chooser publication correction below.
ZIP contains arm64 only, one Bluetooth library/one Nitro runtime, and the unchanged
verified renderer. Actual manifest includes optional companion-device support,
SCAN/CONNECT, preserved MainActivity1024x640dp/unspecified orientation and Quest
VR category, with no privileged Bluetooth permission. This build agent performed
no hardware operations or installation; OS chooser visibility/selection and
subsequent real pen input remain separate acceptance evidence.

Final artifact13 adds the atomic publication check immediately before starting
the chooser: generation validation and assigning the owned request occur under
the same lock as cancellation. Cancellation therefore either prevents publication
or captures that exact new request for cleanup. The earlier intermediate APK
above was not installed. Final repack preserved all39 other packed files; only
Hybrid changed in the final sync, and the post-portable native baseline remained
unchanged. Targeted JVM17 tests, adapter/integrity5 tests and frozen lock checks
passed; final bounded build succeeded in18 seconds (68 executed/1454 up to date).
Final APK SHA256:
`b08e04fb00623f52f5bc2127c4e20c5a93ed4a1ad2784a9b60beae70260c8f26`.
Renderer/runtime/window/VR manifest identity was rechecked. No installation or
hardware action was performed by this build agent.

## Physical install and discovery ledger (2026-11-03)

The main agent installed each following APK with data-preserving `install -r`
and reported Success. These are installation/discovery observations, not working
pen or pressure evidence:

| Artifact | Installed APK SHA256 | Bounded physical observation |
| --- | --- | --- |
|10|`6cab73ca52d8b1c696d81850c8af49cb70ed1d09479d972c3b27be206cf907b3`|Installed; superseded before a retained10 scan result.|
|11|`a9f8f9df4185462b5234a76730557c95d4b7ac64b6742b256e2bd1560baa65ae`|Installed base APK hash independently matched. Foreground scan found40 candidates, none matching the observed Muse name or ASA UUID/data. Advertiser-capability gating was subsequently corrected in12.|
|12|`54552d454e3ae953d23aee194a87c34a1183a69f26dd73d617b7c47529f26c36`|Installed base hash independently matched. Actual scan configuration requested extended results with no fallback. A fresh37-candidate scan had no Muse-name/ASA candidate. This does not prove global hardware incompatibility.|
|13|`b08e04fb00623f52f5bc2127c4e20c5a93ed4a1ad2784a9b60beae70260c8f26`|Final publication-fixed APK installed successfully. CDM chooser selection and actual input acceptance remain pending. Intermediate13 hashf121 was never installed.|

At the first13 startup inspection the headset reported asleep/keyguard showing,
with no resumed Moyo activity; reverse8081 was present. After the user woke the
headset, a fresh read-only snapshot showed Moyo MainActivity top-resumed/visible,
PID27774, actual React “Running main” at00:42:27.967 and Nitro/Hermes/MMKV
initialization at00:42:32.359 (headset local log time). No fresh own-process fatal
or bundle-load error appeared in that bounded log window. Immediate CDP attachment
absence therefore did not establish a persistent native startup failure. Physical
OS chooser outcome remains separate from this successful JavaScript startup.

## Artifact14: accept either genuine association completion route

Artifact13's native adapter required an Activity result even after receiving a
real `onAssociationCreated`. That was too strict: Android33+ documents the
association callback as an independent completion route. AOSP14
[AssociationRequestsProcessor](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-14.0.0_r1/services/companion/java/com/android/server/companion/AssociationRequestsProcessor.java)
sends that callback before the separate optional Activity result receiver. The
[public callback contract](https://developer.android.com/reference/android/companion/CompanionDeviceManager.Callback#onAssociationCreated(android.companion.AssociationInfo))
also permits completion without a preceding approval callback.

The actual Quest13 service snapshot contains two associations owned by Moyo,
IDs1/2, both named Logitech Muse and approved at00:43:58/00:44:02 local time.
Their real system BLE records advertised HID1812/Battery180F, RSSI-53/-60.
These prove system discovery and association, not bond/GATT/input. The later
native generation23 discovery_timeout cannot be assigned to those earlier
associations. The retained discovery log was empty, so the exact Activity relay
failure is not established.

Bluetooth `0.1.0-moyo.14` sends both genuine completion routes through the same
owned-association/device/name/generation verification. The first verified route
settles once and removes listeners; duplicates and cancellation cannot republish.
Raw `systemChooser.completionSource` is `association-callback` or `activity-result`.
A callback-only success leaves resultCode null, rather than fabricating RESULT_OK.
Four JVM regressions use the actual extracted completion policy to cover callback
without Activity delivery, duplicate routes, cancellation and rejected verification.
No old association is selected automatically, no stale address is restored and no
new public API or portable8 change is made. A fresh user-selected chooser result
is still required. Physical bond/read/input acceptance remains pending.

Artifact14 verification: native JVM21/21 tests passed, including four new
completion-policy regressions. The exact bounded test/Quest build succeeded in19
seconds (70 executed/1452 up to date). Adapter/integrity5/5 and frozen lock-only
checks passed. Public spec and every binding are byte-identical13→14; portable8
is unchanged. Content-aware sync changed4 files and retained38, preserving the
18,836-file unrelated native baseline.

Final14 APK SHA256:
`de7b3f3e31d4f4da862e268d2a1ce6e48fad53594ca027916f622366c0688f05`.
Actual APK retains one Bluetooth library/one Nitro runtime, the same renderer,
MainActivity1024x640dp/unspecified orientation and Quest VR category; privileged
Bluetooth permission remains absent. Source peer review passed. No hardware
operation or installation was performed by this build agent. Main-agent physical
install/chooser/read/input results must be added separately.

## Artifact15: explicit own-association history

Bluetooth `0.1.0-moyo.15` and portable `0.1.0-moyo.9` add an explicit “Previously
associated Muse” action on Android13+ with companion-device support. It reads
only this application's public `getMyAssociations()` records, filters their real
Muse names, excludes self-managed records and deduplicates by actual OS address.
The selected native object comes from its actual associated BLE device when
available, or the address in that owned association. No JS address is accepted.
Results are marked `selectionSource: association-history` with their genuine
association ID and current measured bond state. Historical RSSI and advertisement
metadata are deliberately omitted. Historical RPA addresses may be stale; this
is not a fresh discovery or reconnect guarantee.

The optional Promise-returning native method is
`listAssociatedMuseDevices(): Promise<string>`. It returns only the bounded
history candidate array and adds those actual OS-derived devices to the same
native candidate owner. An immediate generation token and captured old chooser
are established atomically; cancellation/new scans invalidate queued publication.
The controller requires an explicit history action and subsequent explicit
Connect. It never auto-connects, re-associates, bonds or marks input ready. Older
Android retains the normal chooser path; history is gated at API33 for real
association IDs. Portable regressions cover history provenance, cancellation,
no historical RSSI, no automatic connection and the API32 exclusion.

The validated14 archive is preserved unchanged. Its independent receipt is
`vendors/forge-bluetooth-14-validation.json`, including the source-archive hash,
exact nightly100 pin and actually installed14 APK hash. Preparing15 does not
replace the record of14's physical callback/GATT observations or establish15
hardware acceptance.

Artifact15 preparation verification: the bounded native/Quest build succeeded
in38 seconds (74 executed/1448 up to date). Native JVM21/21, portable chooser/history
11/11 and adapter/integrity5/5 tests passed, together with app/mobile typechecks,
frozen lock-only and shared depth2 pool checks. BLE content-aware sync changed8
files and retained36 while verifying18,836 unrelated native files unchanged;
portable9 then intentionally changed only its manifest and four source overrides.
Both archives match their receipts and every installed source byte. Codegen and
runtime remain exact nightly100, without package relink or prebuild.

Prepared15 APK SHA256:
`780f0d20b6366f63d3c534234f8bb406628c5dc6292ded07271f8e83b879f024`.
It retains one Bluetooth library/one Nitro runtime, the same renderer,
MainActivity1024x640dp/unspecified orientation and Quest VR category, with no
privileged Bluetooth permission. Source peer review passed the ownership/API33
checks. This is preparation/build proof only:15 was not installed or exercised
on hardware by this build agent. The main agent's current physical phase remains
on the separately retained14 build until an explicit install is recorded.
