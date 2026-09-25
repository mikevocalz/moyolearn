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

## Starting revisions (2026-09-25)

| Repo | Branch | SHA |
|---|---|---|
| mikevocalz/viro | `decax9-three-panel` | `93bccaed52fa9aea8a7cc003f5dc6d88784d881f` |
| mikevocalz/nitro-canvas-in-Vision | `decax9-three-panel` | `2bd37ecb67e182c659ab637ce9d50f6766f1aff6` |
| mikevocalz/virocore | `pico-support` | `8e3750fed7b1c7f711baefe32a8a832df0e4672b` |
| mikevocalz/expo-pico | `main` | `9d217afc465cf58b7e50149ac1fa03b935ba5e3e` |
| mikevocalz/moyolearn | `upgrade/expo-sdk-58-beta` | `b1e3935` |

Work branches: `claude/gifted-ptolemy-r9kv7p` in each repo.

## Findings so far

- **The app's Viro is not on GitHub.** Moyo consumes
  `vendors/reactvision-react-viro-3.0.0-moyo.4.tgz`. Its commit message
  (moyolearn `7e9cae6`) says it was cut from `~/viro` commit `2bb0b5a`, which
  does not exist on `origin`. `decax9-three-panel` is still `3.0.0-moyo.3`, and
  its canvas panels import `nitro-canvas-in-Vision` at the top level, which
  breaks the Metro bundle for every consumer. The tarball carries moyo.4's
  TypeScript (`components/CanvasPanel/nitroCanvas.ts`, lazy `require`), so it is
  recoverable. The Java and C++ inside the tarball ship only as AARs.
- **Nothing in Java calls ViroCore's external texture.** virocore
  `pico-support` has `VROExternalSurfaceTexture` and its Android
  AHardwareBuffer → EGLImage → `GL_TEXTURE_EXTERNAL_OES` import, but no JNI
  entry point and no material hook use it. viro's
  `MaterialManager.java` has no `canvasSource` branch, so
  `{ canvasSource: id }` is dropped and the quad shows its fallback colour. This
  matches `nitro-canvas-in-Vision/docs/MISSING-VIRO-INTEGRATION.md`.
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

- **The external texture would sample black even once wired.**
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
| 2. Native texture bridge | in progress: ViroCore texture type and JNI |
| 3. Input mapping and drag | input mapping **done**, pushed as nitro-canvas-in-Vision `4d32d43` on `claude/gifted-ptolemy-r9kv7p`: `src/viroreact/panelMath.ts`, rewritten `useCanvasInViroInput`, 23 passing `node:test` cases (`node --experimental-strip-types --test test/*.test.ts`). Grip drag (`dragTransform`) in progress in ViroCore. |
| 4. Moyo Tutor Room | not started |
| 5. Spatial polish | not started |
| Device gates (Quest, PICO) | unverified; needs a headset |
