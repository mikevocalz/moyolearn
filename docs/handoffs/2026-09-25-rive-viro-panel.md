# Rive panels inside Viro — continuation handoff

Updated 2026-09-25; audited and extended 2026-09-26 — see the dated audit
section at the end. **Latest count fix:** rive.10 derives selection from native
`piece0..piece3` into Zustand and updates the host label and Rive aggregate.
Local tests and typechecks pass, and the user confirmed the count behavior
works on the Quest — physical count acceptance received.
User requirement: always Zustand, no React `useState`.

**Latest steering:** React Native `0.88.0-rc.2`,
with React/React DOM 19.3.0. Quest startup now passes after fixing duplicate
React codegen classes, the shared C++ runtime, and Expo prebuilt ABI mismatch.
Rive pixels were captured in both eye views and the user confirmed grip drag.
**Latest device feedback:** the user confirms selection works in rive.8. The
user chose to keep the ray ending at the panel with a visible endpoint. Rive.9
adds independent per-controller hit dots; the installed headset capture confirms
a visible beam and endpoint over the panel in both eye views. Earlier Show hint/selection failure prompted the fixes below. The live rive.7 trace exposed missing ClickUp:
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
| --- | --- | --- |
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

- `vendors/reactvision-react-viro-3.0.1-moyo.0.tgz` — current; repacked with
  the post-merge `viroreact` AAR (see the 3.0.1 merge section) and supersedes
  the rive.N packages below, which are kept as history
- `vendors/reactvision-react-viro-3.0.0-moyo.5-rive.9.tgz`
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
| --- | --- |
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
| Physical headset acceptance | Quest 3S startup and Rive surface pass; stereo capture shows panel; user confirms drag, working selection and the Zustand-derived count; three-slot `xr-layout-probe` composition verified — details in the dated sections below |

Whole Viro TypeScript still fails on pre-existing missing web-renderer sibling,
missing `GpuProducer` exports and unrelated AR/web source errors. Packaging used
`npm pack --ignore-scripts` after targeted emit; this is not a clean whole-repo
build claim. No placeholder GPU implementation was invented to silence errors.

Build logs are under `/tmp/rive-panel-check`. Persist relevant final logs with
the device evidence before relying on that temporary directory across sessions.

2026-09-26 note: `/Users/mikevocalz/moyo-rive-panel` now sits on `main`, where
the whole `probes/` tree shows as untracked. It contains additional
`probes/rive-panel/evidence/build/*.log` files beyond the set committed on this
branch (for example `rive-count-typecheck.log`, `rive10-install.log`,
`viro-zustand-*.log`, `viro-rive10-pack.log`). They were left in place,
uncommitted — decide whether they belong on `codex/rive-viro-panel` before
switching that checkout back.

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

## Visible ray endpoint

User accepted the recommended ray termination with a visible pointer on the panel.
ViroCore `f3b02ead` adds a 7 mm radius cyan dot per controller ray. Each dot tracks
its own actual surface hit, is hidden for background hits and lost tracking, honors
reticle visibility, and is excluded from hit tests. Beam/dot rendering order keeps
them visible over panel pixels without depth writes. The existing legacy reticle
is retained; the new per-ray dots no longer depend on its shared position.
Viro `2a394ab`, package rive.9, stages the renderer. Native arm64 build and 14-library
alignment checks passed. No Horizon width/height/orientation settings changed.

Rive.9 is installed and the probe is running. Native capture confirms the cyan
beam reaches the panel and its endpoint dot stays visible in both eye views.
The amber handle reads Hold to move; runtime reports grabbed=false, owner=null,
empty error status and 1204 frames. Private capture (not committed):
`/Users/mikevocalz/rive-panel-device-evidence/quest-rive9-hit-dots.png`.
Both controllers simultaneously were not captured; code stores separate dot nodes
per source. The prior user confirmation covers selection; the full lesson count
acceptance remains separate. Moyo implementation `26f1e6e`; final APK SHA256
`b41cbf44d853ddfb3a13523081a0c09bc02832dcded64ee04630bf171be20f81`.

## Selection count and Zustand (rive.10)

The live Quest runtime showed pieces `[0,1,1,0]` and revision 5 while both
`selectedCount` and the host label remained zero. The authored aggregate is not
a reliable selection source on Android. The new binding observes all four piece
properties, hydrates existing selections immediately, derives the total in a
per-instance Zustand store, and writes the same total back to Rive. Rive still
owns the actual selection interactions. Retired callbacks cannot mutate a
replacement probe. Native disposal clears the observers.

All state introduced in the route, probe, and shared `useCanvasPanel` hook now
uses Zustand; imperative handles remain refs. Viro `8d7c645` packages this as
`3.0.0-moyo.5-rive.10` with Zustand 5.0.15. Moyo consumes the local tarball.
The existing native APK/AARs are unchanged; current JS is served from the owned
Metro on port 8082. Horizon remains 1024dp × 640dp, default orientation.

