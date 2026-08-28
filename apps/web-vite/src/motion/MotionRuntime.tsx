/**
 * Mounts the scroll runtime for the document. Rendered once, in
 * `routes/__root.tsx`, and renders nothing.
 *
 * This file is deliberately the only motion module the initial bundle contains,
 * and it is ~20 lines with no imports beyond React. GSAP, ScrollTrigger,
 * SplitText and Lenis arrive through the `import()` below, which Rollup emits as
 * a separate async chunk — the prerendered marketing page ships none of them.
 * A static import here would put ~50 kB gz of animation library in front of a
 * hero that does not animate. See docs/site/motion-matrix.md §6.
 *
 * It also keeps the prerender lane intact: no scroll library exists during SSR,
 * because `useEffect` does not run there and the dynamic import is never
 * reached. `dist/client/index.html` is produced by a Node pass that has never
 * heard of Lenis.
 *
 * SOT: apps/web-vite/src/motion/runtime.ts · docs/site/adr-001-ssr-lane.md
 * SOT-KEYWORDS: site motion runtime provider lenis root ssr lazy chunk web-vite
 */
import { useEffect } from 'react';

export function MotionRuntime(): null {
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;

    void import('./runtime').then(({ startMotionRuntime }) => {
      // React 19 runs effects twice in development. Without this guard the
      // second mount starts a second Lenis and a second ticker callback, and
      // the first one's disposer never runs — one leaked smooth-scroll loop per
      // hot reload, which reads as the page getting progressively heavier.
      if (cancelled) return;
      dispose = startMotionRuntime();
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return null;
}
