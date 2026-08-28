# Motion matrix — the marketing site's animation system

<!--
The motion foundation's handoff. Written to the `design-handoff` skill's format
(token map → tokens missing → components → motion table → accessibility), with
the per-screen sections replaced by per-PRIMITIVE ones: this is the system every
chapter animates with, not one screen.

The reduced-motion column is the point of the document. It is a contract, not a
courtesy: §3 records how it is enforced structurally so a chapter cannot opt out
of it by forgetting.

SOT: apps/web-vite/src/motion/primitives.ts · packages/theme/tokens.ts (siteMotion)
     docs/site/component-inventory.md
SOT-KEYWORDS: site motion matrix reduced-motion gsap scrolltrigger splittext
              lenis primitives thunk peel draw snap compress page-turn pulse
              parallax accessibility budget web-vite
-->

Status: **built and verified** · Date: 2026-08-28 · Owner: motion foundation

---

## 1. The system

**One animation system: GSAP.** GSAP 3.15.0 core + ScrollTrigger + SplitText,
with Lenis 1.3.26 driving GSAP's ticker. R3F/three is the globe island and
nothing else. There is no Framer Motion and no motion.dev on this site; the
kit's `@legendapp/motion` presets (`FadeIn`, `ScaleIn`, `SlideUp`) are the
PRODUCT's motion layer and are not used on marketing surfaces. Micro-inter-
actions that do not need a timeline use CSS transitions over `--moyo-duration-*`.

| Concern | Where it lives |
| --- | --- |
| Plugin registration | `apps/web-vite/src/motion/register.ts` |
| Scroll runtime (Lenis → ScrollTrigger ticker) | `apps/web-vite/src/motion/runtime.ts` |
| Mount point | `apps/web-vite/src/motion/MotionRuntime.tsx`, rendered in `src/routes/__root.tsx` |
| The vocabulary | `apps/web-vite/src/motion/primitives.ts` |
| A chapter's entry point | `apps/web-vite/src/motion/use-motion-scene.ts` |
| Reduced-motion source of truth | `usePerfStore` — `apps/web-vite/src/stores/perf-store.ts` (see §3) |
| Values | `packages/theme/tokens.ts` → `siteMotion` |
| Unit adapter (ms → s, deg → number) | `apps/web-vite/src/motion/tokens.ts` |
| Audit surface | `/motion-lab` (noindex, not in the sitemap) |

### SplitText — verified on disk

The "free since the Webflow acquisition" claim is **true for this install**, and
it was checked against `node_modules`, not against the pricing page:

```
node_modules/gsap/SplitText.js          17 263 bytes, header "SplitText 3.15.0"
node_modules/gsap/types/split-text.d.ts full Vars type (type, mask, aria, autoSplit…)
node_modules/gsap/package.json          "exports": { "./*": … } — resolves gsap/SplitText
```

The other former Club plugins are present too (`ScrollTrigger.js`,
`DrawSVGPlugin.js`, `InertiaPlugin.js`, `Draggable.js`, `CustomEase.js`). No
fallback was needed. Note the license header on each is *"Subject to the terms
at https://gsap.com/standard-license"* — free to use, not public domain.

`draw` still does **not** use DrawSVGPlugin. The spec names
`stroke-dashoffset` as the mechanism, core CSSPlugin does it, and one fewer
plugin is ~4 kB the motion chunk does not carry.

---

## 2. Token map

Everything below resolves through `siteMotion` in `packages/theme/tokens.ts`.
No duration, ease, distance, rotation or overshoot is written at a call site.

| Role | Token | Value | Notes |
| --- | --- | --- | --- |
| Card entrance | `siteMotion.duration.thunk` | 300ms | Decisive; inside the 300–500ms law |
| Hard landing | `siteMotion.duration.settle` | 110ms | The stop after an overshoot |
| Workbook cover | `siteMotion.duration.open` | 460ms | |
| Sticker | `siteMotion.duration.peel` | 380ms | |
| Pencil stroke | `siteMotion.duration.draw` | 520ms | |
| Strike-through | `siteMotion.duration.cross-out` | 220ms | Fast and final |
| Block into grid | `siteMotion.duration.snap` | 200ms | |
| Register change | `siteMotion.duration.page-turn` | 560ms | The heaviest object |
| Button press | `siteMotion.duration.compress` | 80ms | Below the ramp's `fast` on purpose |
| Button release | `siteMotion.duration.release` | 160ms | |
| Piece seating | `siteMotion.duration.lock-in` | 260ms | |
| Listening breath | `siteMotion.duration.pulse` | 1800ms | The only slow, repeating value |
| Entrance curve | `siteMotion.ease.entrance` | `power3.out` | |
| Landing curve | `siteMotion.ease.thunk` / `.snap` / `.lock` | `power4.out` | Decelerates hardest |
| Two-ended curve | `siteMotion.ease.turn` / `.draw` | `power2.inOut` | Objects with mass at both ends |
| Cyclical curve | `siteMotion.ease.breath` | `sine.inOut` | Only for `pulse` |
| Overshoot | `siteMotion.overshoot.thunk` | 1.025 | Spec ceiling is 3% |
| Travel | `siteMotion.travel.*` | rem | Scales with the root the type ramp uses |
| Rotation | `siteMotion.rotate.*` | unsigned deg | Direction belongs to the primitive |
| Press travel + shadow | `--moyo-shadow-offset-2` | 0.375rem | One token drives both — see `compress` |

