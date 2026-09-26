# Handoff: Rive panels inside Viro on Quest and PICO (in progress)

What this is: the running state of the implementation brief
`MOYO_VIRO_RIVE_QUEST_PICO_IMPLEMENTATION_PROMPT_2026-09-25.md` (uploaded
2026-09-25; not in the repo). It is updated at each milestone so the next
session can resume from it instead of from the transcript.

Why it exists: the work spans five repositories and ends in device gates that
cannot be run from a cloud container. This file says which step is done, which
is written but unverified, and which has not started.

Source of truth: the branches and commits listed below. This file points at
them.

SOT-KEYWORDS: handoff rive viro panel quest pico canvasSource external texture
ahardwarebuffer jni material bridge canvas input ray uv artboard nitro canvas

## Added platform documents (2026-09-25)

The user asked to add two platform documents during the local continuation.
Unmodified copies are preserved in the Viro worktree:

- `viro-rive-panel/docs/handoffs/references/Viro_Platform_Handoff_v3.0.1_2026-09-25.md`
- `viro-rive-panel/docs/handoffs/references/Viro_Platform_Modernization_v3.0.1_2026-09-25.md`

These documents describe a platform-first Viro **3.0.1** target, a neutral
Platform Lab, preservation of fork/native/browser/Apple work, matched binary
provenance, separate WebXR/WebSpatial/system-window adapters, and per-platform
acceptance gates. Their author explicitly reports research only, with no local
implementation or device evidence.

**Scope confirmed by user:** “Add references; finish current Rive work.”
The documents remain reference material. The broader Viro 3.0.1 modernization
and its proposed replacement of the Moyo scope are deferred. Continue the
current Rive bridge and integration. Device validation remains last.

## Starting revisions (2026-09-25)

| Repo | Branch | SHA |
|---|---|---|
| mikevocalz/viro | `decax9-three-panel` | `93bccaed52fa9aea8a7cc003f5dc6d88784d881f` |
| mikevocalz/nitro-canvas-in-Vision | `decax9-three-panel` | `2bd37ecb67e182c659ab637ce9d50f6766f1aff6` |
| mikevocalz/virocore | `pico-support` | `8e3750fed7b1c7f711baefe32a8a832df0e4672b` |
| mikevocalz/expo-pico | `main` | `9d217afc465cf58b7e50149ac1fa03b935ba5e3e` |
| mikevocalz/moyolearn | `upgrade/expo-sdk-58-beta` | `b1e3935` |

Cloud work branch name: `claude/gifted-ptolemy-r9kv7p`. Remote recovery on
2026-09-25 found this branch only in Moyo and Nitro; see recovery status below.

## Findings so far

- **The app's Viro source was initially missing from GitHub (now recovered).** Moyo consumes
  `vendors/reactvision-react-viro-3.0.0-moyo.4.tgz`. Its commit message
  (moyolearn `7e9cae6`) says it was cut from `~/viro` commit `2bb0b5a`, which
  was absent during the cloud inspection. Remote recovery now confirms
  `mikevocalz/viro` branch `decax9-three-panel` points to full SHA
  `2bb0b5abbc707810ae2b49221917a80c7ee50b41` (moyo.4). The earlier moyo.3 snapshot
  inspected in the cloud had
  its canvas panels import `nitro-canvas-in-Vision` at the top level, which
  breaks the Metro bundle for every consumer. The tarball carries moyo.4's
  TypeScript (`components/CanvasPanel/nitroCanvas.ts`, lazy `require`), so it is
  recoverable. The Java and C++ inside the tarball ship only as AARs.
- **The missing connection is the material hook, not every JNI route.** Local
  ViroCore already has `android/sharedCode/src/main/java/com/viro/core/ExternalSurfaceTexture.java`
  and `ExternalSurfaceTexture_JNI.cpp`. That route uses `VROAndroidViewTexture`,
  whose texture type is `TextureEGLImage`, and exposes a renderer-owned Android
  `Surface`. It is separate from the raw AHardwareBuffer importer discussed
  below. Viro's `VRTExternalVideo.java` already demonstrates this Surface route.
  The baseline MaterialManager still drops `canvasSource`; the local continuation
  below adds that missing hook.
- **The Rive drawer is a stub.** `RiveCanvasBridge.kt` loads the file and
  advances the state machine, but `draw()` is empty: `app.rive:rive-android`
  removed `Artboard.drawSkia(long)`.
- **Input maps world-space positions as if they were quad-local.**
  `CanvasInViroInput.ts` feeds Viro's `onDrag` destination (world space)
  straight into quad-local UV math.
- **The render loop spins.** `useCanvasPanel` runs
  `while (alive) { renderFrame(); await Promise.resolve(); }`, which starves the
  JS thread and submits frames whether or not anything changed.
