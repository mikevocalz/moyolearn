# XR workspace implementation and verification

## Result

Fixed the active Viro scene's live board material path and ink-row click target.
The native texture host could bind successfully while the scene continued drawing
only the raster image; raster refreshes were disabled on successful binding. The
panel now samples the bound material directly. Input is enabled only with engine
readiness, live binding, and successful calibration. An unbound raster is a recovery
preview, with an explicit unavailable state and a route back to the lesson.

The same Quickdraw editor, BoardSession document, tutor store, and audioQueue remain
owners of the lesson. No independent drawing engine, AI connection, or playback
owner was added. Engine-ready events now trigger a fresh snapshot attachment even
when a WebView reports readiness again after a reload; selected tool/ink are restored.

## Changes

- **Board and panels:** 5:7 writable viewport (1000 × 1400); separate header and
  rounded outer frame; real rounded geometry and matching rounded button hit meshes.
  Dark Moyo header replaces the vendored red. Disabled panel entrance/hover movement
  and independent panel dragging for this workspace. Recenter moves the shared frame.
- **Tools:** one labeled key primitive for pen, highlighter, eraser, ink, undo, clear,
  voice, recenter, and exit. Ink has an actual hit target; choosing ink leaves eraser
  mode. Age-band minimum targets size both rows and scrolling arrows. Clear requires
  a second press within five seconds, with a Keep my work action. Removed the XR
  document-level redo button rather than mixing its history with editor undo.
- **Controller:** one owning source per stroke; finite and in-bounds starts; no border
  clamping; leaving paper commits the last valid segment and requires a new press.
  Global release and disconnect/error events close the owning stroke. Placement,
  readiness changes, and unmount cancel in-flight input. The Viro FixedToPlane drag
  adapter retains the original ray-to-node offset.
- **Native binding:** bounded retries while the Viro view/material registry starts;
  no successful bind without a child; reattachment and disposal on host lifecycle.
- **Voice:** synchronous start gate, explicit starting/transcribing states, stale
  permission/transcription invalidation, recording cleanup, and caught device/export
  errors. The existing safe tutoring flow receives the utterance and current board.
- **Natalie:** model loading/failure state and reload action; lip performance no longer
  waits on the disabled skeleton bridge. The actual GLB has **six** facial targets,
  not the 52 its previous comment claimed. The adapter now sends only those channels,
  closes the mouth when playback stops, and retains the existing audio clock.

Main files:

- `packages/app/features/tutor/tutor-xr-screen.native.tsx`
- `packages/app/features/tutor/xr-voice.native.ts`
- `packages/app/features/tutor/XrNatalie.native.tsx`
- `packages/app/features/tutor/natalie-viro-targets.ts`
- `packages/ui/xr/XrTriPanel.native.tsx`
- `packages/ui/xr/premium/PremiumXRMediaPanel.tsx`
- `packages/ui/xr/XrPlate.native.tsx`, `XrRoundedQuad.native.tsx`, `rounded-panel.ts`
- `packages/ui/xr/XrBoardSurface.native.tsx`, `board-pointer.ts`
- `apps/mobile/modules/board-texture/android/src/main/java/com/moyolearn/boardtexture/BoardTextureHostView.kt`

## Design research

[PMNDRS UIKit](https://pmndrs.github.io/uikit/docs/getting-started/components-and-properties)
provides useful panel/state/interaction patterns. This app's immersive renderer is
native Viro, so installing a second Three.js UI renderer would not solve the live
WebView bridge. The implementation uses supported Viro geometry and event APIs.
[React Three XR interactions](https://pmndrs.github.io/xr/docs/tutorials/interactions)
informed deliberate pointer ownership and separation of controls from handwriting.
[Apple ornaments](https://developer.apple.com/design/human-interface-guidelines/ornaments)
informed controls outside the paper; [Apple layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout)
informed hierarchy and consistent spacing. These are design references, not evidence
of visionOS support. Skills used: XR, Three.js routing and procedural geometry,
Argent device/React Native workflow, and Kotlin guidance.

## Verification

All pnpm checks used `/opt/homebrew/opt/node@24/bin` on PATH.

| Check | Result |
| --- | --- |
| `pnpm --filter @acme/ui test` | 217 passed, including new controller ownership and rounded-mesh tests |
| `pnpm --filter @acme/app test` | 538 normal + 104 server tests passed; includes actual GLB target/image validation |
| `pnpm exec turbo typecheck --force` | 19 workspace tasks passed, cache bypassed |
| Targeted ESLint on changed XR components/adapters | Passed |
| `./gradlew :board-texture:compileDebugKotlin --console=plain` (Java 17) | Passed |
| `pnpm --filter mobile exec expo export --platform android --output-dir /tmp/moyo-xr-android-export` | Passed; Hermes bundle and `natalie-viro.glb` included |
| `git diff --check` | Passed |

The first Kotlin command used a nonexistent `:moyo-board-texture` project; corrected
to the actual `:board-texture` Gradle project and compilation passed. Existing Gradle
deprecation warnings remain. Export output is a local artifact, not a deployment.

## Hardware acceptance remains unverified

Argent listed no connected Android/XR device or emulator. No headset was launched,
no stereo screenshots or runtime recording were captured, and no measured frame
times, drawing latency, microphone response, or audible reply are claimed.

The native software/hardware texture composition, UV orientation, actual button hit
behavior, controller release routing, first-frame visibility, system-menu recovery,
and lip motion must still be exercised on the target PICO/Quest build. The existing
body-animation flag remains off; Natalie uses the existing rest pose plus facial
performance. Only the six morph targets shipped in this native asset are driven.
No new Vision Pro, Android XR, or browser XR support is claimed.

On a connected headset, validate: resume a marked lesson; corners/centre and a
continuous handwritten expression; pen/highlighter/eraser/colors; release outside
paper and second-controller input; undo and confirmed clear; recenter mid-stroke;
Ask Natalie with current work; audio/captions/lips; exit/reenter and reload; and
both-eye rendering at seated and standing positions. Full APK installation and
hardware acceptance are outstanding, rather than inferred from a bundle export.