CSS emission (`packages/theme/build-css.mjs`): durations become
`--moyo-duration-*` inside `@theme`. Eases are **not** emitted — they are GSAP
identifiers with no CSS spelling, and encoding each as a bezier would be a
second source for one curve. CSS micro-interactions use the product's
`--ease-standard` / `--ease-emphasized`.

### Tokens added by this lane

`siteMotion` (duration · ease · overshoot · travel · rotate · scale · opacity)
and the exported types `SiteMotionDuration` / `SiteMotionEase`. Nothing was
hardcoded and nothing is missing.

---

## 3. The reduced-motion law, and how it is enforced

### One source of truth

`usePerfStore` at **`apps/web-vite/src/stores/perf-store.ts`** — the site's
single Zustand store for "how much may this machine be asked to do". It holds
the globe's perf tier (`'A' | 'B' | 'C' | null`, owned by the globe chapter) and
this lane's `reducedMotion`. It is imported from that path by everything; the
`@/motion` barrel deliberately does not re-export it, because one thing with two
import paths is how the store briefly existed twice (`src/globe/perf-store.ts`
and `src/motion/perf-store.ts`, both now gone).

Three readers, no fourth:

- React components: `useReducedMotion()`.
- GSAP builders, ticker callbacks, scroll handlers: `usePerfStore.getState().reducedMotion`
  (via `isReducedMotion()`). These are not renders, so `useSyncExternalStore`
  cannot serve them — that is why the site has a store and does not simply use
  the kit's `useReducedMotion` from `packages/ui/motion.tsx`. It is the same OS
  signal (`prefers-reduced-motion`, which react-native-web's `AccessibilityInfo`
  wraps), so kit components and site timelines can never disagree.
- The store reads `matchMedia` once at module scope and keeps a `change`
  listener for the life of the document, so the answer is correct before React's
  first render and stays correct if the reader flips the setting mid-visit.

### The end-state law

> An element that animates in must never be left invisible.

Enforced by shape, in three places:

1. **`compose()` in `primitives.ts` is the only timeline constructor**, and its
   `rest` parameter — the documented end state — is required by the type. There
   is no way to author a primitive without declaring where it finishes.
2. **Markup authors the END state.** No element on this site is written hidden:
   no `opacity-0`, no pre-applied translate, no CSS `stroke-dasharray`, no
   `display:none` register. A primitive creates its own start state at build
   time, in the browser, after checking the preference. So the prerendered HTML,
   the JS-off page and the reduced-motion page are the same finished page.
3. **Under reduced motion `compose()` writes `rest` with `gsap.set()`** and
   returns an empty *paused* timeline — never `null`, never a skipped tween. A
   caller that plays, reverses, stores or kills it behaves identically.

Exactly one primitive takes the other behaviour, `reducedMotion: 'instant'`:
`compress` runs its beats at zero duration, because a button's end state is
decided by the reader's finger, and a control that stops responding has lost its
affordance for the person who asked for less movement.

**CSS half.** `build-css.mjs` emits a `@media (prefers-reduced-motion: reduce)`
block inside `.moyo-site` that collapses every `--moyo-duration-*` to `0ms`,
generated per token key so a new duration cannot escape it. The property still
arrives at the same final value; only the tween is removed.

---

## 4. The matrix

Every primitive, its trigger, its tokens, and what it does under reduced motion.

