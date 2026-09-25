# Rive panels inside Viro — continuation handoff

Updated 2026-09-25. The Android Surface bridge, Nitro Rive renderer, native
parent drag, editable fractions asset, and an isolated Moyo engineering route
are implemented. Library builds and software checks pass as recorded below.
The complete Tutor Room composition and Quest system-window companion from the
original brief are not implemented. Device results have their own section;
never infer headset acceptance from desktop screenshots or build success.

## User scope

The user explicitly chose **“Add references; finish current Rive work”** and
**device validation last**. Preserve the two supplied Viro 3.0.1 documents as
references; their proposed platform-first replacement of Moyo scope is deferred.
Unmodified copies are in the companion Viro worktree:

- `docs/handoffs/references/Viro_Platform_Handoff_v3.0.1_2026-09-25.md`
- `docs/handoffs/references/Viro_Platform_Modernization_v3.0.1_2026-09-25.md`

Original implementation brief was recovered from Downloads:
`MOYO_VIRO_RIVE_QUEST_PICO_IMPLEMENTATION_PROMPT_2026-09-25.md`.
The companion probe ZIP was not found; the fractions RML was authored locally.
Earlier cloud findings and intermediate checkpoints are preserved in
[history/2026-09-25-rive-viro-panel-checkpoints.md](history/2026-09-25-rive-viro-panel-checkpoints.md).
That file is historical and includes superseded “missing implementation” notes.

## Workspaces and provenance

All continuation work is local on `codex/rive-viro-panel`; nothing has been
pushed or published. Original dirty checkouts were preserved.

| Repository | Isolated worktree | Recovered base commit |
|---|---|---|
| Moyo | `/Users/mikevocalz/moyo-rive-panel` | `5a161b3739b026b565dcf9f0eaa5545ad69bcce1` |
| Nitro | `/Users/mikevocalz/nitro-rive-panel` | `4d32d437aa393b5925f71397318138a33adb2bf2` |
| Viro | `/Users/mikevocalz/viro-rive-panel` | `2bb0b5abbc707810ae2b49221917a80c7ee50b41` |
| ViroCore | `/Users/mikevocalz/virocore-rive-panel` | `8e3750fed7b1c7f711baefe32a8a832df0e4672b` |

Local implementation commits: Nitro `fd267d9` (native implementation `dacfa3f`),
Viro `67b4180`, ViroCore `881483d7`. Full SHAs are in the artifact manifest.
Moyo implementation commit: `1449bf3032c1f4405fbaa09f67c36e286ab6994f`; handoff metadata follows in a separate commit.

Cloud branch `claude/gifted-ptolemy-r9kv7p` was recovered in Moyo and Nitro.
The interrupted Java changes were not on a Viro remote branch and were
reconstructed from source. Original `/Users/mikevocalz/nitro-canvas-in-Vision`
contains separate uncommitted work, including an incomplete Rive stub. Do not
copy that diff over this implementation. `/Users/mikevocalz/expo-pico` also has
unrelated local changes and was not modified.

Vendor packages in Moyo:
- `vendors/reactvision-react-viro-3.0.0-moyo.5-rive.2.tgz`
- `vendors/nitro-canvas-in-Vision-0.0.2-rive.2.tgz`

The Viro package contains paired, rebuilt renderer and React bridge AARs.
Installed renderer checksum was compared with the final source build and
matches. Version `rive.2` includes the final targeted TypeScript emit; earlier `rive.0`/`rive.1` tarballs were intermediate and removed.
Use the artifact manifest beside this file for checksums.

## Implementation

**Surface path:** material `{canvasSource,width,height}` → Java
`CanvasSourceBridge` → ViroCore `ExternalSurfaceTexture` → Android Surface →
Nitro `RiveSurfaceRenderer`. This uses Viro's existing external/OES texture
sampling. The separate raw AHardwareBuffer importer is not used or completed.
No JS pixel copy, bitmap screenshot, WebView, or fake Rive view is involved.

Material replacement, context changes, deletion and teardown revoke the old
Surface. Registry revocation checks identity. Nitro takes its own native Surface
reference and releases it after the Rive worker retires. The file has a separate
renderer lifetime lease. Reflection is optional so Viro can run without Nitro;
R8 keep rules preserve the registry contract.

**Nitro:** runtime and Nitrogen pinned to **0.37.1**; generated bindings rebuilt.
Android Rive pinned to **11.12.1**. Native file loading, artboard rendering,
state-machine pointers, typed default-view-model setters/getters/triggers,
numeric observation, active/background control and disposal are implemented.
The public low-level Rive 11 renderer API is deprecated for removal in 12;
upgrade it deliberately, not via an unbounded dependency range.
Native Choreographer scheduling sleeps when the scene settles; JS does not pump
Rive frames. `RiveProducer` handles stale asynchronous attachment and disposal.

**Viro:** `ViroRivePanel` accepts file bytes, artboard/state machine, fit and input
mapping; its optional custom `init` adapter remains supported. Shared panel
allocation happens after React commit, registers material before the quad,
handles source replacement and AppState, and avoids the former microtask loop.
Controller event sources are correctly numeric rather than image-source types.

**Input/group movement:** inverse world transform, quad UV and matching Rive fit
are used for artboard coordinates. Input-only body uses `dragTransform="none"`;
its hover updates provide coordinates while remaining on the same collider.
The separate amber grip uses `dragTransform="parent"`; C++ moves the group and
JS persists its final pose after release. Tracking loss releases capture without
a `Clicked` activation. Disable/reset/unmount cancel body input. Parent drag is
translation, not two-handed rotation/scaling.

