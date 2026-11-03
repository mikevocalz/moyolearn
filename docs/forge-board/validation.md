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
| Moyo Quest APK/install | IN PROGRESS at record creation | Updated after build/install completes |
| Native Rive loading, full Forge preview, pen hardware, iOS/iPadOS/Duo | NOT RUN | No source-test result is counted as hardware support |

The Quest 3S selected through Argent is serial `340YC10GC3014S`, Android API 34.
The user authorized installation. Argent's reinstall action uninstalls first and
clears data; it was rejected for this task. The supported update path is `adb
install -r` after the APK is verified. Launch/discovery/interaction use Argent.
