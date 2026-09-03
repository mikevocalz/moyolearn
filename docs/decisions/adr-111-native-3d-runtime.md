# ADR-111 — A native 3D runtime for Natalie, behind a flag, with a hard cutoff

Status: **ACCEPTED (the work). The switch is governed by the gate in §Go/no-go.**
Date: 2026-09-03 · Decider: Mike, product owner · Author: tutor-stage pass

<!--
What it is: the decision record for putting a real WebGPU/three renderer on the
phone, the rules the mount site has to obey, and the time-boxed gate that
decides whether the flag is flipped for the Sep 3 demo.
Why it exists: this is the first time the product ships a renderer in front of a
child, on demo day, on one device. The interesting content is not "use WebGPU" —
it is the two rules that keep the 2D demo path intact while the 3D path is being
built beside it.
SOT: audit/realtime/ADR-avatar-identity.md · docs/pack/22-embodied-tutor-avatar-spec.md §3 §4 §6 §9
     packages/avatar/src/tutor-stage.ts · packages/avatar/src/tiers.ts · packages/avatar/src/assets.ts
SOT-KEYWORDS: adr native 3d webgpu three tsl natalie flag go no-go cutoff mount site dispose
-->

## Decision

1. **`audit/realtime/ADR-avatar-identity.md` is ACCEPTED**, with its scope widened
   from `apps/web` to native. Its §Decision (one identity, one continuous mark,
   fidelity never named to the child) and all six preconditions carry over
   unchanged and are not restated here.
2. **The runtime is `react-native-webgpu@0.9.0`** — the latest published version,
   pinned exactly in `apps/mobile/package.json`, installed 2026-09-03. `three` is
   added to `apps/mobile` at the catalog's `0.185.1` so the phone bundle resolves
   the SAME copy `packages/avatar` already imports (`three/webgpu`, `three/tsl`).
   Nothing is vendored: `~/Downloads/react-native-webgpu` exists but is empty.
   The workspace is above every one of the module's minimums (RN 0.86.2,
   Expo 57.0.15, worklets 0.10.1, reanimated 4.5.1).
3. **The 3D path ships behind a flag whose committed default is OFF.** The 2D
   presence is not a fallback in the sense of "what you get when 3D fails" — it
   is what runs, and 3D is an additive upgrade to it. `tutor-stage.ts` was
   written for exactly this and is unchanged: 2D from frame 1; promote only on a
   real first rendered frame with the head evaluated; never mid-utterance;
   demotion immediate, unconditional and permanent for the session; a download
   failure is "2D, and we stopped trying", never an `error` kind at a child.
4. **One mount site for her body, and `react-freeze` is what enforces it.**
   See §The mount-site rule.

## The mount-site rule

Precondition 3 of the identity ADR — *a single mount site at every width* — went
from prospective to load-bearing the moment the tutor session became a
three-pane composition (ADR-107 Amendment 2). Three things hold it up, and they
do different jobs. Deleting any one of them because "another covers it" is how
this breaks.

