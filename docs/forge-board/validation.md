# Validation record

Checks below ran on the implementation worktree on 2026-11-02. These are separate
from physical-device interaction evidence.

| Check | Result | Command / evidence |
| --- | --- | --- |
| Existing board, session, recovery and source adapter | PASS, combined document/gesture/keyboard run: 56 tests | `node --test packages/app/features/tutor/board-doc.test.ts packages/app/features/tutor/board-session.test.ts packages/app/features/tutor/forge-board-source.test.ts packages/app/features/tutor/forge-board-session.test.ts packages/app/features/tutor/forge-board-storage.test.ts packages/app/features/tutor/forge-board-history.test.ts` |
| Actual pinned Forge encoder/binding/compiler | PASS, 3 tests | `pnpm --filter @acme/app test:forge` |
| Installed Forge icon contracts | PASS, 5 tests | `node --test 'tests/*.test.js'` from `node_modules/@nitro-forge/icons` |
| Web/native keyboard shim | PASS, included in the combined 56-test run | `node --test packages/ui/whiteboard-history.test.ts` |
| Moyo app, UI and mobile types | PASS | `pnpm --filter @acme/app --filter @acme/ui --filter mobile typecheck` |
| Window/orientation contract | PASS, 6 tests | `node --test apps/mobile/plugins/__tests__/spatial-window-contract.test.cjs` |
| Dependency lock integrity | PASS | `pnpm install --frozen-lockfile --ignore-scripts`; normal install also ran the existing Graphite postinstall |
| Android JS export | PASS, final Android export | `pnpm --filter mobile exec expo export --platform android --output-dir /tmp/moyo-forge-export` |
| Forge Rive source/asset | PASS | [Headless evidence](../../probes/forge-icons/evidence/render-evidence.json), source tests, CLI verify/build and inspect |
| Owning Forge native build | PASS | [Draft PR #22](https://github.com/mikevocalz/nitro-forge/pull/22); full Android lab APK and real arm64 ELF DT_NEEDED `libNitroModules.so` |
| Isolated MMKV fixture model | PASS, 3 tests | `node --test apps/mobile/src/forge-board-probe/model.test.ts` |
| Moyo Quest APK/install | PASS | `:app:assembleQuestDebug`, 26m17s, 1492 tasks; `adb -s 340YC10GC3014S install -r` returned Success |
| Device PNG save | PASS on installed Quest with updated development JS | Created `MoyoExports` through the system folder picker, granted that folder, wrote/read back the PNG, then independently pulled the saved file |
| Connection/export/frame follow-up contracts | PASS, 20 tests | PNG saver 6, pen verification 2, resized content geometry 3, installed Bluetooth artifact 3, window contract 6 |
| Actual Forge and pen controller integration | PASS, 4 tests | `pnpm --filter @acme/app test:forge` |
| Quest Bluetooth follow-up APK/install | PASS | Final `assembleQuestDebug`, 15m39s, 1516 tasks; Meta CLI `adb install -r` returned Success |
| Physical Muse link/bond and inventory | PASS for transport, OS bond and discovery only | Diagnostic7 reached real bond state 12 and discovered7 services; [retained evidence](evidence/muse-quest-diagnostic7.json) |
| Muse tip contact/pressure | NOT VERIFIED | The app received no tip reports or pressure bytes; HID Report Map access raised Android SecurityException |
| Diagnostic8 native policy | PASS, 5 JVM tests | `:nitro-forge_bluetooth-v1:testDebugUnitTest`; exact combined invocation below |
| Diagnostic8 artifact, parser and verification contracts | PASS, 11 tests (main agent final run) | `node --test tooling/forge-pen-connect/vendor.test.mjs packages/app/features/tutor/forge-pen-diagnostics.test.ts packages/app/features/tutor/forge-pen-verification.test.ts` |
| Diagnostic8 app/UI/mobile types | PASS | `pnpm --filter @acme/app --filter @acme/ui --filter mobile typecheck` |
| Diagnostic8 APK build/install | PASS | 24s, 1523 tasks; main agent data-preserving `adb install -r` returned Success; no new tip proof |
| Generic public XR input fallback | PENDING physical validation | Scene entry was launched; no confirmed target/profile/controller or pen frames yet |
| Physical resize appearance | User-reported PASS | User resized the middle content and answered “Looks correct”; geometry tests are separate from that visual report |
| Native Rive loading, full Forge preview, pen pose/haptics, iOS/iPadOS/Duo | NOT RUN | No source-test result is counted as hardware support |

The Quest 3S selected through Argent is serial `340YC10GC3014S`, Android API 34.
The user authorized installation. Argent's reinstall action uninstalls first and
clears data; it was rejected for this task. The supported update path is `adb
install -r` after the APK is verified. Launch/discovery/interaction use Argent.

## Physical Quest installation

- Device: Quest 3S `340YC10GC3014S`, Android API 34.
- APK: `apps/mobile/android/app/build/outputs/apk/quest/debug/app-quest-debug.apk`, 332 MiB.
- SHA-256: `bb6c355e4833f1da4e0bbecf15a80e5089322f994d601b0d5a936fd5b1e1b0ab`.
- AAPT verified `com.moyolearn.app`, min SDK 29, target SDK 34, MainActivity
  orientation unspecified and 1024x640dp layout. No window-contract change.
- Native pool check passed: 929 compiler and 30 linker edges across 19 arm64
  debug builds use the existing shared depth-2 pools.
- Update install used `-r`; no uninstall, app-data clearing or permission reset.
- USB reverse port 8081 established; Metro is running for this development build.
- After the user unlocked the headset, Argent successfully restarted Moyo and
  opened `moyo://forge-board-probe`; the validation title and production toolbar
  were present in the physical Quest accessibility tree. A stale Metro file map
  initially returned HTTP 500; restarting our Metro with a cleared cache restored
  successful bundling and launch.
- The first recorded drawing/export runs did not pass: tap acknowledgments did
  not establish delivery. Argent's Quest screen-sharing input agent repeatedly
  aborted with SIGABRT; discovery remained available through its independent
  Android accessibility service. No 1280-pixel scaling defect was established.
  The failed recordings are not passing E2E evidence.
- With that insufficiency established, Meta CLI ADB input used fresh accessibility
  bounds. One synthetic stroke produced `Marks: 1` and undo availability. The
  explicit `Surface: ready` status follows a snapshot bridge round trip.
- The production Undo button then produced `Marks: 0` and `Can redo: yes` on
  device. Redo activation and save/reopen remain unverified; their source tests
  are separate from this incomplete physical path.
- Device save wrote `/sdcard/MoyoExports/moyo-board-2026-11-03T02-52-22-833Z.png`.
  The app verified the saved bytes before success. Independent Meta CLI pull
  confirmed a 444x344 RGBA PNG, SHA-256
  `0f2d37b18527fbf8a6d815c2226bf816d3161aac3261c4300e9fe373c28195c5`.
  Visual inspection shows black ink on light gridded paper. This is synthetic
  board input and file persistence proof, not Muse hardware input proof.
- The user connected Muse to the Mac by USB. Read-only descriptors identify
  `LogiNApp`, vendor `046D`, product `D11E`, with two CDC ACM serial interfaces.
  No serial port was opened and no firmware or settings command was sent.
  The descriptor version is not treated as a verified firmware version or a
  Bluetooth/Quest tracking capability.
- Bluetooth radio inspection found it on with no bonded devices. The user then
  requested the Forge PR #20 Bluetooth connection flow; its Moyo integration is
  being built separately from drawing validation.
- This install does not enable the gated Forge backend or prove Muse hardware
  tracking, native Rive loading or Skia v3 rendering in Moyo.

## Bluetooth transport6 follow-up installation

- Transport6 APK: same Quest debug path, 338 MiB, SHA-256
  `8429b165dea3dde7b22c642cfcab6345731ac47e2b713c632932dad20078d35e`.
- Final native build passed in 15m39s with 1516 tasks after frozen dependency
  restoration. Native pool verification passed: 932 compiler and 31 linker edges
  across 20 arm64 Debug builds. The superseded unbounded app CMake cache was
  moved intact outside the active tree; current bounded outputs were retained.
- Packaged arm64 only, one Bluetooth library and one NitroModules runtime.
  DEX contains the Bluetooth package and implementation; actual APK manifest
  contains SCAN/CONNECT and retains 1024x640dp with unspecified orientation.
- Meta CLI update install used `-r` and returned Success. No uninstall or app-data
  clearing. The updated app loaded the fixture and completed its snapshot-ready
  handshake using the refreshed Metro development bundle (HTTP 200).
- The physical app reached native scanning and then displayed
  `Connected to Logitech Muse. Native pen input must still be verified.`
  and `Bluetooth linked. Waiting for compatible pen input; pressure and spatial
  tracking remain unverified.` Closing that dialog leaves the established link
  owned by the mounted screen. This is a Bluetooth transport result, not a Muse
  Android drawing driver or proof of pressure/position input.
- Android's GATT Client Map independently showed one connection for
  `com.moyolearn.app`. Its bonded-device list was empty. InputReader exposed no
  Logitech/Muse input device or Bluetooth stylus source at that point. These
  observations motivate actual service, notification and system-bond diagnosis;
  a registered client is not sufficient proof of a working input provider.
- The user clarified that the goal is working pen input and then specified tip
  contact, rather than a side/power button. The supplied Downloads/musefiles SDK was inspected: its README,
  Interaxon license, EEG example and PDF pages 10/12 identify Muse headbands,
  not Logitech's pen. No binaries from that SDK were installed or executed.


## Diagnostic7 physical Muse findings

This section records the installed 7 device run, not the later 8 build.
Its APK SHA-256 is
`152c0334d4558964ffd6a7cd99948b134b25899adc7571703f9df55ad4b46879`.
The [retained diagnostic7 evidence](evidence/muse-quest-diagnostic7.json)
has SHA-256 `30138db88625e7618ce54b84f0681d8dc8cc98095e3cdbf29ced66981546d291`.

- Explicit public Android pairing produced actual bond states 10 -> 11 -> 12.
  Service discovery completed with status 0 and 7 services, without inventory
  truncation. HID service 1812 contains 10 characteristics, including Report Map
  2A4B instance 68 and Report 2A4D instance 49 with READ/NOTIFY plus 2902/2908.
- Separate read-only OS inspection found the device bonded, HID_HOST policy
  allowed, HidHost connected and UHID registered. Fresh Android InputReader
  output still contained no Logitech/Muse input device. Bonded/HidHost connected
  is not equivalent to an application receiving a stylus event.
- Reading the actual Report Map through the existing native connection raised
  Android's `BLUETOOTH_PRIVILEGED` SecurityException, recorded as diagnostic
  event 11. No Report Map bytes, tip-contact reports, pressure or pose were
  obtained. The retained app count is zero reports; this does not establish that
  the pen transmits no data to another OS component.
- Only Generic Attribute Service Changed 2A05 indication was enabled and then
  disabled. No app HID CCCD or HID Report/Control Point write was attempted.
  No privileged permission, reflection or hidden HID-host API was added.
- The [Android14 GattService source](https://android.googlesource.com/platform/packages/modules/Bluetooth/+/refs/tags/android-14.0.0_r1/android/app/src/com/android/bluetooth/gatt/GattService.java)
  protects HID 2A4A/2A4B/2A4C/2A4D handles and their descriptors. Reading an input
  Report 2A4D snapshot or 2908, or registering its notifications, is therefore not
  an alternative public-app path around the observed Report Map denial. Those
  protected channels were not retried.
- After that denial, one Protocol Mode 2A4E read returned an immediate Android
  rejected-request result (main-agent observed event 12). Subsequent metadata reads were not
  attempted. The [Android14 BluetoothGatt source](https://android.googlesource.com/platform/packages/modules/Bluetooth/+/refs/tags/android-14.0.0_r1/framework/java/android/bluetooth/BluetoothGatt.java)
  sets its private busy flag before the Binder read and does not clear it when
  SecurityException escapes. This is consistent with the later rejection;
  the private flag was not inspected or modified, and this result is not proof
  of another peripheral restriction.
- Generic XR fallback testing remains pending. The main agent observed bundle
  HTTP 200 and `RunningVRQuestScene(rootTag11)`, establishing scene entry only.
  No target/profile/controller frames or real pen frame has been confirmed.

The verified hardware result is pairing and discovery. A working Muse tip or
pressure driver has not been demonstrated on this Quest.

## Diagnostic8 source/artifact and build verification

Artifact 8 quarantines diagnostic requests after SecurityException and reports
that this app's GATT client requires disconnect/reconnect. It does not bypass
HID restrictions, retry protected reads or create an input provider. The hardware
diagnosis above was captured on 7. The main agent has now installed 8 using
Meta CLI `adb install -r`, which returned Success without uninstall or app-data
clearing. No protected channel was retried and no new tip/pressure proof was
obtained from this update. Generic physical XR input validation remains pending.

- Native source templates, JVM test source and Gradle template match the 8 archive
  byte-for-byte (9 template files checked). Both mobile/app dependency pins and
  provenance select `nitro-forge-bluetooth-v1-0.1.0-moyo.8.tgz`; the frozen lock's
  SHA512 and every installed packed source byte match the actual archive.
- The public spec, index, generated JS/types and generated C++ are identical
  between 7 and 8. Content-aware sync changed only 4 BLE files and retained 28
  identical files. All 18,836 unrelated native source/config sizes and mtimes
  were unchanged; there was no full dependency relink or postinstall.
- Five native JVM regressions passed, including stale-request isolation,
  timeout quarantine, SecurityException quarantine, ordinary-failure behavior,
  and raw-byte ring bounds/truncation. The main agent's final Node run passed 11
  tests: 4 adapter/integrity, 5 parser and 2 pen-verification contracts.
  App/UI/mobile typechecks passed.
- The combined native test/Quest build passed in 24s with 1523 tasks
  (71 executed, 1452 up to date). The generated native pool verifier passed:
  932 compiler and 31 linker edges across 20 arm64 Debug builds.
- Built APK: `apps/mobile/android/app/build/outputs/apk/quest/debug/app-quest-debug.apk`,
  SHA-256 `bec2b85d89a435d83059fa12238d89fd7b6a0685d51b8ee02453664873e074cd`.
  It contains one arm64 Bluetooth library and one NitroModules runtime. Actual
  manifest inspection retains SCAN/CONNECT, 1024x640dp and unspecified
  MainActivity orientation, without BLUETOOTH_PRIVILEGED.

Exact native JVM/build invocation, from `apps/mobile/android` with this local
SDK installation (CI may use its own SDK path):

```sh
ANDROID_HOME=/Users/mikevocalz/Library/Android/sdk \
ANDROID_SDK_ROOT=/Users/mikevocalz/Library/Android/sdk \
ORG_GRADLE_PROJECT_moyoNativeJobPool=2 \
./gradlew :nitro-forge_bluetooth-v1:testDebugUnitTest \
  :nitro-forge_bluetooth-v1:externalNativeBuildDebug :app:assembleQuestDebug \
  -PreactNativeArchitectures=arm64-v8a --max-workers=1 --no-parallel
```

These build proofs do not establish pressure, pose, haptics, OS input registration
or a successful generic XR fallback on physical hardware.

### Public OpenXR fallback probe

The development-only `moyo://xr-muse-input-probe` uses an explicit eye-origin
reference and a fixed target; it never invents pen pose or pressure. Mobile types
and diff checks pass. Diagnostic8 mounted the scene and reached OpenXR VISIBLE,
but logged `shouldRender=0`; no focused rendered tip test was established. The
runtime also rejected the renderer's `khr/simple_controller` binding because
`trigger/value` is not valid for that profile. This is an integration gap, not
evidence that Muse hardware cannot supply input. Physical target visibility,
actual tip events and an accepted runtime input profile remain unverified.
