# Rive panels inside Viro — continuation handoff

Updated 2026-09-25. **Latest steering:** React Native `0.88.0-rc.2`,
with React/React DOM 19.3.0. Quest startup now passes after fixing duplicate
React codegen classes, the shared C++ runtime, and Expo prebuilt ABI mismatch.
Rive pixels were captured in both eye views and the user confirmed grip drag.
**Latest device feedback:** the user confirms selection works in rive.8. The
remaining concern is the ray stopping at the panel; its desired endpoint appearance
is being clarified. Earlier Show hint/selection failure prompted the fixes below. The live rive.7 trace exposed missing ClickUp:
normal presses delivered states 1 then 3 to JS, dropping state 2. The Android
bridge inherited event coalescing, which merged consecutive Up/Clicked events.
Rive.8 preserves click/hover edges and uses geometry-accurate panel hit tests.
The absent grip release also left JS panelWorld at the initial pose after the
native group moved. The new APK built and installed; physical acceptance remains open.


The Android Surface bridge, Nitro Rive renderer, native
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

Local implementation commits: Nitro `731d4b5` (native implementation `dacfa3f`),
Viro `f7a1623`, ViroCore `881483d7`. Full SHAs are in the artifact manifest.
Moyo latest implementation commit: `d7a904194fe1c3e7bf841d2c81ec4fedab54fdee`; initial probe: `1449bf3`. Handoff metadata follows separately.

Cloud branch `claude/gifted-ptolemy-r9kv7p` was recovered in Moyo and Nitro.
The interrupted Java changes were not on a Viro remote branch and were
reconstructed from source. Original `/Users/mikevocalz/nitro-canvas-in-Vision`
contains separate uncommitted work, including an incomplete Rive stub. Do not
copy that diff over this implementation. `/Users/mikevocalz/expo-pico` also has
unrelated local changes and was not modified.

Vendor packages in Moyo:
- `vendors/reactvision-react-viro-3.0.0-moyo.5-rive.8.tgz`
- `vendors/nitro-canvas-in-Vision-0.0.2-rive.3.tgz`

The Viro package contains paired, rebuilt renderer and React bridge AARs.
Installed renderer checksum was compared with the final source build and
matches. Viro `rive.5` adds the arm64 live-ray renderer; `rive.4` removed generated RN core classes from its handwritten bridge AAR; Nitro `rive.3` aligns its development tooling with RN rc.2. Earlier Rive tarballs were intermediate.
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
| Viro `:viro_bridge:assembleRelease` | pass against RN 0.88.0-rc.2 |
| Viro changed panel/hook/controller/button TypeScript | pass |
| Moyo mobile TypeScript with final vendor packages | pass |
| Moyo Android APK | rc.2/rive.5 build and install pass; Horizon-enabled final build passes (1379 tasks, 5m57s); installed and launched; runtime Horizon flags true |
| Historical rc.0 Metro Android export | pass: 26 MB Hermes bundle and 143 KB Rive asset |
| Frozen lockfile | pass; unrelated workspace dependency changes removed |
| Packaged-source audit | Nitro rive.3 prior audit passes; Viro rive.5 compares 1,643 packaged files with no mismatches |
| Physical headset acceptance | Quest 3S startup and Rive surface pass; stereo capture shows panel; user confirms drag; selection fails and candidate fixes await retry |

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
  AGP 9.2.1/Kotlin 2.3.21/RN 0.88.0-rc.2.
- Moyo: `pnpm install --filter mobile... --ignore-scripts`, then
  `pnpm --filter mobile typecheck`. Android uses the existing Expo 58 preview
  dependency set, not a wholesale SDK upgrade. Prebuild used local
  `expo-template-bare-minimum-58.0.7.tgz` with `--platform android --no-install`.
  JDK 17: `./gradlew :app:assembleQuestDebug -PreactNativeArchitectures=arm64-v8a --max-workers=2 --no-parallel`.

