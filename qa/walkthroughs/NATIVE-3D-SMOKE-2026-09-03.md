# Native 3D smoke — go/no-go gate (2026-09-03, demo day)

SOT-KEYWORDS: native-3d, webgpu, go-no-go, demo-day, surface-duo, natalie, smoke-test

## Why this file exists
The native WebGPU avatar lands on demo day. A demo-day change needs a written
abort rule made BEFORE the work starts, not a judgement call made at 05:50 with
a half-built APK on the bench. This is that rule. Times are recorded, not
recalled.

## The clock
| Mark | Time (EDT) | Source |
|---|---|---|
| Work started | 2026-09-03 01:59 | `date` at agent start |
| Doors | 09:00 (ASSUMED — awaiting confirmation) | assumption, tight-window default |
| **HARD CUTOFF (doors − 3h)** | **06:00** | doors − 3h |

If doors move, the cutoff moves with them and this table is amended in place.

## The gate
At the cutoff, exactly one of two things is true.

**GO** — a build containing `react-native-webgpu` is installed AND launching on
the Surface Duo (serial `913949703467`, `com.moyolearn.app`), and the native
smoke below passed. The flag ships **OFF by default in the committed store**;
GO means it *can* be turned on, not that it is on.

**NO-GO** — anything else. The flag stays OFF, the 2D demo runs unchanged, and
the outcome is reported rather than rushed. NO-GO is not a failure state; it is
the designed-for state.

## Hard stop conditions (report, do not push through)
1. The docs' triangle or the example cube will not render on the Duo.
2. Split glTF loads but morph targets or the skin are missing.
3. A Dawn shader-compile failure that cannot be cleanly resolved by stripping a
   single material extension.
4. The phone tier cannot hold the frame budget with a conversation running.
5. No native build on the device by the cutoff.
6. Anything that would require touching the coach prompt, model routing, the
   Safety Plane, or voice egress.

## The 2D path is not on the table
`packages/avatar/src/tutor-stage.ts` already encodes the promotion rules: the 2D
mark is up from frame 1, promotion happens only on a real first rendered frame,
demotion is immediate and permanent, and a download failure is not an error.
Native 3D is an additive consumer of those rules. No edit in this workstream may
change the 2D path's behaviour when the flag is off.

## Log
(appended as the work runs)

- 01:59 — gate written. Cutoff 06:00 EDT on assumed 09:00 doors.

## Step 3 — the real body on the native stage (built, NOT yet run on a device)

What landed after the cube passed:

| Piece | Where |
|---|---|
| The phone body | `packages/avatar/assets/natalie-phone/` — `humano-marketing-source.glb` at 1024px, deduped, pruned, copied out to `.gltf` + `.bin` + 8 external images (13.9 MB). Embedded images cannot decode in Hermes, hence the split. |
| The asset gate | `pnpm --filter @acme/avatar verify:native-gltf` — external images, sibling `.bin`, no Draco, 1 skin, 52 named morphs, and all 14 Rigify bones the presence writer poses. **PASSES.** |
| The per-frame writer | `packages/avatar/src/presence/humano.ts` (+ 9 tests). Idle, gaze-at-camera, breath, neck/head drift, jaw, co-speech beats, mouth from one openness scalar. No renderer, no audio clock, no DOM — which is why it is tested in Node. |
| The stage | `packages/app/features/tutor/tutor-avatar-3d.native.tsx`. Same three rules the cube proved: awaited `init()`, `present()` every frame, dispose on genuine unmount only. Adds the loop's own `active` gate — a freeze does not stop a render loop. |
| The mount | `packages/app/features/tutor/tutor-avatar.tsx`. Flag `EXPO_PUBLIC_NATIVE_3D=1`, default OFF. The flag only chooses the TIER (`phone` vs `presence-2d`); `createTutorStage` still owns 2D-first, swap-on-first-real-frame, never-mid-utterance, and settle-to-2D-forever on any failure. |
| The evidence route | `moyo://natalie-3d` — the stage alone, deep-linked, with a Speak toggle driving a synthetic mouth. Deliberately not the session, so a black frame is attributable. |

**Still unverified, and it is the whole of the remaining gate:** no frame has been
rendered on hardware. Typecheck, lint and 249/250 package tests are green (the
one failure is the pre-existing lash-bake sha, untouched by this work), but that
proves the code composes, not that Dawn compiles these materials. The go/no-go
above is unchanged: the flag ships OFF, and it flips only after the ladder —
adapter → triangle → cube → `moyo://natalie-3d` → a tutor session — passes three
times on the phone.

**Two things to expect on first light**, recorded now so they are not diagnosed
from scratch: the `KHR_materials_anisotropy` / `KHR_materials_specular` /
`KHR_materials_ior` extensions on this body are unproven under Dawn (the ADR's
"strip that extension only" rule applies), and the rig here is the web scene's
simple light rig, NOT `createStage()` — moving to the RectAreaLight + GTAO +
bloom stage is a look change with its own golden capture, not a first-light task.

## Step 3 RUN — 2026-09-03 11:39 EDT, Surface Duo 913949703467

**She renders.** Textured, skinned, framed waist-up, breathing, gaze on the lens,
mouth driven by the route's synthetic oscillator. `first frame presented`.

Three device-only failures stood between the build and that frame. None of them
were visible anywhere but on hardware, and each is now fixed in
`tutor-avatar-3d.native.tsx` with the measurement in a comment:

| # | Symptom on device | Cause | Fix |
|---|---|---|---|
| 1 | `ReferenceError: Property 'ProgressEvent' doesn't exist` | three's `FileLoader` constructs `new ProgressEvent(...)` per chunk, unguarded. Hermes has no such global. | A four-field class installed at module scope. |
| 2 | `glTF load failed: JSON Parse error: Unexpected character: o` | `FileLoader` re-wraps the stream in `new Response(stream, …)`. RN's whatwg-fetch `Response` has no stream body, so `.arrayBuffer()` returns the 23 bytes of `"[object ReadableStream]"`. Plain `fetch(...).arrayBuffer()` on the same URL returns all 218,678. | Fetch the `.gltf` and `.bin` ourselves and seed `THREE.Cache` under `file:${url}`; three then never requests them. Textures are unaffected — `createImageBitmap` exists, so images go through `ImageBitmapLoader`'s plain fetch. |
| 3 | `Exception in HostFunction: <unknown>` on every `renderer.render()`, black surface | The body's `KHR_materials_specular` / `_anisotropy` / `_ior` make `GLTFLoader` build a `MeshPhysicalMaterial`, and Dawn throws on three's node graph for it. Bisect: `MeshNormalMaterial` → renders; colour map only → renders; colour + normal + roughness → renders. | `simplifyMaterialsForDawn()` rebuilds each skinned material as `MeshStandardMaterial` with the authored colour/normal/roughness maps and the MASK `alphaTest`. ADR-111's "strip that extension only", applied at load so the web scene keeps the authored asset. |

A throwing frame now stops the loop and demotes once, instead of reporting 60
identical errors a second behind a black view.

**Known and accepted for now:** specular tint, anisotropic hair sheen and IOR are
gone with the extensions, so the hair reads flatter than on web. The answer is
`@acme/avatar/body`'s own TSL hair/skin materials (doc 22 §4 rows 1-5), not
putting the extensions back. Also seen on hot reload:
`CreateAndroidSurfaceKHR failed with VK_ERROR_NATIVE_WINDOW_IN_USE_KHR` — two
live surfaces during a JS reload, the condition ADR-111's one-surface rule
already forbids. A cold start is clean.

**Not yet run:** the three consecutive passes the gate requires, and the stage
inside a real tutor session (blocked on the voice/coach finding below).

## Voice — measured the same session, and it is NOT the avatar

`/api/tutor/voice` is never called, because no sentence is ever emitted. The
coach turn fails upstream, on the server, before voice is reached:

```
curl -X POST localhost:3000/api/tutor/coach -d '{"problem":"…","answer":"…","history":[]}'
→ data: {"kind":"unavailable"}
```

`coach.service.ts`'s `unavailable` branch is, in its own words, "no API key,
vendor outage, a dropped socket" — the model, not a safety layer. The app maps
it to `retry`, which is exactly the badge on the device. Everything downstream
of it is healthy and was verified: `libreact-native-audio-api.so` is in the
installed binary, the phone reaches the Next app over `adb reverse tcp:3000`,
and `/api/tutor/voice` answers `403 utterance is not server-emitted` to a forged
tag — the route is alive and its tag gate works.

## First light on the Duo — the ladder, and what the frame showed

Ladder passed on serial `913949703467`: adapter (`qualcomm adreno-6xx`, Vulkan,
not a fallback) → triangle (`submitted and presented at 2700x957`) → cube
(`renderer.init() resolved`) → `moyo://natalie-3d` → a live tutor session.

Five defects were visible only once a frame existed. All five are fixed and
re-verified on the phone.

| Reported | Cause | Fix |
|---|---|---|
| No full body | Stage inherited the web scene's hero camera — her face at 1.15m, cropped at the collarbone. The asset has all 470 joints down to the toes. | `frameBody()` in `presence/framing.ts` |
| Squashed when a pane opens/closes | The drawing buffer does not follow the view. `SurfaceInfo::resize` updates the native view only — "does not resize the drawing buffer: that tracks canvas.width/height". | Refit from `onLayout`. `canvas.clientWidth` was tried first and never moved through a toggle. |
| Size changed with pane width | A contain fit is aspect-dependent. It also budgeted for the BIND pose's A-pose arm span (x ±0.52) that is not on screen. | Fit the height only — the pane's height is what does not move. |
| A thumbnail in a full-height pane | `STAGE_HEIGHT` drew a fixed 260dp band at the top of the column. | `flex: 1` + `minHeight`, and `TutorPresence fill` |
| Behind a "Show Natalie" button | `auto` demoted `visible` → `compact` at pane width. | Demote on a phone only |
| Arms swallowed by the shirt | The mesh is BOUND in an A-pose (`DEF-hand.L` x 0.516) but the scene ships her arms flat to the thighs (x 0.158, thigh 0.102). Linear blend skinning drags the sleeve down until the silhouette closes over the forearms. | `STANCE` in `presence/humano.ts` — a standing pose applied speaking or not, a few degrees back towards bind |

`side: FrontSide` was tried for the shirt and changed nothing; the authored
`doubleSided` stands.

**Voice works, and it never was the avatar or the audio stack.** The original
`{"kind":"unavailable"}` was the model provider; `/api/tutor/coach` streams
normally now. On the phone, a real turn reaches `Speaking` and `dumpsys audio`
shows the app (pid 16918) holding an **AAudio stream in `state:started`** on the
speaker, `STREAM_MUSIC` 25/25, unmuted.

Note for anyone testing from `moyo://natalie-3d`: that route has no audio by
design — its mouth is a synthetic oscillator, because it exists to isolate the
renderer.

**Unrelated, found while running the gate:** `check-barrels.mjs` followed only
static relative edges, so `tutor-avatar-3d` was reported orphaned and lint was
red on main. `import('./x')` is now an edge.

**Still open:** the three consecutive gate passes. And the pose above treats the
symptom — the real fix is an asset one, applying the shipped pose as the rest
pose in Blender so the shirt is authored around the body it is worn on.
