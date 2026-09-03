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