## Device results and remaining work

After software checks, Argent detected the attached **Quest 3S**, Android SDK 34.
The rc.2 Quest APK built successfully (975 tasks, 6m34s after reducing native
build concurrency) and installed with `adb install -r`, preserving app data.
Argent launch exposed two app startup issues before the Rive scene:

1. Viro's bundled NDK 27 `libc++_shared.so` was selected, but Nitro Fetch needs
   `__cxa_init_primary_exception`. The app now stages NDK 28.2.13676358's runtime
   as its own JNI source and selects it first. The config plugin preserves this
   through prebuild. Rebuilt APK exports the symbol; the next launch passed it.
2. Prebuilt Expo Image Manipulator 57.0.9 expects the old `io.github.lukmccall.pika`
   converter signature while installed Expo Core uses `io.github.expo.pika`.
   Android Expo autolinking now uses `buildFromSource: [".*"]` to align modules
   with installed Core. Source rebuild passed (1,359 tasks, 53s). After reconnection, installation and launch passed; no repeat startup crash.

The earlier disk blocker was resolved by the user freeing space and installing
NDK 28.2.13676358. Root RN override prevents nested RN 0.87 under Skia. Debug
variants load development JS. Owned Metro is on 8082; the user's Metro 8081 is
untouched. Task-owned adb reverse mappings are device 8081/8082 to host 8082.
A rebuilt APK, not the original installed app, is used for validation.

The Rive scene opened in `VRActivity`, OpenXR reached FOCUSED and reported
valid views. Native Rive reported `surfaceAttached=true`, frames rendered,
and no renderer error; the loading overlay cleared. A headset screencap shows
the actual fractions panel in both eye views. Argent's screen-sharing backend
crashed on the Quest (JNI null object); read-only `adb exec-out screencap` was
used as the capture fallback. The room-containing capture remains outside git
at `/Users/mikevocalz/rive-panel-device-evidence/quest-rive-before-label-fix.png`.
Oversized Viro labels now use font 20 scaled to 0.25 with centered, clipped
grip bounds; the Viro MCP preview confirms legibility and fit. Native capture is pending. An immersive Metro reload loses dynamic `VRQuestScene` registration;
restart the app through MainActivity and open the probe route instead.

User report: **“ray is being cut off when trying to select (which im unable to)
but drag works.”** Direct native Rive down/up at authored artboard (150,310)
changed `piece0=1` and `revision=1`, but `selectedCount=0`. This isolates a count
binding failure even before qualifying controller mapping. The asset now uses
operation converter groups instead of bound formula tokens; all nine desktop
cases pass. ViroCore also keeps hit tests live for `dragTransform=none` instead
of freezing the press hit. Both are candidates until retried on Android.
The Quest reconnected and the updated APK installed successfully. The latest observed app launch
remained at the Moyo splash; headset awake/worn state was not established; debugger evaluation timed out. Do not mark selection passed.

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

## Latest layout and configuration checkpoint

User requested Viro MCP explicitly. Added and authenticated the Viro endpoint in Codex;
called `reactviro_get_component_props` for ViroText/ARScene, `reactviro_validate_scene`
(zero errors/warnings), and `reactviro_render_scene` for the panel/grip layout.
The preview uses placeholder panel geometry, not the Android-only Rive producer.
Evidence: `probes/rive-panel/evidence/build/viro-mcp-layout-{validation.json,render.png}`.
No headset camera image was sent to the MCP server.

Initial placement now derives from the camera: 1.8 m horizontally ahead, 0.2 m
below the viewer's eyes, facing the viewer. It is set once and remains draggable
in world space. This replaces the fixed world y=1.45 assumption that put it too high
for the seated viewer. Grip label physical bounds remain 0.6 × 0.09 m, with font 20
scaled to 0.25 for readable glyphs. Diagnostic text ignores ray events.