**Moyo probe:** `apps/mobile/app/rive-panel-probe.tsx`, deep link
`moyo://rive-panel-probe`. It loads the local `.riv`, shows native loading/error
fallback, observes Rive's selected count and groups the grip/reference label.
It is separate from the existing Tutor Room; no claim of full lesson/Tutor
composition. Metro recognizes `.riv` assets.

**Editable asset:** [probe README](../../probes/rive-panel/README.md) documents
bindings, generation and font provenance. Four equal fractions toggle, two
selected show `2 / 4 = 1 / 2`, hint toggles, hover/pressed states respond, and
160 ms transitions have an immediate `reducedMotion` path. Rive CLI 1.1.1 source
is `probes/rive-panel/rive/scene.rml`; app binary is
`apps/mobile/assets/rive/moyo_fractions.riv`.

## Verification

| Check | Result |
|---|---|
| Nitro codegen and TypeScript | pass |
| Nitro geometry, pointer capture, registry, descriptor and producer lifecycle | 27 tests pass |
| Rive CLI verify/inspect and pointer cases | 9 cases pass; screenshots + JSON in `probes/rive-panel/evidence` |
| ViroCore `:viroreact:assembleRelease` | pass, final cancellation/hover changes included |
| Final renderer ARM64 ELF alignment | all 14 libraries ≥ 16 KB |
| Nitro `:nitro-canvas:assembleDebug` | pass |
| Viro `:viro_bridge:assembleRelease` | pass against RN 0.88.0-rc.0 |
| Viro changed panel/hook/controller/button TypeScript | pass |
| Moyo mobile TypeScript with final vendor packages | pass |
| Moyo Android APK | blocked: host disk exhausted installing ExecuTorch NDK 28.2.13676358 |
| Metro Android export | pass: 26 MB Hermes bundle and 143 KB Rive asset |
| Frozen lockfile | pass; unrelated workspace dependency changes removed |
| Packaged-source audit | 101 Nitro + 1,632 Viro tracked files match committed source |
| Physical headset acceptance | Quest 3S detected by Argent, SDK 34; installation/input/rendering not tested |

Whole Viro TypeScript still fails on pre-existing missing web-renderer sibling,
missing `GpuProducer` exports and unrelated AR/web source errors. Packaging used
`npm pack --ignore-scripts` after targeted emit; this is not a clean whole-repo
build claim. No placeholder GPU implementation was invented to silence errors.

Build logs are under `/tmp/rive-panel-check`. Persist relevant final logs with
the device evidence before relying on that temporary directory across sessions.

Reproduction:
- Nitro: `npm ci`, `npm run specs`, `npm run typescript`,
  `node --test test/*.test.ts test/*.test.mjs` (Node 26).
- Rive: `python3 probes/rive-panel/verify-rive.py` from Moyo root.
- ViroCore: JDK 17 + Android SDK, `./android/gradlew -p android :viroreact:assembleRelease`.
- Viro targeted emit: `node scripts/build-rive-types.cjs`; uses an explicit repository root so emitted files land under `dist/components`.
- Combined Nitro/Viro: `python3 scripts/check-android.py --gradle /path/to/gradle-9.4.1/bin/gradle --viro ../viro-rive-panel`
  from Nitro; JDK 17, SDK 36, NDK 27.1.12297006. The generated host pins
  AGP 9.2.1/Kotlin 2.3.21/RN 0.88.0-rc.0.
- Moyo: `pnpm install --filter mobile... --ignore-scripts`, then
  `pnpm --filter mobile typecheck`. Android uses the existing Expo 58 preview
  dependency set, not a wholesale SDK upgrade. Prebuild used local
  `expo-template-bare-minimum-58.0.7.tgz` with `--platform android --no-install`.
  JDK 17: `./gradlew :app:assemblePicoDebug -PreactNativeArchitectures=arm64-v8a`.

## Device gate and remaining work

After software checks, Argent detected the attached **Quest 3S**, Android SDK 34. No app was installed, launched or interacted with in this session. The initial `assemblePicoDebug` attempt (before identification) failed because the Mac ran out of disk space installing ExecuTorch’s NDK 28.2.13676358. Only generated output/downloads created by this task were removed; roughly 2.7 GB remained at the last check. The user was asked to free another 8–10 GB.

Next: after freeing space, use JDK 17 and SDK at `/Users/mikevocalz/Library/Android/sdk`, run `./gradlew :app:assembleQuestDebug -PreactNativeArchitectures=arm64-v8a` from `apps/mobile/android`. Use the Quest flavor for the attached device, inspect the resulting manifest, then install preserving existing app data and launch through Argent. Keep Metro tied to this isolated Moyo checkout. A fresh APK is required; testing the old installed app would not validate these changes.

Validate
actual Rive pixels, both-eye rendering, ray hover/press/drag/release/cancel,
second-controller ownership, parent movement, tracking loss, background/resume,
repeated mount/unmount, idle scheduling, native frame timing and memory. Record
observed passes and failures individually; a mirrored screenshot cannot prove
both-eye comfort or controller feel.

Remaining original-brief work: integrate the Rive group with the Tutor Room's
whiteboard/tool/chat layout while respecting its world-coordinate board math;
add the separately scoped Quest windowed companion/Meta Layout SDK; qualify
Quest and PICO independently. Broad Viro 3.0.1 modernization remains reference
work only. iOS, WebXR, WebSpatial, raw AHB imports and other canvas producers
were not runtime-qualified by this Android continuation.

Rollback is to restore Moyo's baseline package manifests/lock and the existing
`3.0.0-moyo.4` vendor reference, and omit the engineering route. Do not roll the
original dirty worktrees back or discard their unrelated changes.
