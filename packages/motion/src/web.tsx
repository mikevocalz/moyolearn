/**
 * `@acme/motion/web`: Kinetrell's GSAP and Lenis bridge with Moyo's policy
 * applied. Browser code only (apps/web-vite, apps/web client components).
 *
 * What the wrappers change, and nothing else:
 *  - `GsapMotionProvider` and `useBrowserReducedMotion` resolve the request
 *    through `resolveReducedMotionPolicy`. Browsers have no `__DEV__`, so on
 *    the web 'never' resolves to 'system' unless a dev harness sets both
 *    `globalThis.__DEV__` and the test flag; a production bundle sets neither.
 *  - `useGsapMotion` finishes the timeline under reduced motion. Kinetrell's
 *    hook has no reduced-motion input (src/web/gsap.ts), while its provider
 *    does (`timeline.progress(1).pause()`, src/web/react.tsx); this gives the
 *    hook the provider's behaviour.
 *  - `connectGsapLenis` always takes the `'kinetrell'` clock: GSAP's ticker
 *    drives Lenis, one rAF loop for both. An app that already runs its own
 *    loop must not call it (apps/web-vite/src/motion/runtime.ts owns that
 *    page's ticker).
 *
 * SOT: kinetrell src/web/react.tsx (GsapMotionProvider, Motion,
 *      useBrowserReducedMotion), src/web/gsap.ts (useGsapMotion,
 *      attachScrollTrigger, createGsapTimeline), src/web/lenis.ts
 *      (useKinetrellLenis), src/web/gsap-lenis.ts (connectGsapLenis)
 * SOT-KEYWORDS: motion web gsap lenis scrolltrigger wrapper reduced-motion
 *               kinetrell provider
 */
import { useEffect, useState, type DependencyList } from 'react';
import type Lenis from 'lenis';
import type { CompiledMotion } from 'kinetrell/core';
import {
  GsapMotionProvider as KinetrellGsapMotionProvider,
  useBrowserReducedMotion as useKinetrellBrowserReducedMotion,
  type GsapMotionProviderProps,
} from 'kinetrell/web/react';
import { useGsapMotion as useKinetrellGsapMotion, type GsapTargetMap } from 'kinetrell/web/gsap';
import { connectGsapLenis as connectKinetrellGsapLenis } from 'kinetrell/web/gsap-lenis';
import { resolveReducedMotionPolicy, type ReducedMotionPolicy } from './policy.ts';

export { Motion } from 'kinetrell/web/react';
export { attachScrollTrigger, createGsapTimeline, type GsapTargetMap, type ScrollTriggerConfig } from 'kinetrell/web/gsap';
export { useKinetrellLenis } from 'kinetrell/web/lenis';

export function useBrowserReducedMotion(requested?: ReducedMotionPolicy): boolean {
  return useKinetrellBrowserReducedMotion(resolveReducedMotionPolicy(requested));
}

/**
 * The OS setting read synchronously on the first client render. Kinetrell's
 * hook reads it in a useEffect, after paint, so on a reduced-motion machine the
 * provider's layout effect would first set and paint the `start` frame, then
 * jump to the end: a flash for exactly the reader who asked for none. Reading
 * matchMedia in the state initializer settles 'system' before the layout
 * effect runs. The provider renders no markup of its own, so a server value
 * that differs causes no hydration mismatch.
 */
function useInitialPolicy(requested: ReducedMotionPolicy | undefined): ReducedMotionPolicy {
  const policy = resolveReducedMotionPolicy(requested);
  const [reducedAtMount] = useState(
    () =>
      policy === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  return reducedAtMount ? 'always' : policy;
}

export function GsapMotionProvider(props: GsapMotionProviderProps) {
  return <KinetrellGsapMotionProvider {...props} reducedMotion={useInitialPolicy(props.reducedMotion)} />;
}

export function useGsapMotion(
  motion: CompiledMotion,
  targets: GsapTargetMap,
  options: Readonly<{
    autoplay?: boolean;
    dependencies?: DependencyList;
    reducedMotion?: ReducedMotionPolicy;
  }> = {},
) {
  const reduced = useBrowserReducedMotion(options.reducedMotion);
  const timeline = useKinetrellGsapMotion(motion, targets, {
    autoplay: options.autoplay === true && !reduced,
    dependencies: [reduced, ...(options.dependencies ?? [])],
  });
  // Runs after useGSAP's layout effect, so `timeline.current` is the timeline
  // just built. The deps are the same set useGSAP rebuilds on: a rebuild
  // under reduced motion must be finished again, or it sits at progress 0.
  useEffect(() => {
    if (reduced) timeline.current?.progress(1).pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- spreads the caller's rebuild deps, as useGSAP does
  }, [reduced, timeline, motion, targets, ...(options.dependencies ?? [])]);
  return timeline;
}

export function connectGsapLenis(lenis: Lenis, options: Readonly<{ refreshOnConnect?: boolean }> = {}) {
  return connectKinetrellGsapLenis(lenis, { ...options, clock: 'kinetrell' });
}