Validation: three count/lifecycle tests and six window-contract tests pass;
mobile typecheck and targeted Viro type emit pass; all 1644 installed package
files match the tarball. **Physical acceptance received 2026-09-25: user
confirmed the count behavior works on the Quest** — the Zustand-derived
selection total and host label track piece selection on device.

## Viro/ViroCore 3.0.1 merge and push (main)

`mikevocalz/viro` main is `019ec2e` and `mikevocalz/virocore` main is
`d4e09840`, both pushed to the user forks. Each is a fast-forward land of the
upgrade branches after two merges: `codex/rive-viro-panel` (the rive.5–10
input series: hit tests, ray renderer, input ownership, count binding) into
`upgrade/viro-3.0.1`, then `fork/main` (OpenXR runtime info, foveation, PICO
profiles, 16 KB page-alignment gate) into `upgrade/virocore-3.0.1`. Conflicts
were the mechanical class plus one semantic pair: the alignment gate stays on
minimum PT_LOAD and the AAR script keeps building `:viroreact`, which are the
two findings Codex raised on upstream PR #332 — both verified fixed in the
pushed tree along with the restored `initPassthrough()` signature. A duplicate
`kPicoControllerExtensions` table from the second merge was removed in
`d4e09840`; `VROSceneRendererOpenXR` compiles clean.

