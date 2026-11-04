# Motion

`packages/motion` (`@acme/motion`) owns choreographed motion on every Moyo
surface. Kinetrell (`0.1.0-alpha.2`, consumed by git tag per
[ADR-124](../decisions/adr-124-kinetrell-by-git-tag.md)) is its only animator.

SOT-KEYWORDS: motion kinetrell presets handoff reduced-motion inspector gate

## Entry points

| Import | Runtime | What it carries |
| --- | --- | --- |
| `@acme/motion` | everywhere: web, native, Spark desktop, Node tests | Kinetrell core (`defineMotion`, `compileMotion`, `evaluateMotion`), `presets`, `spring`, `track()`, the reduced-motion policy, the registry, the gate |
| `@acme/motion/native` | React Native | `useMotion`, `useMotionStyle`, `Motion.View/Text/Image`, `useKinetrellScroll`, `useSectionProgress`, `useParallax`, `useScrollScene`, `useScrollScrub`, `useNativeScrollController`, `useNativeSnapController`, `useMotionPanGesture`, `gradientToBackgroundImage` |
| `@acme/motion/web` | browser | `GsapMotionProvider`, `Motion` (DOM), `useGsapMotion`, `attachScrollTrigger`, `useKinetrellLenis`, `connectGsapLenis` (clock owned by Kinetrell), `useBrowserReducedMotion` |
| `@acme/motion/dev` | development builds | `mountMotionInspector()` |

The split mirrors Kinetrell's own boundaries: the root entry never imports
React, Reanimated or the DOM, so Spark desktop can use it while its React Native
pin is below what `kinetrell/native` supports.

## Presets

Durations are parsed from the theme's `motion.duration` strings, so the CSS
variables and the Kinetrell tracks share one source
(`packages/theme/tokens.ts`). Bands are from web-designer-pro `motion.md` §1 and
are enforced by `packages/motion/src/presets.test.ts`.

| Preset | Token | ms | Curve | Use |
| --- | --- | --- | --- | --- |
| `feedback` | `motion.duration.base` | 200 | `cubic.out` | a control answering a touch or click |
| `transition` | `motion.duration.slow` | 300 | `cubic.inOut` | a state or view changing place |
| `entrance` | `motion.duration.slow` | 300 | `cubic.out` | something arriving |
| `exit` | `motion.duration.fast` | 120 | `cubic.in` | something leaving |
| `cinematic` | `motion.duration.slower` | 500 | `cubic.out` | the four signatures only |
| `spring.settle` | `motion.spring.settle` | — | damping 18, stiffness 260, mass 1 | physical settles; same constants as the kit's `ScaleIn` |

`track(preset, { target, to, after?, overlap? })` builds a Kinetrell track whose
start is expressed in presets ("after the entrance, overlapping half"), so no
call site types a millisecond.

## Reduced motion

Policy `'system'` everywhere. `'always'` may be requested anywhere. `'never'` is
honoured only when the build is a development build **and**
`globalThis.__MOYO_MOTION_TEST__ === true`; otherwise it resolves to `'system'`
(`packages/motion/src/policy.ts`, tested in `policy.test.ts`). Under reduced
motion every timeline finishes (`reducedMotionBehavior: 'finish'`), parallax
returns a still value, and the web hook jumps the GSAP timeline to progress 1.

## Gates

- `tooling/check-motion-durations.mjs` (in `pnpm lint`): no numeric literal for
  `durationMs`, `delayMs`, `duration`, `withDelay(n)`, `.duration(n)` or spring
  constants in any file that imports `@acme/motion`, in `packages/motion`, or in
  the migrated screens. Before PR-M01 it reported 1 on those screens
  (`apps/mobile/app/_layout.tsx`, the native splash cross-fade at 220 ms); after,
  0.
- `packages/motion/src/inspector.test.ts` (in `turbo run test`): every
  registered motion compiles, has no `KINETRELL_CONFLICTING_OWNER` diagnostic,
  and its storyboard frames (start, every label, end) match
  `storyboards.snapshot.json`.

## Motion handoff rows

One row per component that moves. "Preset" is the timing source, "trigger" is
what starts it, "reduced" is what a person with Reduce Motion on sees.

| Component | File | Preset | Trigger | Reduced |
| --- | --- | --- | --- | --- |
| Native splash cross-fade | `apps/mobile/app/_layout.tsx` | `feedback` (was a literal 220 ms) | first frame of `MoyoSplash` | the OS cross-fade, unchanged |
| Animated splash | `apps/mobile/components/splash/MoyoSplash.tsx` | its own `BEAT` storyboard (no literals at call sites) | app launch | settled frame, no animation (`useReducedMotion`) |
| Plan card hover/press | `packages/ui/PlanCard.tsx` | CSS `duration-fast` token | pointer | `motion-reduce:transition-none` |

## Bare Reanimated outside the gate

These animate a finger-driven state (a drag settling, a pane resizing) rather
than a choreographed sequence, so they stay on Reanimated directly. Each was
listed by `grep -rnE "with(Timing|Spring|Delay|Repeat)\("` on 2026-11-04:

| File | What moves | Disposition |
| --- | --- | --- |
| `packages/ui/adaptive-panes/SwipeableRow.native.tsx` | row snaps after a swipe | DEFER: gesture settle; moves to `useMotionPanGesture` when the row gains a storyboard |
| `packages/ui/adaptive-panes/use-sticky-header.native.ts` | header offset | DEFER: scroll-linked, already reads native scroll |
| `packages/ui/adaptive-panes/CollapsiblePane.native.tsx` | pane width | DEFER: config is a named constant (`PANE_WIDTH`) |
| `packages/ui/stage-board/StageBoard.native.tsx` | board recentres | DEFER: named constant `SETTLE_MS`, honours reduce motion |
| `packages/app/features/schedule/event-drag.native.tsx` | event settles after drag | DEFER: literal spring (30/220) to move to `spring.settle` with a device check |
| `packages/app/features/editor/reorder-row.native.tsx` | row settles after reorder | DEFER: literal 140 ms to move to `feedback` with a device check |
| `apps/mobile/components/splash/redraw/MoyoSplash.tsx` | tagline | STRIKE from scope: not mounted (`_layout.tsx` mounts `components/splash/MoyoSplash.tsx`) |

The two literal sites change feel under a finger, so each moves with a recording
on a device, not as a drive-by edit.
