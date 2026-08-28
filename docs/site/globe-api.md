# The globe's imperative API

<!--
The seam between the globe chapter's engine and the motion agent's scroll
choreography. This file is the contract: everything the globe exposes and
nothing it does not.
SOT: apps/web-vite/src/globe/api.ts · apps/web-vite/src/globe/globe-store.ts
     docs/site/adr-002-globe-geometry.md
SOT-KEYWORDS: globe api seam motion agent setPhase focusRegion rotateBy scroll
              choreography handoff chapter 04
-->

Status: implemented · Date: 2026-08-28 · Owner of this seam: the globe chapter ·
Consumer: the motion agent

```ts
import { globeApi } from '@/globe/api';
```

That import is the whole surface. Nothing outside `src/globe/` should reach for
`useGlobeStore`, the scene, or a ref to the canvas — if a timeline needs
something this file does not offer, the right move is to add a function here,
not to reach past it.

---

## What this seam is for

The globe chapter owns geometry, materials, tiers, node cards and
accessibility. The motion agent owns the **pinned scroll choreography** — the
0–20 / 20–45 / 45–65 / 65–85 / 85–100 phases, the Lenis + ScrollTrigger
timeline, and the hand-off that floods cobalt into chapter 05. None of that is
built here, deliberately.

The split works because of one property: **the globe is already complete before
any timeline touches it.** With no motion agent at all, `phase` is 1, every node
is visible, the globe idles at its rest composition, and every fact in the
chapter is readable. A timeline makes that arrival *choreographed*; it is never
what makes it *possible*.

---

## The five functions

### `setPhase(t: number): void`

Chapter progress, 0–1. Clamped.

Drives exactly two things:

| What | Range | Detail |
| --- | --- | --- |
| Node reveal | `phase` 0.15 → 0.75 | Cards appear evenly across the window. A timeline that pipes scroll progress straight in gets a staggered reveal without knowing how many nodes exist. |
| Globe entrance scale | `phase` 0 → 0.3 | 0.9 → 1.0. |

Nothing else. Everything past that is the caller's.

**No-op under reduced motion**, where `phase` is pinned at 1.

**Safe at 60 Hz.** It is a `useGlobeStore.getState()` write; the scene samples it
inside `useFrame` and the DOM node layer inside its own coalesced rAF, so
calling it every frame renders **zero** React. Call it from a ticker callback, a
`gsap.to` `onUpdate`, or a ScrollTrigger `onUpdate` without a `requestAnimationFrame`
wrapper of your own.

### `focusRegion(id: GlobeRegionId | null): void`

