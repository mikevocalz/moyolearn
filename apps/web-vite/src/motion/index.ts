/**
 * The motion foundation's public surface — what a chapter imports.
 *
 * It deliberately does NOT re-export `./primitives` or `./register`. Those pull
 * GSAP in statically, and a barrel that dragged them into every chapter's route
 * chunk would undo the whole lazy-loading arrangement while looking tidier. The
 * vocabulary reaches a chapter one way only: as the `motion` argument
 * `useMotionScene` hands its builder.
 *
 * It also does not re-export the perf store. `usePerfStore`, `useReducedMotion`
 * and `isReducedMotion` live at `@/stores/perf-store` and are imported from
 * there — by this lane, by the globe, by everything. Re-exporting them here
 * would give one thing two import paths, which is the second-way-to-do-it that
 * CLAUDE.md forbids, and it is how the store came to exist twice in the first
 * place.
 *
 * The type re-exports are erased at build time, so a chapter gets full
 * autocomplete over the vocabulary without importing a byte of it.
 *
 * SOT: docs/site/motion-matrix.md · docs/site/component-inventory.md
 *      apps/web-vite/src/stores/perf-store.ts
 * SOT-KEYWORDS: site motion index barrel chapters api useMotionScene
 *               reduced-motion web-vite
 */
export { MotionRuntime } from './MotionRuntime';
export { useMotionScene } from './use-motion-scene';

export type { MotionScene, MotionSceneBuilder, MotionScope } from './use-motion-scene';
export type {
  BaseOptions,
  MotionApi,
  OpenOptions,
  PageTurnOptions,
  ParallaxOptions,
  ReducedMotionBehaviour,
  ScrollSpec,
  SnapOptions,
  SplitOptions,
  SplitResult,
  TiltOptions,
} from './primitives';
