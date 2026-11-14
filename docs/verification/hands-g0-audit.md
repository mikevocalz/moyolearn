# Hands-first G0 source audit

Date: 2026-11-14 UTC. Status: source audit complete; physical G0 blocked. No hands feature code was changed during this audit.

## Skills and review bar

Read `cpp`, the repository `react-native-best-practices` (Callstack), and `xr`. Read the tailored foldable skill in full from `/Users/mikevocalz/viro-external/.agents/skills/mikevocalz-foldable-layouts/SKILL.md`; `git hash-object` returned the required blob `69a051ad0a924f778ed54f9222fe8af0c5eef701`. This does not authorize changing Moyo's motion layer or window contract.

The six named ViroReact specialist skills were not found in the inspected skill directories. No claim is made that they were loaded. This audit follows their relevant concerns inline: preserve native ownership and existing funnels, separate runtime capability from product claims, and require physical comfort, input and lifecycle evidence. Native implementation and SDK semantics still require their specialist review before changes.

Canonical roster is readable at `/Users/mikevocalz/viro-external/prompts/ROSTER.md`; its complete contents are embedded below. Seats describe a review bar, not reviews actually performed by named people.

## Renderer and bridge provenance

- `apps/mobile/android/settings.gradle:viroPackageRoot` resolves the installed `@reactvision/react-viro/package.json` through Node, then maps `:viro_renderer` to its Android project. `apps/mobile/android/app/build.gradle:dependencies` includes that project.
- `apps/mobile/android/build.gradle:ext.moyoViroRendererAar` pins `vendors/viro-renderer-0ea780701.aar`. `patches/@reactvision__react-viro@3.0.1-moyo.1.patch:viro_renderer/build.gradle` makes the renderer project consume this root override. `apps/mobile/plugins/renderer-pin.js:updateRendererPin` and `with-viro-android-linkage.js` preserve the pin through prebuild.
- The AAR SHA-256 measured now is `184e39d034cf22eb0b45f056d0258234b31e61d07454fdf7a4f1405816f4a1b5`, matching `vendors/viro-renderer-0ea780701.provenance.json:aar_sha256`. That provenance names source commit `0ea78070138a3357858af5d702e8fdbb095d0e6a`, baseline `82ad61e74549073a9dc8ba95ede70f0f854889fc` and arm64 NDK 27.1.12297006 packaging.
- `git show 0ea780701:android/sharedCode/src/main/cpp/VROInputControllerOpenXR.cpp` confirms the pinned source has `initHandTracking`, skeletal aim and pinch code. It maps hands to the existing controller source IDs and uses a single `0.7f` strength cutoff. This is source/provenance evidence, not proof that any currently installed headset build contains it.
- Root `package.json:pnpm.overrides` selects `vendors/reactvision-react-viro-3.0.1-moyo.1.tgz`; `apps/mobile/package.json:dependencies` still declares `3.0.1-moyo.0`. Neither root nor mobile `node_modules` exists. Attempting to read the installed package failed with `MODULE_NOT_FOUND`. The actually installed bridge version cannot be established until dependencies are restored; do not label the manifest discrepancy resolved.
- Sibling source checkouts exist: `/Users/mikevocalz/virocore` HEAD `79f9fd89a0540281d473a57efd1590fb5642febd`; `/Users/mikevocalz/viro` HEAD `98babbc1dc8b4e1357a6ab9283691025b2a3413c`. These are newer than the pinned renderer and must not be substituted for its source. Both have existing deleted build/distribution files; preserve that user state. Untracked Moyo AARs `5a7957d`, `9d6ab4e`, and `aae4546` were present before this audit and were not selected or changed.

## Verified input seams and gaps

