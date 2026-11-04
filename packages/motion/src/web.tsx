/**
 * `@acme/motion/web`: Kinetrell's GSAP and Lenis bridge with Moyo's policy
 * applied. Browser code only (apps/web-vite, apps/web client components).
 *
 * What the wrappers change, and nothing else:
 *  - `GsapMotionProvider` and `useBrowserReducedMotion` resolve the request
 *    through `resolveReducedMotionPolicy`, so 'never' cannot reach a production
 *    bundle.
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
import { useEffect, type DependencyList } from 'react';
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

export function GsapMotionProvider(props: GsapMotionProviderProps) {
  return (
    <KinetrellGsapMotionProvider
      {...props}
      reducedMotion={resolveReducedMotionPolicy(props.reducedMotion)}
    />
  );
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
  useEffect(() => {
    if (reduced) timeline.current?.progress(1).pause();
  }, [reduced, timeline, motion, targets]);
  return timeline;
}

export function connectGsapLenis(lenis: Lenis, options: Readonly<{ refreshOnConnect?: boolean }> = {}) {
  return connectKinetrellGsapLenis(lenis, { ...options, clock: 'kinetrell' });
}