The latest Quest build passed (1359 tasks, 37 seconds), install preserved app data.
ViroCore renderer rebuild is arm64-only; all 14 ELF libraries pass 16 KB alignment.

**User invariant:** use expo-horizon-core for Meta and preserve app window dimensions;
keep device orientation `default`. The base checkout had no Horizon configuration.
User provided the Software Mansion repository and requested integration. Added
`expo-horizon-core@57.0.2` with documented 1024 × 640 dp dimensions, default orientation,
supported Quest devices, and head tracking. These are app window settings, independent
of Rive scene dimensions. The local Viro plugin now merges the Quest manifest instead
of replacing it, preserving Horizon metadata and layout. Plugin order avoids duplicate
Gradle device flavor declarations. An explicit BuildConfig feature patch is required
by AGP 9; see `patches/expo-horizon-core@57.0.2.patch`.

The shared Expo Android library now carries the device dimension so Horizon's Quest
variant can propagate from the app. Same-dimension fallbacks use `matchingFallbacks`,
not `missingDimensionStrategy` (the latter silently selected mobile in the first build).
The no-dimension PICO fallback excludes Expo once Expo owns the dimension.

A reusable `with-spatial-window-contract` prebuild guard checks declared Horizon/PICO
window dimensions and default launcher orientation after manifest writers. Six Node
regression checks cover preservation, overwritten manifests, changed size, immersive
apps without declared sizes, forced landscape, and loss of the required Horizon plugin. The user also requested this
prevention for other apps; a shared rule was saved in `~/.codex/AGENTS.md`. This is a
future-work safeguard, not a claim that every other local app was audited or changed.

Final Horizon-enabled APK: build passes; actual APK manifest inspected with aapt2 confirms 1024 × 640 dp and MainActivity screenOrientation=-1 (default). Compiled Horizon Quest Config.isHorizonBuild=true. Typecheck, frozen lockfile install and six configuration regressions pass. The APK retains the required NDK 28 C++ exception symbol. Device acceptance is tracked separately.

## Latest physical-device result

Horizon-enabled APK installed with `adb install -r`; app data preserved. Fresh Metro
on owned port 8082 and app launch respond normally. Runtime reports both
`ExpoHorizon.isHorizonBuild=true` and `isHorizonDevice=true`. Opened the engineering
route (the cold-start deep link needed an explicit Expo Router replace after startup).
Native Rive rendered 80 frames and cleared its error/loading overlay. Initial pose was
[0.0391, -0.2050, -1.8012], yaw -2.1814°, derived from the initial camera pose.

The native capture confirms that the scaled grip label fits inside the amber button.
It is an inverted/off-axis capture (camera up.y=-0.73), so it cannot qualify the normal
worn viewing position. At the latest observation, the grip remained captured by source 1
and displayed “Moving panel”; Rive selection is intentionally disabled during a grab.
The user was asked to wear/keep the headset awake and check release, selection and
normal panel placement. No reply confirming those behaviors was received yet. Do not
mark controller selection or the native count converter fix passed.

Private capture: `/Users/mikevocalz/rive-panel-device-evidence/quest-rive-horizon-layout.png`.
No room capture is committed or sent to Viro MCP. Owned Metro 8082 and device reverse
ports 8081→8082 / 8082→8082 remain available for the user's check; preserve user Metro8081.

## Stuck drag follow-up

User confirmation: both triggers and grip buttons are released, but “Moving panel”
stays displayed. This is a failure, not a pending instruction to release a button.
The JS probe reports captured source 1 and `grabbed=true`, which disables body input.
ViroCore `7a366057` suppresses pinch/grab events on controller-owned sides, cancels
held actions when inactive or aim is unavailable, and resets hand edge history on
tracking loss. Previously hand gestures could duplicate a controller press and
inactive float actions skipped their release. Host button-edge tests and the
arm64 renderer build passed; all 14 native libraries passed 16 KB alignment.
Viro rive.6 contains this renderer. Physical acceptance is still required.