| Primitive | Element | Trigger | Duration · ease | Reduced motion |
| --- | --- | --- | --- | --- |
| `thunk` | Cards | Scroll into view | `thunk` + `settle` · `power4.out` → `power2.out` | Card is at rest, full size, in place. No drop, no overshoot. |
| `open` | Workbook cover | Scroll or interaction | `open` · `power2.inOut` | Cover sits closed at rest; the chapter shows the open state as its default layout. Nothing rotates. |
| `peel` | Stickers | Scroll into view, **`once`** | `peel` + `settle` · `power2.out` | Sticker is flat, unrotated, at rest. Never fires. |
| `draw` | Pencil underlines | Scroll into view | `draw` · `power2.inOut` | `stroke-dasharray: none; stroke-dashoffset: 0` — the line is simply drawn. Verified: computed `strokeDasharray` is `none`. |
| `crossOut` | Wrong approaches | Scroll into view | `cross-out` · `power4.out` | The strike is already there at `scaleX: 1`. The information is the crossing-out; the movement was only the delivery. |
| `snap` | Mastery blocks | Scroll into view | `snap` + `settle` · `power4.out` | Blocks are seated in the grid, square, full size. |
| `lockIn` | Progress slots | Scroll into view | `lock-in` · `power4.out` | Piece is seated. |
| `pageTurn` | Register switch | Interaction | `page-turn` · `power2.inOut` | Incoming register present, outgoing `display:none`. **Navigation never depends on an animation completing.** |
| `compress` | Buttons | pointerdown / pointerup | `compress` · `power2.out` | `'instant'` — the pressed state is applied with zero duration. Press still reads as a press. |
| `pulse` | The mark, while Natalie listens | Listening state | `pulse` · `sine.inOut`, yoyo | Does not run. Mark at rest. Listening is announced by an `aria-live` region and by the copy — a pulse was never an accessible status. |
| `inertialTilt` / `bindDragInertia` | Draggables | Pointer drag | `compress` → `release` | Runs at zero duration through `compress`'s path only if bound; otherwise the card simply follows the pointer with no tilt. |
| `parallax` | Depth layers | Scroll, scrubbed | `page-turn` · `power2.inOut` | **Frozen at its layout position.** Not at a mid-scroll offset — that would be a composition nobody designed. Depth comes from the layering. |
| `splitReveal` | Display headings | Scroll into view | `thunk` · `power3.out`, staggered | **Not split at all.** The heading stays one text node with its original markup, which is also the better screen-reader result. Verified: 0 inner nodes. |
| Lenis smooth scroll | The document | Always on | — | **Does not start.** Native scrolling; `ScrollTrigger.update` still fires on the scroll event, so pinning and trigger arithmetic keep working. Verified: no `lenis` class on `<html>`. |
| ScrollTrigger pins | Any pinned section | Scroll | — | **No trigger is created at all** under reduced motion, so nothing pins. Verified: 0 triggers registered. |

Globe motion is **not** in this table. The globe island follows its own spec and
is owned by that chapter; this document only fixes the store it reads.

---

## 5. Cleanup — no leaked triggers

Leaked ScrollTriggers across route changes are the standard failure of GSAP in a
router app: the triggers of an unmounted route stay registered, keep firing on
scroll, and hold references to detached DOM.

