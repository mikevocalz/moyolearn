# Horizon OS / SpatialSim testing

How to build and test `apps/mobile` on Meta's Spatial Simulator — the path for Quest and the Meta VR Glasses.
SOT-KEYWORDS: spatialsim, horizon, quest, metavr, xr-testing

## One-time machine setup

```bash
brew install --cask meta-quest-developer-hub   # bundles metavr + SpatialSim
metavr ssim download                           # ~770MB emulator image
metavr init                                    # installs the metavr-cli agent skill + MCP plugin
metavr auth login                              # only needed for Meta services, not for local sim testing
```

`metavr` lives at `/Applications/Meta Quest Developer Hub.app/Contents/Resources/bin/metavr` if it's not on PATH. The script below resolves both locations.

## Daily use

```bash
pnpm --filter mobile xr:sim run        # boot sim + build questDebug + install + launch
pnpm --filter mobile xr:sim boot       # just boot the sim
pnpm --filter mobile xr:sim status     # sim + devices
pnpm --filter mobile xr:sim screenshot out.png
pnpm --filter mobile xr:sim logs
pnpm --filter mobile xr:sim stop
```

The script is `scripts/spatialsim.sh`. It builds the `questDebug` flavor (`flavorDimensions "device"` → `quest` in `apps/mobile/android/app/build.gradle`) with `arm64-v8a` only and targets `emulator-5554`.

For a physical headset instead, use `pnpm --filter mobile android:horizon -- --device <serial>` — or let `metavr device list` pick it up.

## Constraints to keep in code review

- **arm64 only.** No `armeabi-v7a`-only native libraries; VR Glasses won't run them. The script already pins `reactNativeArchitectures=arm64-v8a`.
- **FoV.** Glasses: nominal 70°×66°, render extent 74°×68°. Keep interactive UI and status toward center; edges are not safe territory.
- **Controllerless-first.** Glasses input is eyes + hands (Look + Pinch). Don't ship flows that require a controller button.
- **Layered verification.** Sim catches rendering/interaction regressions; a Quest 3/3S with controllers disabled is the physical proxy; only real glasses validate eye tracking, optics, and thermals.

## PICO headset path (works today)

SpatialSim composites 2D panels only — entering `moyo://tutor-xr` on it returns an OS dialog:
"Immersive apps aren't supported yet." For real immersive runs use the PICO 4 Ultra:

```bash
# picoDebug flavor onto the headset (serial from `metavr device list`)
cd apps/mobile && ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a \
  pnpm exec expo run:android --variant picoDebug --device <serial>

# then route into the XR scene once the app is loaded (cold-start races drop the link)
metavr -d <serial> shell am start -a android.intent.action.VIEW -d "moyo://tutor-xr" com.moyolearn.app

metavr -d <serial> capture screenshot -o shot.png   # stereo compositor capture works
```

Known wall: the first immersive entry triggers PICO's **"Confirm Safety Within Boundary"** guardian
dialog. It is compositor-rendered — `ui dump` sees no elements, injected taps/keyevents don't reach
it, and disabling `com.pico.guardian` does not dismiss it. One physical controller-confirm clears it;
after that the scene runs unattended. `PICO_APP_ID` is unset, so PICO Platform Services calls will
fail with error 100008 — expected in dev.

## Meta XR Simulator — glasses profile (desktop OpenXR)

Meta XR Simulator (`/Applications/MetaXRSimulator.app`, installed via
`metavr tools install xrsim`) is a host-side OpenXR runtime, not an Android
emulator — it cannot run the questDebug APK. What it CAN do is serve a
Meta VR Glasses session to any desktop OpenXR client.

`tools/xr-probe` is the harness: a minimal C++ client (Khronos `openxr_loader`
built via FetchContent) that creates an instance against the glasses profile
and verifies `XR_EXT_eye_gaze_interaction` + `XR_EXT_hand_interaction`:

```bash
tools/xr-probe/run.sh
```

Expected output (verified 2026-10-06, exit 0):

```
ext XR_KHR_metal_enable / XR_MND_headless / XR_EXT_user_presence /
    XR_EXT_eye_gaze_interaction / XR_EXT_hand_interaction: yes
runtime: Meta XR Simulator 207.0.0
system: Meta VR Glasses
swapchain: 1680x1760 x3 images (Metal)
session state -> 1,2,3,4,5   (IDLE → READY → SYNCHRONIZED → VISIBLE → FOCUSED)
reached XR_SESSION_STATE_RUNNING and rendered a frame
session probe ok   (exit 0; clean STOPPING → IDLE → EXITING teardown)
```

