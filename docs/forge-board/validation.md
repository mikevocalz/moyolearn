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
| Physical Muse Bluetooth link | PASS, GATT link only | Actual updated app displayed `Connected to Logitech Muse` and `Bluetooth linked`; native pen pressure/6DoF remain unverified |
| Physical resize appearance | User-reported PASS | User resized the middle content and answered “Looks correct”; geometry tests are separate from that visual report |
| Native Rive loading, full Forge preview, pen pressure/pose/haptics, iOS/iPadOS/Duo | NOT RUN | No source-test result is counted as hardware support |

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

## Bluetooth follow-up installation

- Current APK: same Quest debug path, 338 MiB, SHA-256
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
- The user then clarified that the goal is working pen input and pressed its
  button. The supplied Downloads/musefiles SDK was inspected: its README,
  Interaxon license, EEG example and PDF pages 10/12 identify Muse headbands,
  not Logitech's pen. No binaries from that SDK were installed or executed.
