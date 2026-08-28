/**
 * The site's scroll runtime: Lenis driving ScrollTrigger, started once for the
 * document and torn down as a unit.
 *
 * ── WHY THE TICKER IS WIRED THIS WAY ────────────────────────────────────────
 * Lenis and ScrollTrigger both want to be the thing that reacts to scroll, and
 * if each keeps its own clock they drift by a frame: ScrollTrigger reads a
 * scroll position Lenis has not applied yet, and every pinned section lags the
 * content by one frame in a way that looks like jank but is actually a race.
 * Three lines settle it, and the order matters:
 *
 *   1. `lenis.on('scroll', ScrollTrigger.update)` — ScrollTrigger recomputes on
 *      Lenis's smoothed position, not on the browser's raw one.
 *   2. `gsap.ticker.add(t => lenis.raf(t * 1000))` — Lenis is advanced BY GSAP's
 *      rAF loop instead of running its own. One loop, one frame, one order.
 *      The `* 1000` is not a magic number: gsap's ticker reports seconds and
 *      `Lenis.raf` is documented as taking milliseconds
 *      (node_modules/lenis/dist/lenis.d.ts — "The time in ms from an external
 *      clock like requestAnimationFrame or Tempus").
 *   3. `gsap.ticker.lagSmoothing(0)` — GSAP's default lag smoothing fabricates a
 *      time delta after a long frame to keep animations looking continuous.
 *      Fed into a scroll interpolator that is being told what time it is, that
 *      invention becomes a visible jump on the first slow frame.
 *
 * ── REDUCED MOTION ──────────────────────────────────────────────────────────
 * Lenis does not start at all. Smooth scrolling is inertia applied to the
 * reader's own input — it is the single most nauseating thing on a long
 * scroll-driven page, and there is no "reduced" version of it that is worth
 * shipping. Native scrolling with plain `ScrollTrigger.update` on the scroll
 * event is the reduced-motion path, so pinning and trigger arithmetic still
 * work for anything that legitimately needs them.
 *
 * ── SSR ─────────────────────────────────────────────────────────────────────
 * Nothing in this module runs on the server. It is only ever reached through
 * `import()` inside a `useEffect` (see MotionRuntime.tsx), which is also what
 * keeps GSAP and Lenis out of the initial bundle.
 *
 * SOT: node_modules/lenis/dist/lenis.d.ts (Lenis, raf, on, destroy, stop, start)
 *      node_modules/gsap/types/gsap-core.d.ts:ticker,lagSmoothing
 *      node_modules/gsap/types/scroll-trigger.d.ts:update,refresh,killAll
 * SOT-KEYWORDS: site motion runtime lenis scrolltrigger ticker raf lagSmoothing
 *               smooth-scroll reduced-motion web-vite
 */
import Lenis from 'lenis';
import { usePerfStore } from '@/stores/perf-store';
import { ScrollTrigger, gsap } from './register';

/**
 * Start the runtime. Returns its disposer; call it exactly once.
 *
 * The reduced-motion preference is subscribed rather than read, because a
 * reader who turns the OS setting on mid-visit must get native scrolling back
 * without a reload — and because the reverse (turning it off) should not
 * require one either.
 */
export function startMotionRuntime(): () => void {
  let lenis: Lenis | undefined;
  let stopTicker: (() => void) | undefined;

  const startLenis = (): void => {
    if (lenis) return;
    lenis = new Lenis({ autoRaf: false });
    const offScroll = lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number): void => {
      lenis?.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    stopTicker = () => {
      gsap.ticker.remove(tick);
      // Restore GSAP's default (500ms threshold, 33ms adjusted lag) rather than
      // leaving it at 0 for whatever runs next — the setting is global.
      gsap.ticker.lagSmoothing(500, 33);
      offScroll();
    };
    // Lenis changes the document height on the frame it attaches; triggers
    // measured before that keep the pre-Lenis numbers for the life of the page.
    ScrollTrigger.refresh();
  };

  const stopLenis = (): void => {
    stopTicker?.();
    stopTicker = undefined;
    lenis?.destroy();
    lenis = undefined;
    ScrollTrigger.refresh();
  };

  const apply = (reducedMotion: boolean): void => {
    if (reducedMotion) stopLenis();
    else startLenis();
  };

  apply(usePerfStore.getState().reducedMotion);
  const unsubscribe = usePerfStore.subscribe((state, previous) => {
    if (state.reducedMotion !== previous.reducedMotion) apply(state.reducedMotion);
  });

  return () => {
    unsubscribe();
    stopLenis();
    /*
      The route-level `gsap.context` in useMotionScene reverts each chapter's own
      triggers. This is the document-level floor for anything that outlived its
      scope — a trigger created outside a context, or one whose element was
      removed by a router transition before its cleanup ran. `killAll(true)`
      keeps ScrollTrigger's own resize/scroll listeners so a later mount does not
      come up deaf.
    */
    ScrollTrigger.killAll(true);
  };
}
