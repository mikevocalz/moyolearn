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
| Native Rive loading, full Forge preview, pen hardware, iOS/iPadOS/Duo | NOT RUN | No source-test result is counted as hardware support |

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
- Argent launch/QA is blocked by the headset passcode lock screen. Unlock was
  requested from the user. No passcode was requested, entered or bypassed.
- This install does not enable the gated Forge backend or prove Muse hardware
  tracking, native Rive loading or Skia v3 rendering in Moyo.
