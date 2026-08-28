'use client';
/**
 * The globe island. The one thing anybody outside `src/globe/` renders.
 *
 * ── The client-only gate ───────────────────────────────────────────────────
 * Three separate locks, because this is the property ADR-001 paid for and one
 * lock is a property somebody removes by accident:
 *
 *   1. `React.lazy(() => import('./scene'))` — three, R3F and the geometry
 *      decoder live behind dynamic imports, so they are their own chunk.
 *   2. A MOUNTED GATE. `usePerfStore.tier` is `null` until `detect()` runs, and
 *      `detect()` is only ever called from an effect — which never runs on the
 *      server. `mounted` is therefore `tier !== null`: one flag, not two that
 *      can disagree, and it is impossible to satisfy during a prerender.
 *   3. Tier C is what `null` resolves to, so the prerender emits the static SVG
 *      globe — real content with every claim in it, not a spinner.
 *
 * The result: `dist/client/globe-lab/index.html` contains a complete, readable
 * chapter, and the WebGL chunk is fetched only by a browser that has been
 * measured and found capable.
 *
 * ── The geometry fetch is deliberately outside Suspense ────────────────────
 * `loadRegionGeometries` runs in an effect and its result goes through the
 * store. A suspending loader inside the Canvas would tear down and rebuild the
 * WebGL context on every retry, and — the part that matters — a failed fetch
 * has to be able to drop the whole island back to Tier C, which it cannot do
 * from inside a renderer it is part of.
 *
 * ── Why the drag surface is a raw <div> ────────────────────────────────────
 * `@acme/ui/primitives`' `View` is react-native-web's View, whose prop types
 * (React Native's `ViewProps`) model neither `onPointerDown` nor `onKeyDown`.
 * This element has no semantics to lose — it is a direct-manipulation surface
 * on a web-only page, and RNW would render exactly this div anyway. Every
 * element here that carries meaning (`Figure`, `Figcaption`, the node `List`
 * and its `Button`s) is a kit primitive.
 *
 * ── Drag, and its click parity ─────────────────────────────────────────────
 * Pointer drag rotates. Everything drag can reach is also reachable by pressing
 * a node card — which turns the globe to that place — and by the arrow keys
 * once the globe has focus. WCAG 2.1.1 and 2.5.1: no path through this chapter
 * needs a pointer, and no fact needs the globe at all, because the claims are
 * card text that is always in the DOM.
 *
 * SOT: apps/web-vite/src/globe/scene.tsx · apps/web-vite/src/stores/perf-store.ts
 *      docs/site/adr-002-globe-geometry.md · docs/site/globe-api.md
 * SOT-KEYWORDS: globe island lazy mounted gate tier switch ssr prerender drag
 *               keyboard a11y alt text reduced motion fallback
 */
