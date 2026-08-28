/**
 * The one way a chapter animates. `useMotionScene` is the seam that solves the
 * four things every one of them would otherwise get wrong:
 *
 *  1. **GSAP stays out of the initial bundle.** The primitives arrive through
 *     `import()`, so a chapter's route chunk carries a hook, not a library.
 *  2. **Cleanup is not optional.** Everything the builder creates is created
 *     inside a `gsap.context` scoped to the chapter's own element, and the
 *     cleanup calls `ctx.revert()`. That kills the tweens, kills every
 *     ScrollTrigger created inside it, and restores the inline styles GSAP
 *     wrote. Leaked triggers across route changes are the standard failure of
 *     GSAP in a router app: without a context, the triggers of an unmounted
 *     route stay registered, keep firing on scroll, and hold references to
 *     detached DOM. `ScrollTrigger.getAll().length` is stable across navigation
 *     because of this line and nothing else.
 *  3. **Reduced motion re-runs the scene.** The preference is a dependency, so
 *     flipping the OS setting mid-visit reverts the animated scene and rebuilds
 *     it in its end state — rather than leaving whatever was mid-flight.
 *  4. **Nothing runs on the server.** The whole body is an effect.
 *
 * The builder receives the vocabulary as an argument instead of importing it,
 * which is what keeps the chunk boundary honest: a chapter that imported
 * `./primitives` directly would pull GSAP into its route chunk statically and
 * quietly undo (1).
 *
 * SOT: apps/web-vite/src/motion/primitives.ts
 *      node_modules/gsap/types/gsap-core.d.ts:context,Context.revert
 * SOT-KEYWORDS: site motion hook scene gsap context revert cleanup lazy
 *               reduced-motion chapters web-vite
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useReducedMotion } from '@/stores/perf-store';
import type { MotionApi } from './primitives';

/**
 * What a chapter's builder is handed. `scope` is the resolved element the
 * `gsap.context` is bound to, so selector strings inside the builder are
 * already scoped to this chapter and cannot reach another one's markup.
 */
export interface MotionScene {
  motion: MotionApi;
  scope: HTMLElement;
  /** True while this build is the reduced-motion build. */
  reducedMotion: boolean;
}

/**
 * A builder may return a cleanup function. GSAP calls it on `ctx.revert()`
 * (gsap-core.js:3898 — the context's `_r` list of returned cleanup functions),
 * which is how a chapter disposes of DOM listeners it added — `bindDragInertia`
 * is the one in the vocabulary that needs it. Piggy-backing on the context
 * rather than adding a second cleanup channel means there is still exactly one
 * teardown path, so a listener cannot survive a revert.
 */
export type MotionSceneBuilder = (scene: MotionScene) => (() => void) | void;

/**
 * How a chapter names the element its scene is bound to.
 *
 * A ref is the better form and is what a chapter using its own elements should
 * pass. The selector form exists because most of this site is built from
 * `@acme/ui/primitives`, and those cannot take one: `css()` (packages/ui/html/
 * css.web.tsx) returns a plain function component over @expo/html-elements,
 * whose elements are typed `ComponentType<ViewProps>`
 * (node_modules/@expo/html-elements/build/elements/Layout.d.ts:8) — no ref in
 * the props, so there is nothing to forward. A selector against a class the
 * chapter already has is the honest way in, and classNames on kit components do
 * reach the DOM (verified in dist/client/index.html, which carries
 * `border-moyo-rule` on a real element).
 */
export type MotionScope = RefObject<HTMLElement | null> | string;

export function useMotionScene(
  scope: MotionScope,
  build: MotionSceneBuilder,
  deps: readonly unknown[] = [],
): void {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const element =
      typeof scope === 'string' ? document.querySelector<HTMLElement>(scope) : scope.current;
    if (!element) return;

    let context: gsap.Context | undefined;
    let cancelled = false;

    void Promise.all([import('./primitives'), import('./register')]).then(
      ([{ motionApi }, { gsap }]) => {
        if (cancelled) return;
        context = gsap.context(
          () => build({ motion: motionApi, scope: element, reducedMotion }),
          element,
        );
      },
    );

    return () => {
      // `cancelled` covers the window between the import starting and resolving:
      // a fast route change can unmount before the chunk lands, and without this
      // the context would be created against a detached element with no cleanup
      // left to run.
      cancelled = true;
      context?.revert();
    };
    // `build` is intentionally not a dependency: an inline builder is a new
    // function on every render, and depending on it would revert and rebuild
    // every scene on the page on each one. Chapters pass their real inputs in
    // `deps`, the same contract as useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, reducedMotion, ...deps]);
}