- Sibling `virocore/android/sharedCode/src/main/cpp/VROSceneRendererOpenXR.cpp:initHandTracking` invokes native hand setup and `setHandTrackingEnabled` forwards the gate. Optional extension declarations include hand interaction; no Meta-only capability should become mandatory for PICO.
- Sibling `VROInputControllerOpenXR.cpp:processHands` uses `ViroOculus::LeftController` / `Controller` for hand sources, so they are not distinct from physical controller IDs. It cancels a source on lost tracking, applies FB system/menu gesture filtering, and queues pinch button edges. Strength `>= 0.7f` and distance `< 0.02f` have no separate release threshold. No `poke_ext` binding was found in this file. These observations do not prove event delivery on a controller-free headset.
- Sibling `viro/components/ViroXRSceneNavigator.tsx:registerIntentAndLaunch` passes `handTrackingEnabled` through `VRQuestNavigatorBridge.setIntent`. `ViroVRSceneNavigator.tsx:Props` exposes `onHandUpdate`; `Types/ViroEvents.ts:ViroHandPinchEvent` and `ViroHandUpdateEvent` provide typed shapes. A type declaration is not proof that the required Android path emits that event.
- `packages/app/features/tutor/tutor-xr-screen.native.tsx:TutorXRScreen` mounts `ViroXRSceneNavigator` without `handTrackingEnabled`. Its scene mounts `ViroController`, routes release/disconnect through `terminatePointer`, and routes panel/stylus samples through `handleSurfaceInput`. Preserve this funnel.
- `packages/ui/xr/board-pointer.ts:BoardPointer` enforces one source until finish/cancel; invalid or off-paper motion ends the segment. `packages/ui/xr/XrPanel.native.tsx:onPointerClickState/onPointerDrag` is the current panel input seam. Native plane intersection and near/far ownership must produce samples for these existing paths, not a parallel JS drawing engine.
- `tutor-xr-screen.native.tsx:stylusBoard` and `SpatialStylusBoardInput.handle` already feed `handleSurfaceInput`; hand ownership must arbitrate with that established input.

## G0 physical evidence and checks

The initial parent-agent Argent inventory found no reachable Quest or phone: a paired iPhone was disconnected and Android AVDs were stopped. This is the historical initial inventory; see the attached-device follow-up below. No cold launch, pinch, drag, menu pinch, system gesture, direct-touch stroke, voice, seated reach, frame pacing, PICO pass or headset recording ran. Controller-free event delivery remains unknown. No existing verification statement is upgraded to a pass.

Checks actually run: local source searches, pinned-source inspection through `git show`, package-resolution attempt (failed), AAR SHA-256 (matches provenance), skill blob hash (matches required pin). No TypeScript, lint, unit, Android or PICO build ran in this audit. The sibling virocore `.build` directory is absent; rebuild feasibility has not been demonstrated.

## Attached-device follow-up (2026-11-14 UTC)

The parent agent subsequently reached a Quest 3S through Argent, serial `340YC10GC3014S`, Android SDK 34. The installed `com.moyolearn.app` reports version `1.0.0`, version code `1`, and last update `2026-11-03 10:46:33`. This package metadata does not establish which renderer or bridge is inside the installed APK.

The parent agent reports that its `launch-app` call timed out. Its subsequent `describe` and `dumpsys` observations confirmed `MainActivity` in the foreground with the React Native redbox **Unable to load script**. Metro or bundled JavaScript is unavailable for this launch, so the Tutor Room was not reached. The user replied Ok to the wear/controllers-off-and-unpaired setup request; that is user-reported setup, not an observed physical hands acceptance pass.

The parent agent started `pnpm install --frozen-lockfile` to recover dependencies. Completion, resolved installed bridge version, usable JavaScript delivery and a successful Tutor Room launch remain to be verified. No hand ray, pinch, drag, direct-touch or controller-free full-path result is established by this follow-up. G0 remains incomplete.

## Gate disposition and next steps

G0 is incomplete until hands-only physical observations are recorded. The linked source contains hand code, so the prompt's missing-hand-code stop condition is not established. Rebuild-today feasibility, controller-free event routing and continuous direct touch are unproven. The two-hour diagnosis and direct-touch deadline gates cannot be called passed without a device run. Do not ship a direct-touch claim or silently label ray pinch as verified fallback.

Restore the repository's pinned dependencies, establish the resolved bridge and Android variant, and use an isolated native checkout for a reproducible AAR build without disturbing deleted sibling artifacts. Obtain a reachable Quest 3/3S with controllers powered off and unpaired, then record the six G0 observations against the exact APK and renderer hashes. Native work must preserve `expo-horizon-core`, orientation and current app window dimensions, keep Meta extensions optional, and retain board single-owner semantics. No feature implementation or PR merge is signed off by this audit.

## Canonical roster (verbatim)

# Review roster

Every change under the native whiteboard, native Rive and rounded-panel work is reviewed as if the people and studios below had to sign it. A seat is a bar to meet, not a person to hire.

Tier language is fixed: seats are described at creator or spec-author tier. Do not label a seat "senior" or bare "principal".

