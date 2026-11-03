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
| Quest immersive classification/focus | PASS on physical Quest | VRActivity reached FOCUSED with valid rendered views and real native camera callback; [retained evidence](evidence/quest-immersive-classification.json) |
| Generic public XR Touch/target route | PASS, user-confirmed Touch positive control |8 controller/8 target events with focused rendered views; no Muse identity inferred |
| Muse tip input through generic XR | NOT VERIFIED in two bounded trials |3 tip presses before restart and 3 after restart produced no new controller/target callbacks |
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
- At that initial stage, generic XR fallback testing remained pending. The main agent observed bundle
  HTTP 200 and `RunningVRQuestScene(rootTag11)`, establishing scene entry only.
  No target/profile/controller frames or real pen frame was confirmed at that stage.
  The subsequent activity-classification repair and physical focus result are
  recorded below; they still do not establish Muse input.

The verified hardware result is pairing and discovery. A working Muse tip or
pressure driver has not been demonstrated on this Quest.

## Diagnostic8 source/artifact and build verification

Artifact 8 quarantines diagnostic requests after SecurityException and reports
that this app's GATT client requires disconnect/reconnect. It does not bypass
HID restrictions, retry protected reads or create an input provider. The hardware
diagnosis above was captured on 7. The main agent has now installed 8 using
Meta CLI `adb install -r`, which returned Success without uninstall or app-data
clearing. No protected channel was retried and no new tip/pressure proof was
obtained from this update. At that installation stage, physical XR input
validation was still pending; the later Touch/Muse trials are recorded below.

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


## Quest immersive activity classification repair

The initial XR probe was not a passing immersive-input test. The observed
VRActivity was top-resumed, visible and drawn, but remained in a multi-window
task. OpenXR reached VISIBLE with `shouldRender:0`, never FOCUSED. The headset
showed the flat cream panel and Moyo shell rail. This does not establish a
controller or pen frame.

The existing PICO duplicate-tile workaround deleted every VRActivity intent
filter from the shared manifest. The merged Quest manifest consequently lacked
any immersive identifier. Meta's [hybrid activity setup](https://developers.meta.com/horizon/documentation/spatial-sdk/hybrid-apps-overview/)
requires an activity intent-filter category identifying panel versus immersive
activities. The durable repair merges a Quest-flavor-only private action plus
DEFAULT and `com.oculus.intent.category.VR`. It adds neither MAIN nor LAUNCHER to
VRActivity; the shared/PICO stripping behavior remains intact.

- The generated Quest overlay and final merged/APK manifests contain the new
  private VR filter. VRActivity remains non-exported and retains its existing
  focus-aware metadata and orientation. MainActivity retains its original
  launcher/deeplink filters, unspecified orientation and 1024x640dp layout.
  Shared-main and PICO manifest bytes were unchanged by the overlay merge.
- Configuration/window tests passed: 10 total. Three pure merge/regression tests
  run in CI alongside the six existing window-contract tests. The separate
  generated/merged-manifest assertion ran and passed locally; it is explicitly
  skipped when a checkout has not generated those Android outputs.
- Incremental Quest assembly passed in 21 seconds without prebuild or dependency
  relink. The APK at the existing Quest debug path has SHA-256
  `830bcc164bbe3eef4175c01dace3599267dcf25a8ea09d4a60bff6c01a38407f`.
- The main agent's data-preserving `adb install -r` returned Success for that APK.
  The next physical run reached OpenXR FOCUSED (state 5) with `shouldRender:1`,
  `viewsValid:1` and `layerCount:1` under PID 12627. The main agent also observed
  the real first-native-camera-transform callback. This confirms immersive
  classification and rendering focus after the category repair; it does not
  establish target visibility or a controller/pen input frame.
- [Retained focus evidence](evidence/quest-immersive-classification.json) records
  the actual manifest classification, runtime values and log hash. MainActivity's
  1024x640dp/unspecified contract remains unchanged. At this classification-only
  stage, target/controller and Muse input were not verified; the subsequent
  renderer and physical trials below provide the later results.