Rebuilt `viroreact-release.aar` SHA-256
`fbbd4cb15e9fc761a9b9b5866e52cda49ef4d3e51c9ccf265ff325e4e4e30b62`; the 16 KB
gate passes all 14 arm64 libraries including `libopenxr_loader.so` at 0x4000.
Tags are pushed on both forks and upstream GitHub releases mirrored (viro
48/48, virocore 23/25 — upstream's two malformed `rc-*` refs return HTTP 422);
`Latest` points at v3.0.1 on both.

## Vendored 3.0.1-moyo.0 and the questDebug build fix

`vendors/reactvision-react-viro-3.0.1-moyo.0.tgz` now carries the post-merge
AAR; the pnpm override and `apps/mobile` dependency point at it. Two
regressions surfaced on the first direct Gradle build and are fixed: the
postinstall marked Skia Graphite on but never staged the Android
`libwebgpu_dawn.so` its CMake imports (now copied per-ABI inside
`tooling/enable-skia-graphite.mjs`), and `@expo-pico/core` linked all four ABIs
against the arm64-only Nitro prefab — direct Gradle invocations need
`-PreactNativeArchitectures=arm64-v8a`, which `pnpm android:xr` was masking
with `ORG_GRADLE_PROJECT_reactNativeArchitectures`.

## Three-slot layout probe (moyo://xr-layout-probe)

`apps/mobile/src/native-3d/xr-layout-probe.tsx` composes the arc from
`worldSlot`: `RivePanelProbe` on the left slot, `PremiumXRMediaPanel`
`size="boardPanel"` on centre, `XrNatalie` on the right with her feet dropped
below the eye-level slot origin. `apps/mobile/app/xr-layout-probe.tsx` latches
the first credible `onCameraTransformUpdate` pose, derives yaw with the same
`atan2(-fx, -fz)` convention as `placeInFrontOf`, and mounts the composition
once — the same geometry the production `XrTriPanel`/`XrBoardSurface` pair
uses, so panel positions cannot drift from it. Mobile typecheck is green.

Device verification of the probe is no longer pending — it was verified later
the same day; see the next section. When this paragraph was written, the
Quest 3S (340YC10GC3014S) had dropped off ADB before the deep link was sent.
The fresh 3.0.1 APK was already proven on device — stereo passthrough in both
eyes, JS bundle loaded, no native crash — via `moyo://rive-panel-probe`
before disconnect.

## Device evidence — three-slot layout probe (Quest 3S, 340YC10GC3014S)

`moyo://xr-layout-probe` verified on device 2026-09-25:
`docs/handoffs/evidence/xr-layout-probe/quest-3s-three-slot.png`.
Rive lesson on the left slot ("Make one half", 0/4 selected, Hold to move
grip), `boardPanel` on centre, Natalie lit at floor level on the right,
controller ray live on the centre panel — all three placed by `worldSlot`
after the first credible camera transform. Both eyes render over stereo
passthrough on the merged 3.0.1 stack.

Notes: the compositor logged `Failed to create an anchored node` at each of
the three slot positions — draggable nodes request persistent anchors the
Quest anchor subsystem declines; rendering is unaffected. At capture time the
centre board was the navy stand-in; `8ebdf4a` later swapped in the real 16:10
board (see the 2026-09-26 audit section). Live ink still binds through
`XrBoardSurface` in the tutor scene.

Dev-lane note: a USB reconnect clears `adb reverse`, which is what produced
the earlier blank launches — `adb reverse tcp:8081 tcp:8081` (Metro over
UsbFfs) and `adb reverse tcp:3000 tcp:3000` (API) must both be re-added after
replug. The app's own API (`EXPO_PUBLIC_APP_URL`) is now pinned to
`https://app.moyolearn.com` in all three `apps/mobile/eas.json` profiles and
in `apps/mobile/.env.local` (gitignored), so shipped and dev builds no longer
fall back to device-loopback and fail at startup / first fetch — `426b4fa`;
the full variable set and the fail-closed startup guard are in the
2026-09-26 audit section.

## 2026-09-26 audit — real board, sign-in chain, device and tooling notes

**Real board (`8ebdf4a`, 20 files).** The probe's centre slot now hosts the
real digital board, not the navy stand-in: `BOARD_ASPECT` moved 5:7 → 16:10
(`packages/ui/xr/board-layout.ts`), `boardSurfacePixels` is 1400 × 875, and a
new `packages/ui/xr/XrBoardTray.native.tsx` (+ `.types.ts` +
`board-controls.ts`, shared with `XrRail`) renders the bottom tray. The board
sits on a draggable `ViroNode` carrier (`dragType="FixedDistanceOrigin"`,
`dragTransform="parent"`) mirroring the Rive grip pattern. Placement latches
on a *settled* pose — two camera samples ~350–400 ms apart, travel < 0.2 m,
forward dot > 0.9, the same settle rule `tutor-xr-screen` uses — and
`trackingOrigin="floor"` puts Natalie at y = 0 (the GLB is authored at
~1.673 m, human height at scale 1; there is no scale prop). Once the board
binds, the coach greeting posts through `useTutorStore` → the signed
`/api/tutor/coach` SSE stream → `audioQueue.enqueue` → `XrNatalie`.
App and `ui` typechecks are green, the 216 xr tests pass, and lint is clean
apart from two pre-existing route warnings. **Not yet device-verified
post-rebuild:** ink rendering, board-drag persistence and Natalie actually
speaking — the run ended at a sign-in wall before any of these could be
exercised. Do not mark them accepted.

**API origin (`426b4fa`).** The "That did not load" failure on the tutor
screen traced to `GET /api/tutor/session` going to `http://localhost:3000`
because `EXPO_PUBLIC_APP_URL` was unset — on the headset, localhost is the
Quest itself, so the fetch failed instantly. All three
`apps/mobile/eas.json` profiles now carry
`EXPO_PUBLIC_APP_URL=https://app.moyolearn.com`, `EXPO_PUBLIC_AUTH_URL`,
`EXPO_PUBLIC_AUTH_MODE=live` and `EXPO_PUBLIC_SENTRY_ENVIRONMENT`;
`apps/mobile/.env.local` (gitignored) points dev bundles at the production
API. `assertApiOriginConfigured()` runs at startup in
`apps/mobile/app/_layout.tsx` and throws if the variables are lost again —
fail-closed by design.

**Native sign-in, bug one (`3c628fa`, shipped).** The `@better-auth/expo`
client sends `expo-origin: moyo://`, which the server plugin copies into
`Origin`; `trustedOrigins` was empty, so every native sign-in failed
`INVALID_ORIGIN` and surfaced as "Invalid callbackURL". Fixed by
`trustedOrigins: ['moyo://']` in `packages/auth/src/server.ts`; merged to
`main` and deployed to app.moyolearn.com (Vercel deploy
`dpl_H3T16yXzCbG2RAcv1bu4WnWsh5m6`, curl-verified — `expo-origin` now reaches
the credential check). The `sign-in-content.tsx` comment was updated to
match.

**Native sign-in, bug two (in-flight, uncommitted).** On device, the email
sign-in response carries `redirect: true`, so the expo client treats it as
an OAuth handoff and lazily imports `expo-web-browser` — not installed — and
red-boxes `Requiring unknown module`. The fix exists only as uncommitted
edits in the `/Users/mikevocalz/moyo-rive-panel` checkout (currently on
`main`): `expo-web-browser: 57.0.3` in the pnpm catalog and
`apps/mobile/package.json` — 58.x demands compileSdk 37 while that
workspace's Expo is 57.0.15. It needs an APK rebuild and redeploy before
native sign-in can be declared verified.

**Quest device notes.** Serial `340YC10GC3014S`; the installed package is
`com.moyolearn.app` (not `com.moyolearn.mobile`); this session ran Metro on
8081 over UsbFfs reverse (the earlier rive.N sessions owned 8082). Screenshots that actually work: `adb exec-out screencap -p` on the
default display, `-d` for the virtual display hosting the volumetric window
— a plain `screencap` produced 0-byte files in an earlier attempt. The Quest
virtual keyboard's `input text` drops characters on whole-string injection —
send per character or commit via the keyboard's "Submit Text" key;
uiautomator taps need display-0 pixel coordinates on the 3664 × 1920
logical frame.

**Argent.** CLI at `/opt/homebrew/bin/argent` v0.25.2 (0.26.0 is available
but not applied — needs user consent). The MCP tool listing failed
mid-session; `argent run <tool> --udid 340YC10GC3014S` works:
`list-devices` shows the Quest as android/device, `describe` returns the
uiautomator tree and `launch-app` works, but `gesture-tap` does not reliably
hit volumetric windows — `adb input tap` on display 0 does.