Embed this file by reference in every sub-prompt derived from `docs/adr/0001-native-whiteboard-rive-panels.md`. All four groups are mandatory.

## Engineers

| Name | Why they are here | Reviews |
| --- | --- | --- |
| Marc Rousavy, creator of Nitro Modules, Margelo (https://github.com/mrousavy) | Nitro/Nitrogen authority | Every HybridObject boundary, Nitrogen spec, thread ownership, `memorySize`, codegen order |
| Miklós Fazekas, Margelo, author of the Nitro rewrite of Rive React Native (https://margelo.com/blog/rewriting-rive-react-native-with-nitro-modules) | Rive object model on Nitro | Rive JS surface: RiveFile and view models as HybridObjects, preload, file sharing |
| Chris Dalton, Rive, contact for the ANGLE and WebGL shader pixel-local-storage extensions (https://github.com/csmartdalton) | Rive GPU renderer | Rive GL producer, PLS/interlock/atomic/MSAA mode on Adreno, GL state hygiene, render-target choice |
| Ryan Pavlik, OpenXR Working Group spec editor, Collabora (https://github.com/rpavlik) | OpenXR spec | Swapchains, quad/cylinder layers, premultiplied alpha, sRGB, layer budget, session lifecycle |
| Christian Falch, co-creator of React Native Skia (https://github.com/chrfalch), and William Candillon, React Native Skia maintainer (https://github.com/wcandillon) | Skia GPU surfaces in React Native | Whiteboard Skia GPU producer, surface/context ownership, `clipRRect` corners |
| Raph Levien, author of kurbo, Linebender (https://github.com/raphlinus) | Curve geometry | kurbo reuse, flattening tolerances |
| Joe Neeman, author of linesweeper (https://github.com/jneem) | Boolean path ops | Stroke outlines, eraser boolean semantics |
| Behdad Esfahbod, creator of HarfBuzz (https://github.com/behdad) | Text shaping | harfrust/skrifa reuse, bidi, glyph outlines |
| Yevhenii Reizner, author of tiny-skia (https://github.com/RazrFalcon) | CPU rasterization | tiny-skia stays on reference/export paths, never the live board |
| Martin Kleppmann, Automerge, University of Cambridge (https://github.com/ept) | Collaborative editing | Local, remote and AI edits on one authority; stale revisions; no divergent native state |

## Designers

| Name | Why they are here | Reviews |
| --- | --- | --- |
| Steve Ruiz, founder of tldraw, author of perfect-freehand (https://github.com/steveruizok) | Ink feel and canvas UX | Pressure response, stroke feel, tool model, drag-vs-draw arbitration |
| Mai-Linh Barry and Sergio Riquelme Sánchez, product designers at tldraw (https://tldraw.dev/company) | Whiteboard product design | Tool palette, selection affordances, empty and error states |
| Rasmus Andersson, designer of Inter (https://github.com/rsms) | Screen typography | Board text, tool labels, legibility at headset distance |
| Apple visionOS HIG and Meta Horizon OS design guidelines (platform references, not people) | Platform design | Panel ergonomics, corner treatment, angular target sizes |

## Design agencies and labs

| Studio | Bar |
| --- | --- |
| Pentagram | Tokens, type and corner language consistent across every panel |
| IDEO | Every design choice traces to a research finding |
| Ink & Switch | Ink as a first-class medium; latency and feel over feature count |

## Dev agencies

| Agency | Bar |
| --- | --- |
| Margelo | Nitro-native APIs, measured performance claims, Rive-on-Nitro precedent |
| Software Mansion | UI-thread discipline, Horizon OS (expo-horizon) correctness |
| Callstack | Measured React Native performance, CI, library packaging, user docs |

## Lanes

| Lane | Owns | Seats |
| --- | --- | --- |
| L0 Integration | Audit, ADR, ownership, shared headers/ABI, cross-repo changes, acceptance | Rousavy, Pavlik |
| L1 Rust/vector | Geometry/text/path reuse, FFI correctness, attribution | Levien, Neeman, Esfahbod, Reizner |
| L2 Whiteboard producer | Native producer, Android Surface route, context/thread ownership, GPU sync, Apple path | Falch, Candillon, Pavlik |
| L3 Rive producer | rive-runtime build, scene and compositor routes, Rive input, Nitro surface | Dalton, Fazekas, Rousavy |
| L4 Compositor and corners | Finish pass, coverage function, eviction fallback, Expo Modules 2.0 host | Pavlik, Dalton |
| L5 Editor/XR input | QuickDraw semantics, hit mapping, capture/cancel, collaboration, continuity | Ruiz, Kleppmann |
| L6 Design | Design sequence and Mobbin passes; owns the tokens L4 reads | Ruiz, Barry, Riquelme Sánchez, Andersson; Pentagram, IDEO, Ink & Switch |
| V1 Validation | Device procedures, measurements, captures | Callstack and Software Mansion skills |
| V2 Independent review | The integrated diff and real evidence, not the implementer's summary | Whole roster |

## Device validation and #112 hardening

virocore #112 changes eye-buffer size, foveation, eye-buffer alpha, external-texture decode and external-surface sampling for every app, flags or not. The device pass runs on the supported headsets, Quest 3S and PICO 4 Ultra (decided by Mike), in two rounds A/B against baseline virocore `main` at `f5c2a728`: round 1 with every feature flag off, round 2 with flags on. Each seat signs the items below from device captures and measured numbers.

| Seat | Device-pass duty |
| --- | --- |
| Pavlik | Eye-buffer size against the runtime's recommended rect and `maxImageRect` on both headsets; foveation level and dynamic mode as applied; projection-layer alpha flags with passthrough on and off; swapchain create, destroy and recreate across session state changes |
| Dalton | Rive render mode chosen on each headset; colour parity between the Rive panel and the same artboard on a phone; texture ring and fence behaviour on device |
| Rousavy | Boundaries of the render-quality setting: native and build config only, no JS runtime API, defaults unchanged until evidence |
| Falch, Candillon | Whiteboard producer on device; surface recreation after pause, resume, recenter and scene rebuild |
| Kleppmann | One authority for board state during the device pass; no divergent native state after recreation |
| Ruiz | Ink feel and stroke latency in the headset |
| Barry, Riquelme Sánchez | Tool strip and every panel state (empty, loading, error, evicted) in the headset |
| Andersson | Smallest-text legibility at 1.0x vs 1.3x eye buffers and at LOW vs MEDIUM foveation |

## Hardening lanes

S0 to S3 start together; S4 starts once Round 1 captures exist; V runs last.

| Lane | Owns | Seats |
| --- | --- | --- |
| S0 Lead | #112 PR body (per-commit behaviour, who is affected, risk, how to dial back), stack heads and baselines, this roster | Pavlik, Rousavy |
| S1 Render quality | Eye-buffer scale and foveation as a setting on #112 (Java setter on the OpenXR renderer class, AndroidManifest meta-data from an Expo config-plugin option; defaults 1.3 and LOW dynamic), its host test, the rebase of #113 | Pavlik |
| S2 CI | Shader compile job with a pinned NDK, Rive host-test job with a cached rive-runtime build, recorded results | Callstack skills |
| S3 Device | Baseline and Candidate builds, install, log and metric capture scripts, results template, analysis | Dalton, Falch, Candillon |
| S4 Design | Design and review sequence on device captures; Mobbin passes | Ruiz, Barry, Riquelme Sánchez, Andersson |
| V Review | Independent review of the diffs and the evidence, not the summaries; runs last | Whole roster |

## Standing review rules

1. A seat reviews before the change lands. Work that skipped its seat is reverted, not patched.
2. An objection is recorded in the PR with the rule or spec clause it cites.
3. Evidence applies to reviewers too: cite the installed file and symbol, the measured number, or the spec section. No seat approves on assertion.
4. Native graphics code is reviewed by a lane that did not write it.
5. A passing typecheck, a non-null handle or a rising frame counter is not evidence of correct rendering. Device captures are.

## Non-negotiables every seat enforces

- No placeholders, stubs, mock adapters or invented APIs on the working path. Every seam cites an installed file and symbol.
- Zustand for state; no `useState` or `useReducer` in new or touched components. React 19 `useOptimistic` and `useActionState` are allowed.
- C++ exposed to React Native is a Nitro HybridObject. The one recorded exception is the compositor panel host, which uses Expo Modules 2.0 (PR #58).
- `tsc --noEmit` passes. Nitrogen output is committed, and codegen lands before native implementations.
- No WebView, DOM canvas capture, screenshots, base64 frames, GPU readback or per-frame JS uploads on any live panel path.
- Comments state intent, not history.