## Generic simple-controller renderer intake

The source-reviewed candidate from owning fork [PR 116](https://github.com/mikevocalz/virocore/pull/116)
is commit `82ad61e74549073a9dc8ba95ede70f0f854889fc`, based exactly on
`73c6a923fb63b71a1059fd241cf347e15898fd2d`. It adds public KHR simple-controller
suggested bindings; it does not add a Muse driver, pressure decoder or pose
protocol. The previous 73c6 AAR is retained unchanged.

- Candidate: `vendors/viro-renderer-82ad61e74.aar`, SHA-256
  `f85b0ef23b7ae5facce0000e99b2b74d5fd6e5aff4f3f20d89307b61bc749a87`.
  [Provenance/build recipe](../../vendors/viro-renderer-82ad61e74.provenance.json)
  records the source baseline, commands, inputs and ABI evidence.
- Intake independently compared both ZIPs: the only changed member is
  `jni/arm64-v8a/libviro_renderer.so`. Owning-source validation retained all 9749
  defined exports, introduced no undefined imports, and retained DT_NEEDED,
  SONAME and 16KiB LOAD alignment. All other AAR members remain byte-identical.
- The durable config plugin now refreshes an existing renderer pin as well as
  first generating it. The refresh requires a unique owned field, owned input
  stream and its associated checksum guard; foreign guards before/after it
  remain unchanged. Thirteen pin/classification/window regressions pass, and
  CI includes the pin tests. Peer source review passed.
- The bounded incremental Quest build passed in 30 seconds with 1515 tasks
  (66 executed, 1449 up to date). The packaged arm64 renderer SHA-256 is
  `8a0e6d02f4d1bd7dffd55a880c800c3634058d412582fbfbbc1d8a19dc6880a5`,
  exactly matching the verified candidate. APK SHA-256:
  `30d96e691213625571c01327cfc0f0a49dff39f9dfe4023973bb2accb926266b`.
  Actual APK inspection retained the private Quest VR identifier and
  MainActivity's 1024x640dp/unspecified window contract.
- The main agent's data-preserving `adb install -r` returned Success. The next
  launch wait did not establish a resumed activity or rendering failure. Its
  startup log showed package-replaced/background task initialization without
  MainActivity/ReactHost lifecycle or a fatal renderer error. Read-only OS
  snapshots then showed Asleep and keyguard showing, with MainActivity only a
  pending target. No wake, unlock, PIN or boundary action was attempted by the
  reviewing agent.

The new renderer is built and installed. The awake follow-up below confirms
accepted profiles and a user-identified Touch positive control through this
candidate. Muse tip/pressure input remains unverified. The earlier camera-only
result is not reused as proof of controller or pen input.


## Focused Touch positive control and bounded Muse tip trial

The new renderer APK (`30d96e69...6266b`) resumed after the user woke/unlocked the
headset. The user confirmed the positive-control input was a Quest Touch
controller. The probe recorded 8 controller events and 8 target events; its last
Touch target click was timestamp 1793680169073 with source value 1. These real
callbacks establish the generic controller/target route, not Muse identity.

The runtime logged right-hand `/interaction_profiles/oculus/touch_controller`
and later both-hand `/interaction_profiles/khr/simple_controller`. An accepted
interaction-profile name does not identify the Bluetooth pen. The last recorded
Touch click precedes the later simple-profile transition; it is not relabeled
as a Muse or simple-profile event.

For the next bounded trial the user pressed the Muse tip three times. Baseline
and after-state remained exactly 8 controller/8 target events, with the same last
Touch timestamp. OpenXR continued FOCUSED with `shouldRender:1`, `viewsValid:1`
and `layerCount:1` in 80 focused frame samples. The log also contains one initial
VISIBLE rendered frame before those focused samples, with no `shouldRender:0`
sample. Thus the later Muse tip trial was
not invalidated by the earlier sleeping/keyguard or unfocused-panel condition,
but it produced no new app event attributable to the Muse tip. No pressure or
Muse pose was verified.

[Retained trial evidence](evidence/quest-touch-muse-tip-trial.json) includes bounded
counts/profile transitions and source hashes, omitting raw room coordinates,
logical device IDs and Bluetooth addresses. Zero new app events in this window
does not establish universal hardware incompatibility or that no OS component
receives data.

The user subsequently reported restarting Muse. One fresh read-only post-restart
snapshot at 04:32:05UTC still found the pen bonded and HidHost CONNECTED(state 2),
with native HID `ready:F`, 0 reports/0 drops and no Logitech/Muse device or stylus
source in InputReader. This confirms current transport connectivity, not an
independently captured off/on transition. No new pairing, protected GATT reads or
writes were performed by the reviewing agent.

The user then confirmed three more Muse tip presses after restarting, with the
Touch controllers held still. The second after-state again remained exactly
8 controller/8 target events and last Touch timestamp 1793680169073. Its runtime
window contains 54 FOCUSED rendered-frame samples (`state:5`, `shouldRender:1`,
`viewsValid:1`, `layerCount:1`), ending at epoch 1793680389.290. Both counter deltas
are zero. This is a second bounded, connected, focused trial with no new public
probe callback from the user's Muse tip presses. It does not establish a global
hardware incompatibility or identify the underlying OS/runtime cause, and no
pressure or Muse pose was verified.

The final Touch follow-up delivered source 3 DOWN to the controller and target
handlers at 1793680449768/1793680449774, then unmounted the scene at
1793680449970. Pinned renderer source defines source 3 as `BackButton`
(left Menu/right B); its DOWN callback invokes Android back handling, whose
Quest entry point calls `onExitViro` and exits VRActivity. Own activity events
recorded an `app-request` finish and MainActivity resume. A fresh PID query
still returned 15278, and the retained own-package crash-buffer query was empty.
This matches the back-exit path, with no retained evidence of a native crash;
it does not establish which physical button was pressed. The attempt is not a
completed source 1 trigger-cycle control and does not alter either prior Muse
trial. The development probe now returns to `/forge-board-probe` when entered
without navigation history, avoiding the observed unhandled `GO_BACK` warning.
This navigation fallback passed mobile typecheck; no new hardware trial was run.

Read-only Quest CDM inspection found two real associations owned by
`com.moyolearn.app`, IDs1 and2, both named Logitech Muse and approved at
00:43:58/00:44:02EST on November3. Each OS record retained an actual BLE scan
selection. The later application chooser receipt, generation23, reported
`cancelled` with `discovery_timeout`; it had no association ID or activity result.
That later timeout does not erase the earlier OS associations. The dump does not
establish which request generation created either association. Association alone
proves neither Bluetooth bonding nor available pen input.

Android14's public CDM source documents `onAssociationCreated` as an independent
success callback and permits it without first opening approval UI. Artifact13
only retained that callback's info and waited for `Activity.RESULT_OK`, so it
could lose a genuine success. Artifact14's shared verified completion fix is in
progress; this is source diagnosis, not physical validation of the fix.
[Redacted association evidence](evidence/quest-cdm-association-callback.json)
retains only own-app records and source hashes.

Native 14's independent association callback was physically validated on Quest:
association 3 completed through `association-callback`, retaining a null activity
result code, and the normal application reached a real GATT link. Android bond
state then changed 10→11→12. Discovery completed successfully with 7 services.
These are transport and OS-pairing observations, not verified pen input.

Normal public ASAS reads returned status 0: accessory version `0200010100`;
a 67-byte UTI value with prefix `42` followed by 66 bytes containing
`com.logitech.muse.y577`, `com.logitech.muse`, and
`com.apple.spatial-stylus`; and host version `00010100`. Under the current Apple
R32 Update1 major-byte-first tables, the measured version bytes describe 0.1,
with a one-byte zero feature set. They are unsupported by the current strict 1.1
host policy. No host negotiation write was performed, and these bytes are not
reinterpreted as 1.0 without matching protocol evidence.

The user confirmed pressing the chooser action again, which explicitly releases
the previous link; the observed disconnect is not attributed to a timeout.
[Redacted public-path evidence](evidence/quest-public-asa14.json) records the
actual callbacks, bond transitions, read payloads and source hashes. Separate
UiAutomation descriptor instrumentation, if run, uses test-only authority and
must not be reported as normal production app access. Artifact 15 remains held;
no installation or live-context change was performed by this reviewing agent.

A subsequent read-only OS snapshot found Muse bonded as a Low Energy device
and HidHost CONNECTED, while native HID remained `ready:F` with zero reports
and zero drops. InputReader still contained no Logitech/Muse input device.
This preserves the distinction between a connected transport and working input.
Two separate test-only descriptor-reader attempts failed before BLE operations
because UiAutomationService was already registered. This is an instrumentation
ownership/setup failure, not evidence of a Muse hardware or protocol failure.
Neither attempt returned HID descriptor bytes; no descriptor or tip/pressure
decoding is claimed.

On artifact 14 connection generation 3, standard Device Information reads all
returned GATT status 0: model Muse, manufacturer Logi, firmware 2.9.8
(`2A26`, hex `322e392e38`), software 45.41337.3074452168 (`2A28`), and
PnP USB vendor 046D/product D11E. Serial-number data is deliberately omitted.

During a bounded 50-second Android `getevent -lt` capture, the user confirmed
three tip presses and three presses of each near-tip button, with Touch
controllers held still. Meta CLI returned exit 124 from the timeout and included
stdout in its error result: four input-device enumerations and no event lines.
The redirected file was empty because of that CLI error-handling path; its
empty contents alone are not negative input evidence. The subsequent OS
snapshot still showed HidHost connected, native HID `ready:F`, zero reports
and zero drops. These observations do not establish global hardware
incompatibility or verified button/pressure decoding.

The user declined stopping the existing automation service, so the separate
test-only HID descriptor reader remains blocked by UiAutomation ownership.
No HID descriptor bytes or host-negotiation writes have been obtained.
The artifact 14 capture above is separate from the later artifact 15 installation;
installation completion is not asserted by this receipt.

Latest physical status: artifact 15 installed successfully with replacement
installation and preserved application data (APK SHA256 prefix `780f0d20`).
Portable 9 loaded, and the explicit association-history action returned two
device rows deduplicated from three owned OS associations: association 3 was
currently bonded, association 2 was not. Neither row carried RSSI or a nearby
availability claim.

Explicitly reconnecting the selected, currently bonded association 3 produced
controller state `linked`, detail `awaiting-native-input`, and native
`connected:true` in connection generation 1. `systemChooser` remained null;
recovery did not open another chooser. Installed history selection and GATT
reconnect passed, while pressure, pose and tip input remain unverified.
[Redacted artifact 15 evidence](evidence/quest-history-reconnect15.json) keeps
the physical history/reconnect receipt separate from the artifact 14 input trial.
The separate test-only descriptor APK was removed successfully. Inspection
remained active as requested by the user; no HID descriptor bytes were obtained.

REA captured a public cached USB configuration query for the actual Muse
(VID 046D/PID D11E). The probe returned status 0 and 141 bytes, SHA256
`0ea485583304c75c26598437ee972c04d3a7f3e94b5b3e4c6d512800f0fa1e9e`.
The inspected configuration contains two CDC control/data pairs and no USB HID
interface. This is USB configuration metadata, not a BLE HID report map.

A separate REA capture opened both CDC ports for 60.081 seconds while preserving
their 9600-baud settings. It explicitly asserted normal DTR, so the operation
was not purely passive: opening ports and the modem handshake changed control
state. No application commands or firmware payloads were sent. The user
confirmed three tip presses and three presses of each near-tip button while
the cable stayed connected. Both ports received zero bytes. Termios and modem
flags were restored on both ports, and the capture script exited 0. This is a
bounded observation of absent unsolicited CDC data under those conditions; it
does not establish that USB or BLE pen input is universally unavailable.

[Redacted REA evidence](evidence/muse-usb-rea-capture.json) preserves both
evidence IDs, executable/scenario/capture hashes and the safe 141-byte raw
configuration. REA verified its owned process group; three other platform
process observations remained unverified and were left untouched. No
machine-wide cleanup or termination of unrelated processes is claimed.
At that stage, the BLE HID report map and raw tip layout were still unknown;
the later test-only descriptor read below supersedes the map-availability gap.
Portable 10's dialog correction is evaluated separately in the physical UI replay below.

Portable 10's dialog fix passed physical Quest accessibility inspection using
a development-only replay of the previously captured real Java
`discovery_timeout` error. This was a UI replay, not a new OS timeout or hardware
input trial. The dialog showed the bounded friendly message and scrollable
body, with Close, Previously associated Muse, Choose Muse with Quest, and
Try again all within the viewport. The raw Java stack was not displayed.
[Redacted UI replay evidence](evidence/quest-portable10-error-replay.json)
retains the relevant accessibility bounds and source hash.

A subsequent actual `loadAssociatedDevices` call replaced the replay fixture
state. Historical associations 3 and 2 then both reported `bonded:false`; no
connection to their potentially stale rotating addresses was attempted. This
later state does not erase the earlier successful association-3 reconnect
receipt, but it is not evidence of present availability or working pen input.
The separate HID test remains blocked while inspection stays active; the user
previously declined stopping that service, and no new permission is inferred.

A subsequent, explicitly approved test-only descriptor read completed on the
actual Muse. Normal public setup first produced association 4 and actual bond
state 10→11→12. With only the scoped Quest inspection services temporarily
paused, the separate instrumentation adopted named BLUETOOTH_CONNECT and
BLUETOOTH_PRIVILEGED authority through public UiAutomation. This authority did
not transfer to the production Moyo app UID. Inspection was restored and a
successful accessibility inspection was recorded; no exact pause duration is
claimed without matching clock evidence.

The test returned successful GATT connection/discovery, one actual 457-byte
HID Report Map, and six actual Report Reference descriptors, all status 0.
The retained [raw report map](evidence/muse-hid-report-map.bin) has SHA256
`4708e62215883a297c88be41600d2ddea20345ecfbe41213db47f7d6778b3405`.
[Redacted test-only read evidence](evidence/muse-hid-test-descriptor-read.json)
preserves the measured map length/status, six reference values and instance
IDs, named permission scope and source hashes. Attribute permission bitmasks
were not recorded in this receipt. No CCCD, feature, vendor or firmware writes
were performed, and no notifications or raw tip input packets were captured.
This establishes descriptor availability under temporary test authority, not
normal production HID access, measured pressure/pose, or working pen input.
Actual descriptor-field analysis remains separate from runtime input proof.

Our offline parser decoded the actual HID map under REA evidence
`ev_6ba8ab510b1b2882ceb21d237a1de97a01ff6b4957bbe5839a4883b695d11b88`.
REA records execution of our parser, not an independent HID semantic decode or
pen input event. The [redacted decoded descriptor](evidence/muse-hid-decoded.json)
defines input report 2 as 65 payload bytes, excluding any report-ID framing.
The first four bytes define two button values and their associated force
fields; byte 4 holds button/touch bits. The remainder defines three acceleration
XYZ groups, three angular-velocity XYZ groups, and three vendor 64-bit fields
whose semantics remain unknown. No Digitizer TipPressure usage or tracked-pose
field was established, and button usages are not yet mapped to physical controls.

A separate temporary test-only live READ baseline completed 100 successful
65-byte input-report reads, with 100 distinct complete reports. All first-five
byte prefixes were `0000000005`. Feature report 2 was read once as eight zero
bytes; no feature, CCCD or vendor writes were performed. The raw reports are
not published because they contain unknown vendor fields and IMU samples.
[Redacted baseline evidence](evidence/muse-hid-live-read-baseline.json) retains
measured counts, the known-prefix aggregate, descriptor layout and source hashes.

REA evidence `ev_1ea45b1f2e68ed2e510528a7847a62158cdd3c2dc4c7a4774a8b9e335ff790d6`
preserved all 100 samples in raw capture data. Exact deep comparison with the
device JSON passed: canonical 31,283 bytes, SHA256
`58517911773fac97a729c573565d5d8dc828a4ca9e0bfa43b17c17575ce7034f`.
Clipping in rendered display frames did not truncate that raw JSON evidence.
Inspection was restored after the test. User confirmation arrived after this
baseline capture window, so the unchanged control prefix is not treated as a
negative button-press trial. A later controlled held-tip trial is recorded separately below.
These reads still use temporary test authority, not normal production HID access.

A controlled held-tip/release trial produced a positive result. The user
confirmed the tip was held before capture began, then was asked to release it
during capture. All 100 report reads succeeded with 65-byte payloads. Samples
0–63 had known control prefix `6464000005`; samples 64–99 changed to
`0000000005`, with the first released sample observed at 16,103ms. This
correlates the physical tip with descriptor Button1 at payload byte 0 and its
associated force field at byte 1: both raw values changed 100→0. It does not
establish force calibration, analog resolution, tracked pose, other button
mappings, normal production HID access or drawing integration.

[Redacted positive held-tip evidence](evidence/muse-hid-held-tip-trial.json)
retains only the known control-prefix segments and timing, not unknown vendor
or raw IMU packet values. REA evidence
`ev_47baa201883a0d12aa8adf2b9b3e2090aef0946d760e105d438983ca66581229`
matched the complete raw terminal JSON to the device result exactly, canonical
SHA256 `1141d4b515b2eeccf00d01e6dafcc5853a042b240992e401d2a49f61252708b3`.
The unchanged test APK used temporary named UiAutomation authority, performed
no CCCD/feature/vendor/firmware writes, and inspection was restored afterward.
The subsequent near-tip button trials are recorded separately below.

Two subsequent controlled trials correlated the remaining near-tip controls.
The user held the round button before capture and confirmed keeping it held
throughout, without switching to oval. All 100 successful 65-byte reports had
known prefix `0000000007`, compared with baseline `0000000005`: descriptor
Button3 at payload byte 4 bit 1 was set. This trial establishes held correlation,
not a round-button release edge.

For oval, the user confirmed holding it before capture and releasing during
capture. All 100 65-byte reads succeeded: 54 samples had prefix `0000646405`,
one had `0000121205` at 13,583ms, then 45 had `0000000005` beginning at 13,831ms.
Descriptor Button4 at payload byte 2 and its associated force at byte 3 therefore
correlated with the controlled oval action, with measured raw 100→18→0.
Together with the separate tip trial, all three physical controls now have
observed descriptor-field correlations under temporary test authority. This
does not establish calibrated pressure, analog resolution, normal production
HID access, tracked pose, or drawing integration.

[Redacted button-trial evidence](evidence/muse-hid-near-tip-button-trials.json)
preserves both complete raw-capture integrity receipts: round REA
`ev_f09eb8da87fbd94fb46bcc1973f09751483f65f881c959c95c5489e52743e361`,
canonical SHA256 `10bbbb68d158d2b844cb19874d25baf21937692fa5ef94fb2315619678340c3c`;
oval REA `ev_2facd76a6dfacbf270acbcbc60ab0e77326857d32a160f1d83e11fe6c1968874`,
canonical SHA256 `75646e3e11975d5225ecd5d43a2248f337122655a4a16562c358cc5dc7e3f608`.
Inspection was restored after each capture. The test APK was unchanged and
performed no CCCD, feature, vendor or firmware writes. Unknown vendor packet
values and raw IMU samples remain unpublished.

The finite Moyo DEV viewer was exercised with actual test-reader data. During
the first run, Moyo recorded LIVE at 71 accepted samples and the user confirmed
that displayed values changed. The source capture contained tip raw values
0/1/18/100 and oval 0/3/4/5. The host delivered 97 samples, then its setup-based
deadline expired; restored inspection showed Unavailable 97/100 and retained
last tip/force 18. The source collector's 100 samples are not relabeled as
100 delivered Moyo samples for this run.

After fixing the host deadline to actual polling-start plus 40 seconds, a final
run delivered 100/100 samples with zero gaps. The viewer acknowledged sequence 99,
phase completed, and a successful finish. Physical accessibility inspection
showed Captured/historical 100/100 with all last values released/zero. This final
run was a released baseline; the positive changing-value observation belongs
to the first run. [Redacted live-viewer evidence](evidence/quest-muse-live-viewer.json)
retains the distinct receipts. Independent canonical comparison subsequently passed for both complete
100-sample source captures. This is temporary test telemetry displayed
in Moyo, not normal production HID access or board drawing.

A timing audit found manual inspection-restoration overruns relative to the
user's 60-second limit. Local pause-receipt to restored-accessibility receipt
mtime intervals were approximately 67.775s for oval, 83.773s for the first viewer
run, and 85.493s for the final viewer run. These are approximate observation
intervals, not exact service lifecycle timestamps. They exceed the requested
limit and must not be described as compliant 60-second pauses. The live HID
polling windows themselves remained about 24.85 seconds with the bounded
test-reader deadline; 85 seconds was not 85 seconds of HID reading. Automatic
restoration on completion, error, cancellation and watchdog now replaces manual
orchestration; its separate physical completion-path proof is recorded below.

Canonical verification matched the first source capture to REA
`ev_e1b8692b66b5cd114343ea08bdc858a0034748504e7f687993eba9bd5ec21ebc`,
SHA256 `a682a220f8d5d5bf47cca02ced97f01397882b2081bb7d224519417fe4bf4f52`.
That verifies all 100 source records, while Moyo delivery remains only 97.
The final source capture matched REA
`ev_7948dc28bdff0cecce6937963edfb198ffd17067a0b1ec107a1a2af4da236029`,
SHA256 `68e61e547158bcf30020b25342c6bbf187375ef05752e4f11032ffab8651f2fa`.
Its 100 successful 65-byte records and source sequence 99's known prefix
`0000000005` exactly matched the final completed Moyo acknowledgement: 100
accepted samples, zero gaps, sequence 99 and all mapped values released/zero.
Physical accessibility evidence independently showed Captured/historical 100/100.
The first run remains the user-confirmed changing-value demonstration; the
final run establishes complete end-to-end baseline delivery. Unknown vendor
packet fields and raw IMU values are not published. The later automatic-restoration physical proof is recorded below.

Automatic scoped restoration passed a subsequent hands-off physical run. The
orchestrator completed a 100-sample, zero-gap viewer capture and acknowledged
restored android-devtools inspection after 33,876.573ms, within the approved
60,000ms window. This duration comes from the orchestrator's elapsed-time
receipt through restoration acknowledgement, not the earlier approximate
filesystem-mtime method. The collector APK pin was verified against the
operator-pulled installed APK.
[Redacted automatic-restoration evidence](evidence/quest-automatic-inspection-restore.json)
retains the source hashes, timing, completed viewer acknowledgement and scope.
The earlier three manual overruns remain documented. This physical run verifies
normal completion; error/cancel/watchdog handling is implemented and covered
by host tests, rather than being relabeled as physically exercised here.
The final root checks passed mobile typecheck, 10 viewer tests and 21 host tests.

The first physical gravity-tilt cursor attempt forwarded zero reports to Moyo
because the application rejected session start. A diagnostic showed armed mode,
a present board and calibration 988×351.2 client pixels, but `sameFacade:false`
and `canStart:false`. Whiteboard recreated its imperative facade on rerender;
the underlying engine had not changed. This was an application identity-guard
failure before accepted input, not evidence that Muse stopped reporting or
that physical drawing failed. Automatic inspection restoration was acknowledged
in 9,457.377ms, within the approved window.

The source correction uses a mounted generation/surfaceVersion token and
resolves the current facade for each pointer dispatch. Calibration completion
checks that same mount; real mount changes remain fail-closed. Six motion,
three surface-regression, five gravity-math and ten telemetry tests passed,
with mobile typecheck and diff check.
[Redacted first motion attempt](evidence/quest-muse-motion-cursor.json) keeps
the failed attempt and source correction distinct. The physical retry and
actual tilt-to-ink validation remain pending.
