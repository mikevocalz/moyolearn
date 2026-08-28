'use client';
/**
 * The globe's live state, and the ONLY writable surface it has.
 *
 * Two rules make this file safe to drive at 60 Hz from a scroll timeline:
 *
 * 1. **`yaw`, `tilt` and `phase` must never be read through a React selector.**
 *    They change every frame. The scene reads them inside `useFrame` via
 *    `useGlobeStore.getState()`, and the DOM node layer reads them inside its
 *    own rAF loop the same way, so a 60 Hz `setPhase` produces exactly zero
 *    React renders. Anything that genuinely needs to re-render subscribes to a
 *    DERIVED, low-cardinality value — `revealedNodeCount` changes four times
 *    across a whole chapter, not sixty times a second.
 * 2. **Reduced motion is enforced here, not at the call sites.** When
 *    `usePerfStore`'s `reducedMotion` is set, `phase` is pinned to 1, `tick()`
 *    does nothing and `setPhase` is a no-op — so a visitor who asked for less
 *    motion gets the finished composition (globe still, every node visible,
 *    every fact reachable) no matter what the motion agent's timeline does. A
 *    convention that each animation must check the media query is a convention
 *    that gets missed once.
 *
 *    The flag is READ from `@/stores/perf-store` and never mirrored into this
 *    store. One media query, one owner: a copy here would be a second source of
 *    truth that goes stale the moment a reader flips the OS setting mid-visit,
 *    which that store's live listener exists to handle.
 *
 * SOT: this file · apps/web-vite/src/globe/api.ts · docs/site/globe-api.md
 * SOT-KEYWORDS: globe store zustand yaw tilt phase focus region node reveal drag
 *               reduced motion transient 60hz seam
 */
import { create } from 'zustand';
import { isReducedMotion } from '@/stores/perf-store';
import type { GlobeRegionId } from './generated/manifest';
import type { RegionGeometry } from './geometry';
import { DEG, shortestAngle } from './projection';
import type { GlobeNodeId } from './nodes';

/**
 * The composition, fixed. Centre longitude -25° (mid-Atlantic) puts all four
 * learning-node anchors on the near hemisphere at rest — Tanzania, Spain and
 * two in North America — while leaving Africa the largest block on the disc.
 * Centring Africa itself pushes both American anchors behind the horizon, and a
 * composition where half the leader lines are missing at rest reads as broken
 * rather than as an invitation to rotate.
 *
 * Tilt is +8° (north toward the viewer). Negative tilt puts the South Pole
 * fractionally in front of the horizon, which the Tier C silhouette renders as
 * a hole — see `scripts/build-globe-geometry.mjs:SILHOUETTE_TILT`.
 */
export const DEFAULT_CENTRE_LON = -25;
export const DEFAULT_YAW = -DEFAULT_CENTRE_LON * DEG;
export const DEFAULT_TILT = 8 * DEG;

/** Idle spin, radians per second. Slow enough to read as a drift, not a demo. */
export const AUTO_ROTATE_RATE = 0.045;

/** How far a focus tween travels per second, as a fraction of the remaining angle. */
export const FOCUS_LERP_PER_SECOND = 3.2;

/** Tilt is clamped so the globe can never roll past its poles under drag. */
export const MAX_TILT = 55 * DEG;

/**
 * Phase → node reveal. Nodes appear evenly across this window, so a motion
 * timeline that simply pipes scroll progress into `setPhase` gets a staggered
 * reveal for free and never has to know how many nodes there are.
 */
export const NODE_REVEAL_START = 0.15;
export const NODE_REVEAL_END = 0.75;

interface GlobeState {
  yaw: number;
  tilt: number;
  /** 0–1 chapter progress. 1 by default: with no motion agent the chapter is complete. */
  phase: number;
  focusedRegion: GlobeRegionId | null;
  activeNode: GlobeNodeId | null;
  /** Suppresses idle spin while a pointer is down or a focus tween is running. */
  dragging: boolean;
  /** Target yaw for an in-flight focus tween, or `null` when at rest. */
  targetYaw: number | null;
  autoRotate: boolean;
  /**
   * True while a frame driver is running — i.e. on Tier A or B. Tier C's globe
   * is a print baked at the default rotation, so nothing advances a tween and
   * `focusLongitude` must not leave one dangling.
   */
  driven: boolean;
  stageWidth: number;
  stageHeight: number;
  /** Total nodes in the composition, so `revealedNodeCount` needs no import cycle. */
  nodeCount: number;
  /**
   * Decoded continent geometry, once the island has fetched it. Lives here
   * rather than in component state because `useState` is not a thing this
   * codebase has, and because a tier demotion has to be able to drop it.
   *
   * The import is TYPE-ONLY — `./geometry` pulls in three, and this store is in
   * the first-paint chunk. A value import here would put the renderer in front
   * of every visitor including the ones on Tier C.
   */
  regions: readonly RegionGeometry[] | null;
  /** Set when the binary could not be fetched or decoded. One-way: Tier C is final. */
  geometryFailed: boolean;