Mechanics worth knowing:

- `XR_RUNTIME_JSON` points the loader at the sim's runtime JSON — no sudo, no
  `/usr/local/share/openxr` write needed (`activate_simulator.sh` wants that;
  skip it).
- `META_XRSIM_CONFIG_JSON` selects the device profile. `tools/xr-probe/sim-glasses.json`
  is a copy of the bundled config with `"device_profile": "Meta VR Glasses"`.
  The profile is captured at `xrCreateInstance` time.
- `applicationInfo.apiVersion` must be set to `XR_MAKE_VERSION(1,1,0)` —
  leaving it at 0 makes `xrCreateInstance` fail with `XR_ERROR_INITIALIZATION_FAILED`.
- Rendering must be Metal or Vulkan on macOS — **OpenGL/GLES is unsupported**
  (this is the hard constraint for a Viro desktop port: ViroRenderer is GLES
  on Android, but `~/virocore/ViroRenderer` already has a Metal backend).
- **Getting past READY**: the sim only promotes the session to
  SYNCHRONIZED/VISIBLE/FOCUSED once the app actually submits frames — but
  `xrWaitFrame` blocks until the session is running, so a single-threaded
  loop deadlocks. The probe uses two threads: one pumping
  `xrWaitFrame → xrBeginFrame → acquire/wait/release swapchain → xrEndFrame`
  with a real `XrCompositionLayerProjection`, the other pumping `xrPollEvent`
  for the state machine.
- Enable `XR_EXT_user_presence` and `XR_MND_headless` — the session then
  reaches FOCUSED without needing the sim window clicked/focused.
- Swapchain format must come from `xrEnumerateSwapchainFormats` — the sim
  accepts MTLPixelFormats 81 (BGRA8Unorm_sRGB), 71 (RGBA8Unorm_sRGB),
  252/260 (depth); hardcoding 80 (BGRA8Unorm) fails with
  `XR_ERROR_RUNTIME_FAILURE`.
- The probe renders a Metal clear pass directly into the swapchain's
  `MTLTexture`s (`XrSwapchainImageMetalKHR.texture`) and submits them via
  `XrCompositionLayerProjection` — this is the exact binding seam
  `VRODriverMetal` will use for a Viro desktop port. Verified by readback:
  center pixel `ff 00 ff ff`, `tex.device` equals our `MTLDevice`.
- `xrCreateReferenceSpace` is required — a projection layer with a null
  `space` gets every `xrEndFrame` rejected (`XrSpace 0x0 not registered`)
  and the session never visibly composites.
- Teardown matters: call `xrRequestExitSession`, drain events to EXITING
  (call `xrEndSession` on STOPPING), then destroy swapchain/session/instance.
  Skipping it leaves the sim's session hanging and crashpad aborts the
  process (exit 134).
- **Debug window**: set `"use_offscreen_mode": false` in the config and the
  sim opens an in-process ImGui debug window (panels: Inputs, Graphics,
  Record & Replay, XrSwapchain Previews). Requirements: all XR frame calls
  on the main thread (`xrWaitFrame` on a worker thread crashes it) and an
  AppKit event pump in the main loop (the sim creates its own
  `XrSimApplication` when `NSApp` is nil; without event pumping the window
  never draws). With offscreen mode the debug window's eye viewport stays
  black even while `Layer Details` confirms "1 layers submitted: Projection"
  — a display quirk of the Metal-on-Vulkan interop path, not missing frames.
  `use_offscreen_mode: true` runs fully headless with no window.
- Viro port feasibility: `~/virocore/ViroRenderer` already has a Metal backend
  (`VRODriverMetal`, `Shaders.metal`, `default.metallib` in the shipped
  framework) — built for iOS/visionOS only. The port is: macOS slice of
  ViroRenderer + an OpenXR shell binding `XrSwapchain` Metal textures into the
  driver + input mapping to `XR_EXT_hand_interaction`/`eye_gaze`. No GLES
  rewrite needed.
- The XR Operator API layer (`libXrApiLayer_METAX_operator.dylib`, macOS and
  Android builds under `~/Library/Application Support/metavr/tools/meta-xr-operator/`)
  is the agent-inspection surface for a running XR app — the actual
  "argent for XR" once an immersive client is running.

## What this does not cover

`metavr` has no agent-level XR interaction commands (no `look-at`, `pinch`, `assert-node-visible`). It exposes `ui`, `input`, `capture`, and `perf` — Android-level automation plus screenshots and Perfetto traces. Asserting things inside the Viro scene graph still needs an app-side test hook (e.g. testIDs surfaced through a debug bridge).