import { Figcaption, Figure } from '@acme/ui/primitives';
import { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import './globe.css';
import { KEYBOARD_ROTATE_STEP, globeApi } from './api';
import { useGlobeStore } from './globe-store';
import { NodeLayer } from './node-layer';
import { GLOBE_ALT_TEXT } from './nodes';
import { StaticGlobe } from './static-globe';
import { TIER_SETTINGS, resolveTier, usePerfStore } from '@/stores/perf-store';

const GlobeScene = lazy(() => import('./scene'));

/** Pointer pixels → radians. A drag across a 900 px stage turns roughly 200°. */
const DRAG_YAW_PER_PX = 0.004;
/** Vertical drag is deliberately less sensitive: tilt is a garnish, not an axis. */
const DRAG_TILT_PER_PX = 0.002;

export function Globe() {
  const detect = usePerfStore((state) => state.detect);
  const tier = usePerfStore(resolveTier);
  // The mounted gate. `tier` can only leave `null` from `detect()`, and
  // `detect()` can only be reached from an effect.
  const mounted = usePerfStore((state) => state.tier !== null);

  const regions = useGlobeStore((state) => state.regions);
  const geometryFailed = useGlobeStore((state) => state.geometryFailed);

  useEffect(() => {
    detect();
  }, [detect]);

  const wantsWebgl = mounted && !geometryFailed && (tier === 'A' || tier === 'B');
  const lod = tier === 'A' || tier === 'B' ? TIER_SETTINGS[tier].lod : null;

  useEffect(() => {
    if (!wantsWebgl || lod === null) return;
    const controller = new AbortController();
    let cancelled = false;
    void (async () => {
      try {
        const { loadRegionGeometries } = await import('./geometry');
        const loaded = await loadRegionGeometries(lod, controller.signal);
        if (!cancelled) useGlobeStore.getState().setRegions(loaded);
      } catch (error) {
        if (controller.signal.aborted) return;
        // Any failure — a 404, a host serving an SPA shell, a decode mismatch —
        // is a TIER failure, not a page failure. Tier C is always available and
        // carries exactly the same content.
        console.warn('globe: falling back to the static tier', error);
        if (!cancelled) useGlobeStore.getState().setGeometryFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [wantsWebgl, lod]);

  useEffect(
    () => () => {
      // BufferGeometry holds GPU buffers that outlive React and are only
      // released by an explicit dispose.
      const held = useGlobeStore.getState().regions;
      if (held) for (const region of held) region.geometry.dispose();
    },
    [],
  );

  const interactive = wantsWebgl && regions !== null;

  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!interactive) return;
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      const store = useGlobeStore.getState();
      store.setDragging(true);
      // A reader who has taken hold of the globe has stopped wanting it to
      // drift; resuming the idle spin on release would undo their aim.
      store.setAutoRotate(false);
    },
    [interactive],
  );

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    globeApi.rotateBy(
      (event.clientX - active.x) * DRAG_YAW_PER_PX,
      -(event.clientY - active.y) * DRAG_TILT_PER_PX,
    );
    active.x = event.clientX;
    active.y = event.clientY;
  }, []);

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    drag.current = null;
    useGlobeStore.getState().setDragging(false);
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!interactive) return;
      const step = KEYBOARD_ROTATE_STEP;
      if (event.key === 'ArrowLeft') globeApi.rotateBy(-step, 0);
      else if (event.key === 'ArrowRight') globeApi.rotateBy(step, 0);
      else if (event.key === 'ArrowUp') globeApi.rotateBy(0, step);
      else if (event.key === 'ArrowDown') globeApi.rotateBy(0, -step);
      else return;
      // Only the four keys actually handled are swallowed, so Tab, Escape and
      // page scrolling all keep working while the globe holds focus.
      event.preventDefault();
      useGlobeStore.getState().setAutoRotate(false);
    },
    [interactive],
  );

  return (
    <Figure className="moyo-globe-stage">
      <div
        className="moyo-globe-frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        // A tab stop only where it can be operated: a focusable element that
        // does nothing is a WCAG 2.4.3 defect, not a courtesy. On Tier C the
        // globe is a print and the node buttons are the whole interaction.
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          interactive
            ? 'Globe. Use the arrow keys to turn it, or choose a place from the list below.'
            : undefined
        }
      >
        {interactive && (tier === 'A' || tier === 'B') ? (
          <Suspense fallback={<StaticGlobe />}>
            <GlobeScene tier={tier} regions={regions} />
          </Suspense>
        ) : (
          <StaticGlobe />
        )}
      </div>

      {/*
        The node layer is a SIBLING of the frame, not a child. Below the
        container query's breakpoint the card list stops being absolutely
        positioned and becomes a grid in normal flow — inside the frame that
        grid would lay itself out on top of the canvas, which is exactly the bug
        that shipped the first time this was built.
      */}
      <NodeLayer interactive={interactive} />

      {/*
        The text alternative for whichever picture is on screen. Visually hidden
        rather than absent: WCAG 1.1.1 asks for an alternative serving the
        equivalent PURPOSE, and this map's purpose is the set of claims it makes
        by colouring one continent differently and pointing at four places.
      */}
      <Figcaption className="sr-only">{GLOBE_ALT_TEXT}</Figcaption>
    </Figure>
  );
}