`useMotionScene` builds every scene inside a `gsap.context` scoped to the
chapter's own element and calls `ctx.revert()` on unmount and on every rebuild.
That kills the tweens, kills every ScrollTrigger created inside it, restores the
inline styles GSAP wrote, and runs any cleanup function the builder returned
(GSAP's context cleanup list — `gsap-core.js:3898`), which is how DOM listeners
and SplitText instances are disposed through the same single teardown path.
`startMotionRuntime`'s disposer adds a document-level `ScrollTrigger.killAll(true)`
floor for anything created outside a context.

**Measured on `/motion-lab`**, flipping reduced motion six times to force six
full revert-and-rebuild cycles:

```
ScrollTriggers registered: 9 → 0 → 9 → 0 → 9 → 0 → 9
```

Stable, not climbing. The count is rendered on the page so an auditor can
falsify the claim rather than take it.

---

## 6. Budget

Initial JS on `/` (the marketing hero, pre-globe), gzipped, measured from the
production build:

Measured two ways, because the two disagree slightly: Vite's own build report
(the conservative number, used as the headline) and `gzip -9` over the emitted
files, resolved against the script graph in `dist/client/index.html`.

| Chunk | Loaded by `/` | Vite gz | `gzip -9` |
| --- | --- | --- | --- |
| `index.js` (client entry + router + root) | yes | 103.14 kB | 100.52 kB |
| `TwoPaneShell-*.js` (the `@acme/ui` barrel) | yes | 95.10 kB | 92.69 kB |
| `index-*.js` (`/` route) | yes | 0.46 kB | 0.45 kB |
| `react-*.js` | yes | 0.41 kB | 0.40 kB |
| **Initial total** | | **199.11 kB** | **194.05 kB** |
| `register-*.js` (gsap + ScrollTrigger + SplitText) | no | 47.99 kB | — |
| `runtime-*.js` (Lenis + ticker wiring) | no | 5.75 kB | — |
| `primitives-*.js` (the vocabulary) | no | 1.95 kB | — |
| `perf-store-*.js` (Zustand + the store) | no | 0.73 kB | — |

**Under the 200 kB budget on both measurements.** Baseline before this lane was
197.92 kB gz (Vite), so the motion foundation costs **+1.19 kB gz on the
critical path** — `MotionRuntime` plus the chunk-boundary overhead of a second
route. The 56.4 kB of animation library and store is entirely in async chunks
that `/` never requests, confirmed against the prerendered HTML's script graph
rather than assumed from the config.

Two things make that possible and both must be preserved:

- `MotionRuntime` imports **nothing** at module scope and reaches `./runtime`
  through `import()` inside an effect.
- `routes/__root.tsx` imports it from the FILE, not from the `../motion` barrel.
  The barrel reaches `useMotionScene` → `@/stores/perf-store`, whose module-scope
  media-query subscription is a side effect Rollup cannot shake — a barrel import
  would pull Zustand and the store into the initial bundle in order to render
  `null`. Verified: `/`'s script graph contains no `perf-store` chunk;
  `/motion-lab`'s does.

The remaining 95 kB is the `@acme/ui` root barrel, which ADR-001 already records
as a Phase 1 decision (`@acme/ui/primitives` reaches the same elements without
it). The margin is under 1 kB; the next chapter that needs headroom should spend
it there, not on motion.

---

## 7. SSR

Nothing in this lane runs on the server, and the prerender lane is intact:

- `dist/client/index.html` still carries the real `<h1>` (*"AI tutoring that
  helps children learn it by heart"*) with no `<!--$!-->` suspense-error marker.
- `dist/client/motion-lab/index.html` prerenders 15.6 kB of real content with
  `<meta name="robots" content="noindex, nofollow">`.
- Zero page errors and zero hydration warnings in headless Chrome against the
  built output, in both motion states.

One hydration bug was found and fixed during verification, and it is the general
rule: **markup must never branch on `reducedMotion`.** The server renders one
document for every reader, so a first client render that already knew the
preference is a text mismatch (React #418). `/motion-lab` displays the state
because reporting it is that page's job, and it guards the read with the kit's
`useHydrated()`. Chapters must not need this — effects may read the preference,
JSX may not.

---

## 8. Accessibility

Per the `accessibility-review` standard (WCAG 2.2 AA + the doc 38 §7 kids rules).

| Item | Status |
| --- | --- |
| 2.3.3 Animation from Interactions (AAA, adopted) | Met. Every non-essential motion is removed under `prefers-reduced-motion`. |
| 2.2.2 Pause, Stop, Hide | Met. The only repeating animation is `pulse`, which runs solely while listening and stops when it ends. No auto-playing loop exists on the site. |
| Motion is never the only channel | Met. `pulse` is paired with an `aria-live` region; `crossOut` and `pageTurn` end states are the information. |
| SplitText and screen readers | Met. `aria: 'auto'` restores the original string as a label when split; under reduced motion the node is never split. |
| Focus | Not affected — no primitive moves focus or animates a focused element out of view. |
| Vestibular risk | `parallax` and Lenis are the two vestibular triggers; both are fully disabled, not softened. |
| Confetti | **Never.** Progress is pieces locking into place. |

Open for the chapters (not this lane): per-screen focus order, target sizes and
contrast, per `accessibility-review` on each chapter.

---

## 9. How a chapter uses this

```tsx
import { useMotionScene } from '@/motion';

useMotionScene('.chapter-cards', ({ motion }) => {
  motion.thunk({ targets: '.chapter-card', stagger: 0.06, scroll: {} });
  motion.draw({ targets: '.chapter-underline', scroll: {} });
});
```

Rules:

- A chapter **never** imports `gsap`, `./primitives` or `./register` directly.
  The vocabulary arrives as the `motion` argument; importing it statically would
  pull GSAP into that route's chunk and undo §6.
- A chapter **never** writes a duration, ease, distance or overshoot. If a
  personality is missing, it is added to `siteMotion` and to §4 of this file —
  it is not improvised at a call site.
- An element with no personality assigned **does not animate**. There is no
  generic entrance in the vocabulary, deliberately.
- Selector strings inside a builder are scoped by `gsap.context` to the
  chapter's own element and cannot reach another chapter's markup.
