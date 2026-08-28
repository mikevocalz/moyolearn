/**
 * `globeApi` — the entire surface the motion agent drives.
 *
 * The scroll choreography (the 0–20 / 20–45 / 45–65 / 65–85 / 85–100 phases,
 * the Lenis + ScrollTrigger timeline, the cobalt flood into chapter 05) is NOT
 * built here and must not be. This module is the seam between the two: five
 * plain functions, safe to call from a ticker callback, a `gsap.to` `onUpdate`,
 * a ScrollTrigger `onEnter`, or a keyboard handler.
 *
 * Four properties make it safe to drive at 60 Hz:
 *
 *   - **No React.** Every function is a `useGlobeStore.getState()` write. Calling
 *     `setPhase` sixty times a second renders nothing; the scene and the DOM
 *     node layer both sample the store from their own frame loops.
 *   - **No mount requirement.** Calls made before the island mounts (or on a
 *     device that never mounts one, because it is on Tier C) land in the store
 *     and are simply the state the island reads when it appears. Nothing throws
 *     and nothing needs a ref.
 *   - **Reduced motion wins.** `setPhase` is a no-op and `focusRegion` snaps
 *     instead of tweening when the reader has asked for less motion. The motion
 *     agent does not have to remember; see `globe-store.ts`.
 *   - **Idempotent.** Every setter is absolute except `rotateBy`, which is the
 *     one deliberate relative call because a drag delta is relative.
 *
 * Documented in full in `docs/site/globe-api.md`.
 *
 * SOT: this file · docs/site/globe-api.md · apps/web-vite/src/globe/globe-store.ts
 * SOT-KEYWORDS: globe api imperative seam motion agent setPhase focusRegion rotateBy
 *               scroll choreography handoff
 */
import { GLOBE_REGIONS, type GlobeRegionId } from './generated/manifest';
import { useGlobeStore } from './globe-store';
import { GLOBE_NODES, type GlobeNodeId } from './nodes';
import { DEG } from './projection';

/** Read-only snapshot, for a timeline that needs to know where it is starting. */
export interface GlobeSnapshot {
  readonly yaw: number;
  readonly tilt: number;
  readonly phase: number;
  readonly focusedRegion: GlobeRegionId | null;
  readonly activeNode: GlobeNodeId | null;
}

export interface GlobeApi {
  /**
   * Chapter progress, 0–1. Drives exactly two things: how many learning nodes
   * have appeared (`NODE_REVEAL_START`–`NODE_REVEAL_END`) and the globe's
   * entrance scale (0.9 → 1 over the first 30%). Nothing else — the rest of the
   * choreography is the caller's.
   *
   * No-op under reduced motion, where `phase` is pinned at 1 (everything
   * visible, nothing moving).
   */
  setPhase(t: number): void;

  /**
   * Bring a continent's centroid to the centre of the disc, easing there over
   * roughly a third of a second. Passing `null` clears the highlight without
   * moving the globe.
   *
   * Takes the SHORT way round: focusing Asia from the Americas travels 160°,
   * not 200°. Without that, a timeline that focuses regions in sequence
   * accumulates whole turns.
   */
  focusRegion(id: GlobeRegionId | null): void;

  /**
   * Bring a learning node's anchor to the centre and mark its card active. The
   * click/tap equivalent of dragging the globe to that place, and what the
   * node cards' own buttons call.
   */
  focusNode(id: GlobeNodeId | null): void;

  /**
   * Rotate by a delta, in RADIANS. The one relative call: this is what a drag
   * gesture and an arrow key both reduce to. Cancels any focus tween in
   * flight, so the pointer always wins.
   */
  rotateBy(deltaYaw: number, deltaTilt: number): void;

  /** Idle spin. The motion agent turns this off while it owns the rotation. */
  setAutoRotate(on: boolean): void;

  /** Back to the rest composition: centre longitude -25°, tilt 8°, phase 1. */
  reset(): void;

  getState(): GlobeSnapshot;
}

const regionCentroidLon = (id: GlobeRegionId): number =>
  GLOBE_REGIONS.find((region) => region.id === id)?.centroid[0] ?? 0;

export const globeApi: GlobeApi = {
  setPhase(t) {
    useGlobeStore.getState().setPhase(t);
  },

  focusRegion(id) {
    const store = useGlobeStore.getState();
    store.setFocusedRegion(id);
    if (id === null) return;
    // Auto-rotate is stopped rather than paused: resuming a drift the instant a
    // focus lands drags the thing the reader just asked to look at back off
    // centre, which reads as the interaction having failed.
    store.setAutoRotate(false);
    store.focusLongitude(regionCentroidLon(id));
  },

  focusNode(id) {
    const store = useGlobeStore.getState();
    store.setActiveNode(id);
    if (id === null) {
      store.setFocusedRegion(null);
      return;
    }
    const node = GLOBE_NODES.find((candidate) => candidate.id === id);
    if (!node) return;
    store.setFocusedRegion(node.region);
    store.setAutoRotate(false);
    store.focusLongitude(node.anchor[0]);
  },

  rotateBy(deltaYaw, deltaTilt) {
    useGlobeStore.getState().rotateBy(deltaYaw, deltaTilt);
  },

  setAutoRotate(on) {
    useGlobeStore.getState().setAutoRotate(on);
  },

  reset() {
    useGlobeStore.getState().reset();
  },

  getState() {
    const { yaw, tilt, phase, focusedRegion, activeNode } = useGlobeStore.getState();
    return { yaw, tilt, phase, focusedRegion, activeNode };
  },
};

/**
 * One keyboard step, in radians. 6° per press: coarse enough to cross a
 * hemisphere in a reasonable number of presses, fine enough to aim. Exported
 * because the motion agent may want the same increment for its own controls.
 */
export const KEYBOARD_ROTATE_STEP = 6 * DEG;