Rive.6 APK build: pass (1379 tasks, 37 seconds); installed with `adb install -r`.
SHA256: `839e39a198db4f0b6cb1798e39c0e71402bda49b135e35933fa9c77938b7128e`.
All 1643 packaged files match the installed dependency. Mobile TypeScript and
six spatial configuration tests pass. Final APK still declares 1024dp × 640dp
and MainActivity orientation -1 (default). Startup debugger evaluation timed out;
Metro 8082 was restarted from this worktree, and headset foreground confirmation
was requested. Do not report the stuck-drag fix as physically accepted yet.

Latest: rive.7 (Viro `4453325`, ViroCore `cb0b5e74`) also cancels inactive face
buttons after runtime inspection exposed captured source 5 (A button). APK build
passed (34 seconds); `adb install -r` succeeded. All 1643 package files match, and
all 14 renderer libraries pass alignment. SHA256:
`7097f413b0464f81976b8fca926a98b6ebf1ff8061b3dd9cb47e5f1aec0a263b`.
The rive.6 startup debugger recovered after foregrounding/deep-linking; navigate
with Expo Router after startup if the deep link loses to initial navigation.
A direct native pointer diagnostic showed down0=1 but did not establish reliable
click/count completion; do not claim the count converter is fixed. No physical
release/selection acceptance has been received yet.

## Missing release identified from live events

Viro `5dbcd55` (rive.8) disables coalescing for ON_CLICK and ON_HOVER in
ViroEventEmitter. RN 0.88.0-rc.2 Event.canCoalesce defaults to true. ClickUp and
Clicked share the same view/event name and arrive consecutively, so merging
removed the release required by both Rive and the grip pose-persistence callback.
Other event types retain existing coalescing behavior.

Evidence: `probes/rive-panel/evidence/device/quest-rive7-missing-release.json`.
The native group moved to approximately [0.478, 0.791, -2.201], while the
input matrix stayed at [-0.032, -0.192, -1.813]. Subsequent body hits were rejected
as off-plane. This is stronger evidence than the earlier inactive-action theory;
those cancellation fixes remain useful but did not address this delivery loss.

Viro MCP confirmed highAccuracyEvents on ViroQuad. It is now enabled for the
interactive Rive quad and grip: bounding-box hits need not lie on a rotated
panel, while the input mapper requires plane accuracy within 1 cm. The temporary
live setting and event wrappers are diagnostics only; the committed package and
new app launch provide the lasting fix. Bridge build, targeted Viro type emit,
mobile typecheck, and six window-contract tests passed. Physical acceptance must
show down/up/clicked, Show hint toggle, and selection after moving/releasing grip.

Rive.8 APK SHA256: `bc12146671e70a5dfa760ef996e624250ca41274e92167a858732e98db42532e`. APK build passed in 28 seconds (1379 tasks); installation preserved app data.

Rive.8 launched successfully after allowing startup to settle; Argent confirms
Rive frames rendered, owner=null, grabbed=false, and highAccuracyEvents=true
on both body and grip. A temporary JS trace records click states and outgoing
Rive pointer edges. The user was asked to toggle Show hint, move/release the
grip, and toggle again. Await physical feedback before marking acceptance.

Latest user feedback after rive.8: “selection works though”; the ray stops at
the panel. This endpoint is the current intentional first-hit behavior. The
OpenXR presenter has separate beams but a single reticle updated by both hands,
so the inactive hand can displace the visible cursor from the active beam.
Asked whether to retain surface termination with a visible dot or extend the beam
beyond the panel. Do not change ray behavior until this preference is resolved.
Runtime confirms original asset FNV1a=249331036, hintVisible=true, revision=7,
grabbed=false and owner=null. An experimental hint write-converter change was
reverted; it was not the asset producing the user-confirmed working selection.
