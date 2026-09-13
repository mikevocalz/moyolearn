// The spatial panel's contract, shared by the Viro implementation and the
// web stub that must never load it.
//
// ONE SHAPE, TWO PLATFORMS, AND ONLY ONE OF THEM RENDERS. There is no XR on
// web: `@reactvision/react-viro` has no web entry for `ViroXRSceneNavigator`,
// the marketing and learner web apps must keep building, and a headset feature
// behind a browser tab is not a feature. The types live here so the native file
// is the only thing that imports Viro, and the web fork can answer honestly
// without pretending.
// SOT: packages/ui/xr/board-layout.ts · packages/ui/xr/spatial-tokens.ts
// SOT-KEYWORDS: xr panel types spatial ornament companion placement surface input state native only

import type { ReactNode } from 'react';

/** Metres, head-relative: `[0,0,0]` is the child's head and `-Z` is forward. */
export type XrVector3 = readonly [number, number, number];

/**
 * Where the whole composition sits, and the only thing that moves it.
 *
 * Held by the caller's store rather than the panel, because it has to survive
 * the panel remounting — a recenter that is forgotten when the scene reloads is
 * a child re-placing their homework every time tracking blinks.
 */
export interface XrPlacement {
  position: XrVector3;
  rotation: XrVector3;
  /** Uniform. One number, so a scale gesture cannot put the paper off 5:7. */
  scale: number;
}

/**
 * A control group that belongs to the panel without sitting on it.
 *
 * Apple's ornaments are the reference: controls related to a window, positioned
 * outside its bounds, keeping their relationship to it when it moves. Viro has
 * no ornament API, so this is a layout relationship the panel enforces — the
 * rail is a SIBLING of the paper under one anchor, never a child of it, because
 * a nested `ViroFlexView` cannot carry its own transform (only the outermost
 * one's `position`/`rotation`/`scale` is respected) and because a control drawn
 * on the paper is a control covering the homework.
 */
export interface XrOrnament {
  node: ReactNode;
  /** Metres across the panel's X axis for a leading rail, Y for top/bottom. */
  extent: number;
  gap: number;
}

/** A second panel sharing this one's anchor — the tutor conversation. */
export interface XrCompanion {
  node: ReactNode;
  zone: 'peripheralLeft' | 'peripheralRight';
  width: number;
  height: number;
  gap: number;
  /** Turned back toward the child, so it is read rather than glanced past. */
  yawDeg: number;
}

/**
 * One sample of a pointer on the panel's surface, in surface-local coordinates.
 *
 * `u` and `v` are 0–1 from the surface's top-left. Normalised rather than
 * metres because the consumer's next move is always to multiply by a pixel
 * size, and normalised survives a scale gesture without being recomputed.
 *
 * THE TRANSFORM HAPPENS ONCE. The panel knows its own world transform, so it is
 * the only thing that converts a world hit into `(u, v)`; a caller that
 * converts again gets ink at half the distance from the paper's edge, which
 * looks like a calibration problem and is actually two matrices.
 */
export interface XrSurfaceInput {
  phase: 'begin' | 'move' | 'end' | 'cancel';
  u: number;
  v: number;
  /** Which input device: a controller ray, a hand, or eye gaze. */
  source: number;
  pressure?: number;
}

/**
 * What the panel is doing, as one value.
 *
 * A union rather than booleans so that "ready but also unsupported" cannot be
 * written down. `interrupted` is recoverable and keeps the board on screen;
 * `unsupported` never renders a board at all, because a blank board that looks
 * usable is worse than a sentence saying the headset cannot do this.
 */
export type XrPanelState =
  | 'checking'
  | 'preparing'
  | 'ready'
  | 'interrupted'
  | 'unsupported'
  | 'exiting';

export interface XrPanelProps {
  /** The writable surface's width in metres. Height comes from `aspect`. */
  width: number;
  /** Locks height to width. `{ w: 5, h: 7 }` for the whiteboard. */
  aspect: { w: number; h: number };
  /** The board itself, drawn onto the surface by the caller. */
  children?: ReactNode;
  ornaments?: {
    leading?: XrOrnament;
    top?: XrOrnament;
    bottom?: XrOrnament;
  };
  companion?: XrCompanion;
  placement: XrPlacement;
  /**
   * Grabbing the FRAME moves the composition; the surface never does.
   *
   * They are physically separate affordances on purpose. A child drawing a long
   * division and a child repositioning their paper are doing different things,
   * and a surface that does both means every downstroke risks dragging the
   * homework across the room.
   *
   * TWO VALUES, BECAUSE THERE ARE TWO BEHAVIOURS. `'bottomOrnament'` was also
   * writable and `XrPanel` branches on `'frame'` alone, so it behaved exactly
   * as `'none'`: a caller who asked for the placement row to be the grab handle
   * got a board that could not be moved at all, with no error anywhere. The
   * value is gone rather than implemented, because the row below the paper is
   * two keys with their own click handlers and making the strip between them
   * draggable is a drag that starts wherever a child misses a key. The frame is
   * the affordance; `'none'` is a board the caller pins.
   */
  moveHandle?: 'frame' | 'none';
  onPlacementChange?: (next: XrPlacement) => void;
  onSurfaceInput?: (sample: XrSurfaceInput) => void;
  state: XrPanelState;
  /** Registered material names. Falls back to the spatial defaults. */
  materials?: { surface?: string; frame?: string };
  /** Hands are the input, so hit targets get the hand multiplier. */
  handsPrimary?: boolean;
  reducedMotion?: boolean;
}