Brings a continent's centroid to the centre of the disc over roughly a third of
a second, and marks it focused (which lifts its slab 1.2%, rather than tinting
it — a region's colour is a public promise, see `docs/site/tokens.md`).

`null` clears the highlight without moving the globe.

`GlobeRegionId` is generated from the geometry pipeline:

```
'africa' | 'americas' | 'south-america' | 'canada'
        | 'europe' | 'asia' | 'oceania' | 'antarctica'
```

Takes the **short way round** — focusing Asia from the Americas travels 160°,
not 200°. Without that a timeline focusing regions in sequence accumulates whole
turns.

Turns **auto-rotate off**, permanently. Resuming a drift the instant a focus
lands drags the thing the reader just asked to look at back off centre, which
reads as the interaction having failed. Call `setAutoRotate(true)` if you want
it back.

### `focusNode(id: GlobeNodeId | null): void`

`'name' | 'language' | 'bands' | 'us'`. Brings the node's anchor to the centre,
marks the card active (a deeper offset shadow) and focuses its region. This is
what the node cards' own buttons call — it is the click/tap parity for the drag
gesture, so if a timeline drives it, it is driving the same path a reader does.

### `rotateBy(deltaYaw: number, deltaTilt: number): void`

Relative, in **radians**. The one relative call in the API, because a drag delta
is relative. Tilt is clamped to ±55° so the globe can never roll past its poles.

Cancels any focus tween in flight, so a pointer always wins over an animation.

`KEYBOARD_ROTATE_STEP` (6°, exported from the same module) is the increment the
arrow keys use; reuse it for any control that should feel the same.

### `setAutoRotate(on: boolean): void`

The idle drift, 0.045 rad/s. Turn it **off** while a timeline owns the rotation
— the two will fight otherwise, and the fight looks like a bug in yours.

### `reset(): void`

Back to the rest composition: centre longitude −25°, tilt 8°, phase 1, no focus,
auto-rotate on.

Deliberately preserves whether a renderer is mounted and which geometry is
loaded — a scroll-position reset must not tear down the WebGL context.

### `getState(): GlobeSnapshot`

```ts
{ yaw, tilt, phase, focusedRegion, activeNode }
```

A read-only snapshot for a timeline that needs to know where it is starting.
**Do not poll it in a React render** — see the next section.

---

## Four rules

**1. Never read `yaw`, `tilt` or `phase` through a React selector.**

They change every frame. `useGlobeStore((s) => s.yaw)` re-renders the component
sixty times a second. Read them with `getState()` from inside your own frame
callback. If you need to *react* to progress, subscribe to a derived,
low-cardinality value — `revealedNodeCount` changes four times across the whole
chapter, not sixty times a second.

**2. Reduced motion is already handled. Do not re-check it.**

`setPhase` is a no-op, `focusRegion` snaps instead of tweening, and the idle
drift never starts. That is enforced in `globe-store.ts` against the single
`usePerfStore.reducedMotion` flag, not by convention at each call site. If a
timeline also gates itself, that is fine and redundant; if it *bypasses* this by
writing the store directly, it has reintroduced the bug this design removes.

**3. Calls before mount are legal.**

Every function is a store write. A call made before the island mounts — or on a
device that never mounts one, because it is on Tier C — lands in the store and
is simply the state the island reads when it appears. Nothing throws, nothing
needs a ref, and there is no "ready" event to wait for.

**4. Tier C cannot turn.**

Its globe is a build-time print baked at the rest rotation. `focusRegion` and
`focusNode` still move the highlight and the active card, but the globe does not
rotate: `focusLongitude` refuses when no frame driver is mounted, rather than
leaving a tween that nothing advances. `rotateBy` is likewise inert.

Design timelines so that **rotation is expression, never information.** If a
fact is only reachable by turning the globe, a Tier C reader cannot reach it —
which is why every claim in this chapter is card text that is always in the DOM.

---

## A worked example

```ts
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { globeApi } from '@/globe/api';

ScrollTrigger.create({
  trigger: '#chapter-04',
  start: 'top top',
  end: '+=400%',
  pin: true,
  scrub: true,
  onEnter: () => globeApi.setAutoRotate(false),
  onLeaveBack: () => globeApi.reset(),
  onUpdate: (self) => {
    globeApi.setPhase(self.progress);
    if (self.progress > 0.45 && self.progress < 0.65) globeApi.focusRegion('africa');
  },
});
```

`onUpdate` fires per frame under `scrub`. That is exactly what `setPhase` is
built for; no throttling is needed and none should be added.

---

## What the globe does NOT expose, and why

| Not exposed | Why |
| --- | --- |
| The camera, the scene, the `WebGLRenderer` | They exist only on Tier A and B. Anything reaching for them is a code path that dies on the tier most readers are on. |
| A `setZoom` | The globe's size is a function of its stage, and the stage is layout. Scale the container. |
| Per-region colour | The fill is a `packages/theme` token resolved from live CSS. A timeline that recolours a continent breaks the contrast ratios `docs/site/tokens.md` publishes, and the "Africa is `moyoSun`" promise the site makes in public. |
| Node visibility, individually | It is a function of `phase`, so that a timeline cannot get the reveal out of step with the progress it is also driving. |
| A "ready" promise or a mount callback | Rule 3: calls before mount are legal, so there is nothing to wait for. Waiting would also mean Tier C never fires the callback. |

---

## Where the boundary sits

| Owned by the globe chapter | Owned by the motion agent |
| --- | --- |
| Geometry pipeline, LODs, materials, the outline technique | The pinned scroll timeline and its phases |
| Tier detection, the frame probe, the three tiers | Lenis + ScrollTrigger wiring |
| Node cards, leader lines, the accessible list, the alt text | The cobalt hand-off into chapter 05 |
| Drag, arrow keys, click/tap parity | Entrance/exit choreography of the section around the globe |
| `phase` → node reveal and entrance scale | What `phase` is at any moment |