| Mechanism | What it does | What it does NOT do |
|---|---|---|
| `<Freeze freeze={!visible}>` around every pane (`AdaptivePanes`' `PaneContent`) | Keeps the subtree **mounted** while hidden. The renderer, the resident model and the animation state survive a collapse; re-expanding resumes them with no reload and no flash. | It suspends React **renders only**. It does not stop imperative work — measured on this repo, a frozen face bus went on sampling the audio clock ~130×/s. |
| The loop stops itself on the same visibility flag — `renderer.setAnimationLoop(null)`, `cancelAnimationFrame`, the face bus off (`TutorAvatar` already does this for 2D) | Stops the GPU and CPU drain. This is the battery fix. | It does not preserve the mount. On its own you would still be tempted to unmount, which is the thing that must not happen. |
| `disposeWebGPURenderer` on genuine **unmount** — leaving the session | Releases the renderer graph. Must be the example's exact form (`setAnimationLoop(null)` + `dispose()` + clearing the `QuadMesh` listeners — upstream issue #445, without which the graph leaks for the process lifetime). | It must **never** run on a pane toggle. If it does, the Freeze is in the wrong place. |

**Never conditionally render her pane.** `{visible ? <Natalie/> : null}` unmounts
her, tears down the renderer and the glTF scene graph, and makes a pane toggle or
a breakpoint crossing rebuild all of it. Always mounted, always wrapped, toggle
the `freeze` prop.

**One crossing is NOT preserved, and that is recorded rather than hidden.**
`TutorStage` renders a different subtree below 600dp, so `compact` ↔ pane crossing
remounts her. On the Duo that crossing is folding/unfolding the device, which
Android may service by recreating the activity anyway. It is therefore a
**demote-to-2D** transition, which `tutor-stage.ts` already models
(`settle('context-lost')`), not something to fight with a portal tonight.

## Go/no-go gate

**Doors time is not known to me at the time of writing and must be filled in by
Mike.** The rule, not the number, is the decision:

> **Hard cutoff = doors − 3h. Nothing merges to the demo build after the cutoff.**

Working assumption used to plan the night, to be corrected if wrong:

| | Time (EDT, 2026-09-03) |
|---|---|
| Step 0 started (install + native deps) | **01:20** — done, `react-native-webgpu@0.9.0` + `three@0.185.1` in `apps/mobile` |
| Assumed doors | **09:00** |
| **Hard cutoff** | **06:00** |

**The gate itself:**

- If a build containing `react-native-webgpu` is **not installed and launching on
  the demo phone by the cutoff**, the 3D flag stays OFF, the 2D demo runs, and
  no apology is owed for it.
- The flag flips **only** after the full smoke in
  `qa/walkthroughs/NATIVE-3D-SMOKE-2026-09-03.md` passes **three times** on the
  phone, on the hotspot. Any single failure → flag stays off, branch kept.
- **Stop and report, do not push past:** the docs' triangle or the example
  `Cube.tsx` does not render on the phone · the split glTF loads but morph names
  or the skin are missing · a Dawn shader-compile failure on a material
  extension that cannot be cleanly stripped · the phone tier cannot hold the
  frame budget with the conversation running · the native build is not on the
  device by the cutoff · any change would require touching the coach prompt,
  model routing, the Safety Plane, or voice egress.

## The asset

`packages/avatar/assets/humano-marketing.glb` is 12.5 MB, no Draco, 1 mesh / 2
primitives, 1 skin, 472 nodes, 52 ARKit morph targets, 8 images embedded as WebP.

**Embedded images cannot load in React Native.** Hermes has no
`new Blob([ArrayBuffer])`, which is how `GLTFLoader` hands an embedded texture to
the decoder; it fails **on device only**, which is the worst possible failure
mode. Both `packages/avatar/src/assets.ts` (the ".glb RULE") and the module's own
`Retargeting.tsx` example say so.

Conversion, from the **source** glb (JPEG/PNG, not WebP — WebP on three's
`ImageLoader` path is unverified on native and today is not the day to gamble):

```
gltf-transform resize humano-marketing-source.glb tmp.glb --width 1024 --height 1024
gltf-transform dedup tmp.glb tmp.glb
gltf-transform prune tmp.glb tmp.glb
gltf-transform copy tmp.glb natalie-phone/natalie.gltf   # .gltf externalises .bin + images
```

Then **assert on the output, do not eyeball it** — `assets.ts`'s
`assertLoadableInReactNative` is the check, extended if it misses `extras`:
every `images[].uri` external, zero `bufferView` images, no
`KHR_draco_mesh_compression`, 52 targets and 1 skin still present,
`extras.targetNames` intact. If a material extension fails under Dawn, strip
**that** extension only and note it here; never re-export from Blender today.

**Loading.** Dev may use `require` + `Image.resolveAssetSource(mod).uri`. The
**demo build must not**: release asset flattening breaks relative `.bin`/image
resolution. The demo path is `packages/avatar/src/assets.ts` — manifest, injected
downloader, sha-256 verify, cache (doc 20, doc 22 §4 row 17) — against
`natalie-phone/` on Bunny, handing `GLTFLoader` the downloaded **directory** URI.
Pre-download on the phone so first launch never fetches.

## Consequences

- Easier: the identity ADR stops being a blocker, and the 2D path keeps its
  status as a designed terminal state rather than a failure mode.
- Harder: the workspace now carries a native GPU dependency that requires a
  prebuild. Any JS-only reload of a binary that predates it must not reach
  `react-native-webgpu` — the import is lazy and behind the flag for that reason.
- Follow-ups: golden images per shipping tier including reduced motion (doc 22
  §8); the gesture gate wired to the live track; the `compact` ↔ pane crossing
  either portalled or formally accepted as a demote.