  setPhase: (phase: number) => void;
  rotateBy: (deltaYaw: number, deltaTilt: number) => void;
  setYaw: (yaw: number) => void;
  focusLongitude: (lonDeg: number) => void;
  setFocusedRegion: (region: GlobeRegionId | null) => void;
  setActiveNode: (node: GlobeNodeId | null) => void;
  setDragging: (dragging: boolean) => void;
  setAutoRotate: (autoRotate: boolean) => void;
  setDriven: (driven: boolean) => void;
  setRegions: (regions: readonly RegionGeometry[] | null) => void;
  setGeometryFailed: (failed: boolean) => void;
  setStageSize: (width: number, height: number) => void;
  setNodeCount: (nodeCount: number) => void;
  /** Advance the idle spin and any focus tween. Called from the frame driver. */
  tick: (deltaSeconds: number) => void;
  reset: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const INITIAL = {
  yaw: DEFAULT_YAW,
  tilt: DEFAULT_TILT,
  phase: 1,
  focusedRegion: null,
  activeNode: null,
  dragging: false,
  targetYaw: null,
  autoRotate: true,
  driven: false,
  stageWidth: 0,
  stageHeight: 0,
  nodeCount: 0,
  regions: null,
  geometryFailed: false,
} satisfies Omit<
  GlobeState,
  | 'setPhase'
  | 'rotateBy'
  | 'setYaw'
  | 'focusLongitude'
  | 'setFocusedRegion'
  | 'setActiveNode'
  | 'setDragging'
  | 'setAutoRotate'
  | 'setDriven'
  | 'setRegions'
  | 'setGeometryFailed'
  | 'setStageSize'
  | 'setNodeCount'
  | 'tick'
  | 'reset'
>;

export const useGlobeStore = create<GlobeState>((set, get) => ({
  ...INITIAL,

  setPhase: (phase) => {
    if (isReducedMotion()) return;
    set({ phase: clamp(phase, 0, 1) });
  },

  rotateBy: (deltaYaw, deltaTilt) => {
    const { yaw, tilt } = get();
    set({
      yaw: yaw + deltaYaw,
      tilt: clamp(tilt + deltaTilt, -MAX_TILT, MAX_TILT),
      // A manual rotation cancels an in-flight focus tween; otherwise the globe
      // fights the pointer and the drag feels broken rather than damped.
      targetYaw: null,
    });
  },

  setYaw: (yaw) => set({ yaw, targetYaw: null }),

  focusLongitude: (lonDeg) => {
    // Tier C cannot turn: its globe is a build-time print. The highlight still
    // moves (`setFocusedRegion` / `setActiveNode` are separate calls), but the
    // rotation is refused here rather than left as a tween nothing advances.
    if (!get().driven) return;
    const target = -lonDeg * DEG;
    if (isReducedMotion()) {
      // No tween under reduced motion: the globe arrives, it does not travel.
      set({ yaw: get().yaw + shortestAngle(get().yaw, target), targetYaw: null });
      return;
    }
    set({ targetYaw: get().yaw + shortestAngle(get().yaw, target) });
  },

  setFocusedRegion: (focusedRegion) => set({ focusedRegion }),
  setActiveNode: (activeNode) => set({ activeNode }),
  setDragging: (dragging) => set({ dragging }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setDriven: (driven) => set({ driven }),
  setRegions: (regions) => {
    // Disposing the outgoing set is not tidiness: a tier switch replaces the
    // geometry and `BufferGeometry` holds GPU buffers that React unmounting a
    // mesh does not free. Without this, forcing A → B → A leaks two full
    // continent sets.
    const previous = get().regions;
    if (previous && previous !== regions) for (const region of previous) region.geometry.dispose();
    set({ regions });
  },
  setGeometryFailed: (geometryFailed) => set({ geometryFailed }),

  setStageSize: (stageWidth, stageHeight) => set({ stageWidth, stageHeight }),
  setNodeCount: (nodeCount) => set({ nodeCount }),

  tick: (deltaSeconds) => {
    const { yaw, targetYaw, autoRotate, dragging } = get();
    if (isReducedMotion()) return;

    if (targetYaw !== null) {
      // Exponential approach expressed per SECOND, not per frame. A per-frame
      // `v += (t - v) * k` runs at half speed on a 30 Hz display and reads as
      // slow motion on exactly the machines that are already struggling.
      const t = 1 - Math.exp(-FOCUS_LERP_PER_SECOND * deltaSeconds);
      const next = yaw + (targetYaw - yaw) * t;
      if (Math.abs(targetYaw - next) < 0.0015) set({ yaw: targetYaw, targetYaw: null });
      else set({ yaw: next });
      return;
    }

    if (autoRotate && !dragging) set({ yaw: yaw + AUTO_ROTATE_RATE * deltaSeconds });
  },

  // `driven`, `regions` and `geometryFailed` are deliberately preserved: they
  // describe what is MOUNTED, which a timeline calling reset() has not changed.
  // Clearing them would tear down the renderer on a scroll-position reset.
  reset: () =>
    set({
      ...INITIAL,
      driven: get().driven,
      regions: get().regions,
      geometryFailed: get().geometryFailed,
    }),
}));

/**
 * How many nodes the current phase has revealed. Low cardinality on purpose:
 * this is the one derived value React components subscribe to, and it changes
 * once per node across a whole chapter.
 */
export function revealedNodeCount(state: Pick<GlobeState, 'phase' | 'nodeCount'>): number {
  if (state.nodeCount === 0) return 0;
  const span = NODE_REVEAL_END - NODE_REVEAL_START;
  const t = clamp((state.phase - NODE_REVEAL_START) / span, 0, 1);
  return Math.round(t * state.nodeCount);
}

/**
 * Globe scale for the current phase: 0.9 at the start of the chapter, full size
 * by 30%. The only other thing `phase` drives, and it is deliberately small —
 * the choreography belongs to the motion agent, not to this store.
 */
export function globeScaleForPhase(phase: number): number {
  return 0.9 + 0.1 * clamp(phase / 0.3, 0, 1);
}