- **No companion archive.** `Moyo_Rive_Viro_Panel_Probe_2026-09-25.zip` was not
  uploaded, so the probe's RML, `panelMath.ts` and reference images are not
  available here.

- **The raw AHardwareBuffer importer has a sampler mismatch.**
  `VROExternalSurfaceTexture` declares `VROTextureType::Texture2D`, but on
  Android its substrate is `GL_TEXTURE_EXTERNAL_OES`. ViroCore only switches a
  diffuse material to `samplerExternalOES` for `TextureEGLImage`
  (`VROShaderCapabilities.cpp:77`, as `VROVideoTextureAVP` does), so a plain
  diffuse binding samples an external texture through `sampler2D`.
- **Drag cannot move a group from a grip today.** ViroCore drags the first
  ancestor with drag enabled and moves that node itself
  (`VROInputControllerBase::getNodeToHandleEvent`, `processDragging`). A grip
  can only move itself, and giving the canvas quad `onDrag` for pointer moves
  drags the quad away. Fix in progress: a node `dragTransform` of
  `self | parent | none`.

## Required: update the Nitro stack to current packages

The user asked for this explicitly. Versions as checked on 2026-09-25:

| Package | Pinned / resolved in nitro-canvas-in-Vision | Latest |
|---|---|---|
| `react-native-nitro-modules` | `"*"`, lockfile resolves 0.35.9 | 0.37.1 |
| `nitrogen` (codegen) | `"*"` | 0.37.1 |
| `app.rive:rive-android` (`android/build.gradle`) | 10.1.2 | 11.12.1 |
| `@rive-app/react-native` (Rive's Nitro runtime) | not a dependency | 0.4.20 |
| `react-native` (devDependency) | 0.85.3 | Moyo runs 0.88 |

What the update involves:

- Pin `react-native-nitro-modules` and `nitrogen` to the same exact version,
  not `"*"`. Nitro's generated code and runtime must match, and `"*"` lets two
  installs resolve differently.
- Regenerate `nitrogen/generated/` with `npm run specs` after the bump. Never
  hand-edit generated files.
- Match the Nitro runtime version to what Moyo resolves, because the app and
  this module share one `react-native-nitro-modules`.
- Move to `rive-android` 11.x and port `RiveCanvasBridge` to its render API.
  10.x already removed `Artboard.drawSkia`, which is why `draw()` is empty.
- Consider whether `@rive-app/react-native` (Rive's own Nitro runtime) can
  supply the file, artboard and state machine, so this package only owns the
  offscreen target. Confirm against its source that it can render offscreen
  before relying on it.
- Fix the pre-existing typecheck failures: `@webgpu/types` is named in
  `tsconfig.json` but not installed, and `RiveProducer.ts` uses `performance`
  with no lib that declares it.

## Environment limits (cloud container)

- No headset, so every Quest and PICO gate is **unverified**.
- No Rive CLI, so no `.riv` is compiled or rendered.
- Android SDK 35, NDK 27.1.12297006 and CMake 3.22.1 were installed into
  `/home/user/android-sdk` for compile checks only.

## Status by step

| Step | State |
|---|---|
| 1. Baseline and trace | done (findings above) |
| 2. Native texture bridge | Surface-based material bridge reconstructed locally and Java compile-checked; Nitro registry implemented; Rive producer is still missing. Raw AHB route remains separate and unfinished. |
| 3. Input mapping and drag | input mapping **done**, pushed as nitro-canvas-in-Vision `4d32d43` on `claude/gifted-ptolemy-r9kv7p`: `src/viroreact/panelMath.ts`, rewritten `useCanvasInViroInput`, 23 passing `node:test` cases (`node --experimental-strip-types --test test/*.test.ts`). Grip drag (`dragTransform`) in progress in ViroCore. |
| 4. Moyo Tutor Room | not started |
| 5. Spatial polish | not started |
| Device gates (Quest, PICO) | unverified; needs a headset |


## Local recovery from GitHub — 2026-09-25

Recovered without modifying the existing Moyo, Nitro, or expo-pico checkouts:

| Repository | Recovered remote revision | Local worktree / branch |
|---|---|---|
| Moyo | `claude/gifted-ptolemy-r9kv7p` at `5a161b3739b026b565dcf9f0eaa5545ad69bcce1` | `/Users/mikevocalz/moyo-rive-panel`, `codex/rive-viro-panel` |
| Nitro | `claude/gifted-ptolemy-r9kv7p` at `4d32d437aa393b5925f71397318138a33adb2bf2` | `/Users/mikevocalz/nitro-rive-panel`, `codex/rive-viro-panel` |
| Viro | `decax9-three-panel` at `2bb0b5abbc707810ae2b49221917a80c7ee50b41` | Remote verified; no new worktree |
| ViroCore | `pico-support` at `8e3750fed7b1c7f711baefe32a8a832df0e4672b` | Remote verified; no new worktree |

**Verification:** reran `node --experimental-strip-types --test test/*.test.ts`
in the recovered Nitro worktree: **23 tests passed, 0 failed**. This verifies
panel math and pointer capture only, not native rendering or headset behavior.

**Not recovered:** GitHub has no `claude/gifted-ptolemy-r9kv7p` branch in Viro
or ViroCore. The latest cloud transcript reports a new `CanvasSourceBridge.java`,
MaterialManager changes, two node call-site changes, and native texture / drag
work. Those edits are not present in the recovered revisions. Treat the earlier
"in progress" rows as cloud-session status, not available or verified code.
The cloud Java compile check was interrupted; no successful native compile is
recorded. No Nitro upgrade or Rive rendering implementation is recovered.

**Recovery option:** pushing/exporting cloud patches would recover the exact edits,
but it is not required to reconstruct them: local Viro and ViroCore contain the
base source. The continuation below uses that source. The original implementation
prompt and probe archive are still missing; requested the prompt's local path
from the user for the Tutor Room and spatial-polish requirements.

The initial recovery changed only this handoff. See the subsequent local
implementation below; no branches or vendor archives have been published.


## Local implementation continuation — 2026-09-25

### Existing local work inspected and preserved

- `/Users/mikevocalz/viro`: clean `decax9-three-panel` at `2bb0b5a`.
  Its older stash contains another proposed `nativeBindCanvasSurface` hook;
  it was inspected but not applied. The Surface-based path avoids inventing
  that JNI method.
- `/Users/mikevocalz/virocore`: clean `pico-support` at `8e3750fe`.
  Existing Java/JNI Surface bridge confirmed in source. No changes made here.
- `/Users/mikevocalz/nitro-canvas-in-Vision`: substantial uncommitted work,
  including fence ownership, `nitro_canvas_lookup`, a JS Rive factory wrapper,
  generated bindings and demo changes. Preserved in place. Its Rive factory
  wrapper names an unregistered HybridObject, its producer pointer callback is
  empty, and Android `draw()` remains a stub. Do not copy this entire diff onto
  the recovered input-mapping branch. The Kotlin factory return-type correction
  was also applied independently in the continuation worktree.
- `/Users/mikevocalz/expo-pico`: local FAQ commit `09578ed` plus uncommitted
  example changes. Preserved in place.

### Changes now written (local, uncommitted)

All continuation branches are `codex/rive-viro-panel`:

- **Viro:** `/Users/mikevocalz/viro-rive-panel`, based on `2bb0b5a`.
  `CanvasSourceBridge.java` validates `{ canvasSource, width, height }`, creates
  the existing `ExternalSurfaceTexture`, and offers/revokes the Surface through
  Nitro reflection. MaterialManager parses the source and resolves it when a
  node receives its ViroContext. Both node call sites use this path. Material
  deletion, replacement, clearing and reload revoke the old Surface. The old
  `recreate(VideoTexture)` descriptor is retained for compiled consumers.
- **Nitro:** `/Users/mikevocalz/nitro-rive-panel`, based on `4d32d43`.
  `CanvasSourceSurfaces.java` provides an identity-aware Surface registry and
  subscription contract; a stale material cannot revoke its replacement's
  Surface. Added R8 keep rules and packaged them. `canvasSource()` now includes
  pixel dimensions. **There is no Rive subscriber yet, so this does not render
  a Rive frame by itself.**
- Nitro runtime and codegen are pinned to **0.37.1**, verified against npm and
  Moyo's existing catalog. Dev RN is **0.88.0-rc.0**, React **19.2.8**, matching
  the recovered Moyo checkout. Installed missing `@webgpu/types` **0.1.70** and
  declared the RN monotonic clock used by RiveProducer. Android Rive remains
  **10.1.2** until its renderer is ported; do not claim the Rive upgrade is done.
- Registered the existing `CanvasSurfaceFactory` in `nitro.json`, fixed native
  factory return types, and regenerated bindings with `npm run specs` using
  Nitrogen 0.37.1. Generated files were not hand-edited.

### Validation

- `npm run specs`: passes; generates both existing HybridObjects and factory
  autolinking (including two new iOS autolinking files).
- `npm run typecheck`: passes.
- `node --experimental-strip-types --test test/*.test.ts test/*.test.mjs`:
  **25 passed, 0 failed**. Includes 23 recovered math/input tests, material
  dimensions, and a JVM registry ownership test. The latter uses a Surface
  identity stub and does not exercise Android rendering.
- Targeted `javac` check passes for CanvasSourceBridge, MaterialManager, both
  changed node classes, and Nitro's Surface registry, using SDK 36,
  react-android 0.88.0-rc.0, annotation dependencies, existing Viro AAR classes,
  and the current ViroCore `Material.java` source.
- The committed renderer AAR lacks existing Material transparency/copy APIs.
  Compiling against it alone fails even for baseline Viro source. The source
  compile is **not** proof that the old AAR can ship these changes. Rebuild the
  matching renderer/bridge before packaging or installing.
- `git diff --check`: passes. No complete Gradle/native link, iOS build,
  application launch, Rive frame, or headset gate has been verified.

### Remaining work

1. Implement a registered Nitro Rive HybridObject/factory and a real Android
   renderer subscribing to CanvasSourceSurfaces; update Rive Android to 11.12.1.
   Official 11.12.1 source/AAR downloaded into `/tmp/rive-panel-check` for API
   inspection. Its legacy Renderer exposes Surface rendering but deprecates
   the low-level public `setSurface`; verify ownership and asynchronous teardown
   carefully. Rive's public `stop()` explicitly must not be called from its
   animation thread. Use an idle-aware native scheduler with matched input fit.
2. Replace the microtask pump in Viro's `useCanvasPanel`, addressing attachment,
   cancellation, StrictMode and material/surface lifecycle together.
3. Implement `dragTransform: self | parent | none` through Viro and ViroCore.
   The recovered input hook already emits `none`, but native support is absent.
4. Use the original prompt/probe to finish Moyo Tutor Room and spatial polish,
   build matching AARs and vendor packages, then validate on Quest and PICO.

The feature remains **in progress**. The local continuation recovers the interrupted
material-bridge work and the Nitro version/codegen portion; it is not a completed
or shippable Rive panel implementation.

## Local continuation checkpoint — 2026-09-25 (device checks last)

The original implementation brief was found in local Downloads. The companion
ZIP remains unavailable. An editable fractions scene was therefore authored
with installed Rive CLI **1.1.1**, using the existing Moyo Space Grotesk font.
Source: `probes/rive-panel/rive/scene.rml`; reproduction:
`python3 probes/rive-panel/verify-rive.py`. Nine authored interaction cases pass:
rest, half, toggle-back, all-pieces, off-panel cancel, hint, hint-back, hover,
press. Inspect reports no problems. CLI screenshots/data dumps are saved under
`probes/rive-panel/evidence`. These are desktop authoring checks, not Android
runtime or headset evidence.

Library continuation is in isolated `codex/rive-viro-panel` worktrees beside
Moyo (`nitro-rive-panel`, `viro-rive-panel`, `virocore-rive-panel`). Original dirty
worktrees remain untouched. New native Rive HybridObjects load file bytes,
render the legacy Rive 11.12.1 artboard directly into a borrowed Android Surface,
route artboard-local pointers, bind the default view model, and observe numeric
changes after native advance. Native code generation and TypeScript compilation
pass; complete Kotlin/AAR validation is still in progress.

ViroCore `:viroreact:assembleRelease` passed with JDK 17, Gradle 8.3, NDK
27.1.12297006. The new `dragTransform` API supports self/parent/none; the parent
motion remains native. Its rebuilt AAR has been staged only in the isolated
Viro worktree. Viro/Nitro combined consumer build is being checked with Gradle
9.4.1/AGP 9.2.1/RN 0.88.0-rc.0 in `/tmp/rive-panel-check/android-host`.
Toolchain setup failures and full logs remain in `/tmp/rive-panel-check`.
Do not describe that combined build as passed until its final result is recorded.

Nitro's geometry/registry/descriptor tests pass **25/25**. New input-hook cleanup
cancels ownership on disable/reset/unmount and ignores another controller's
release. `useCanvasPanel` allocates after commit, registers the material before
rendering a quad, suspends in background, uses display cadence for JS producers,
and leaves native Rive on its own idle-aware Choreographer clock.

Skill source audit used in this continuation:
- No AI Slop: `000650b156983f5159695b441477f4e63b25dc85`.
- Everything Claude Code: `432485ba6b92c14fb357276a98957f348bcff9ee`;
  verification-loop and eval-harness read directly, no hooks installed.
- PR #5 is open/unmerged, head `c7dd1f3648c6c77c6ddefce13ca1fb2ef29042d1`;
  PR #2 is open/unmerged, head `65c9598786bc558517604fc32d994cb647649b7b`.
- Anthropic frontend-design: `33375500bcea98d610eb30ce10ac4e59b89c390d`.
- Local API design, Nitro, Kotlin, C++, and Argent RN workflow skills were read.

No physical device, simulator, or headset has been used in this continuation.
Quest/PICO stereo, lifecycle, input, performance and comfort gates remain
**unverified**. The user explicitly requested device validation last.
