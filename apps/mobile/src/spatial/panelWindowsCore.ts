// Placement bookkeeping for windows hosted as PICO panels (a second Activity),
// kept free of native imports so node:test can drive it.
// SOT: modules/spatial-panels · src/spatial/panelWindows.tsx
// SOT-KEYWORDS: pico spatial panel window placement store rail
import { create } from 'zustand';
import type { MetaAnchorPoint, MetaWindowPlacement, MetaWindowProps } from './metaWindowTypes.ts';

/** What the panel module reports about a label. */
export type PanelEvent =
  | { type: 'requested' }
  | { type: 'opened' }
  | { type: 'failed' }
  | { type: 'closed'; reason: 'app' | 'user' };

/**
 * The placement a label moves to after `event`, in the same vocabulary as
 * Meta's `useSpatialWindowState` so callers cannot tell the backends apart.
 *
 * A panel the user closes, or one the launch failed for, is `dropped` and
 * stays dropped until its surface asks again (remounts): the in-window
 * fallback takes over instead of the panel springing back. A close the app
 * asked for returns the label to `inline`, the state of no request.
 */
export function panelPlacementAfter(event: PanelEvent): MetaWindowPlacement {
  switch (event.type) {
    case 'requested':
      return 'pending';
    case 'opened':
      return 'spatial';
    case 'failed':
      return 'dropped';
    case 'closed':
      return event.reason === 'user' ? 'dropped' : 'inline';
  }
}

interface PanelPlacementState {
  placements: Readonly<Record<string, MetaWindowPlacement>>;
  apply: (label: string, event: PanelEvent) => void;
}

/** Per-label placement of panel-hosted windows. */
export const usePanelPlacementStore = create<PanelPlacementState>((set) => ({
  placements: {},
  apply: (label, event) =>
    set((state) => ({ placements: { ...state.placements, [label]: panelPlacementAfter(event) } })),
}));

/**
 * The gap in dp between the main window and a window anchored flush outside
 * its edge with no offset, which is how `railWindow()` is anchored on Quest.
 * The anchor pins the child's right edge to the main window's left edge, and
 * Harlem Might measured that pairing on a Quest 3S at -0.4dp, twice (its
 * docs/spatial-layout/adr/0006). Meta's offsets are the only way to move it,
 * and an attached window with an offset is not drawn in-window (see below).
 */
export const ATTACHED_WINDOW_GAP_DP = 0;

/** Where a hosted window sits when PICO draws it inside the main window. */
export interface AttachedWindowFrame {
  edge: 'left';
  /** The window's own size, as on Quest. */
  widthDp: number;
  heightDp: number;
  /** Between the window and the main panel. */
  gapDp: number;
  /** The strip the main window reserves on that edge: window plus gap. */
  stripWidthDp: number;
}

function horizontalOf(point: MetaAnchorPoint): string | null {
  if (typeof point === 'string') return point;
  return point.horizontal ?? null;
}

/**
 * The in-window frame for a window Quest attaches flush outside the main
 * window's physical left edge (`{ parent: 'left', child: 'right' }`, no
 * offset), or null for every other window.
 *
 * PICO OS 5 cannot attach one activity window to another (activity windows
 * carry no parent), so an attached window drawn as its own panel floats
 * wherever the user looks. Drawn inside the main activity's window instead,
 * in a strip beside the main panel, it moves with the panel by construction.
 * Windows that are not attached (floating content panels) stay their own
 * activity panels, as on Quest.
 */
export function attachedWindowFrame(window: MetaWindowProps): AttachedWindowFrame | null {
  const anchor = window.anchor;
  if (typeof anchor !== 'object' || !('parent' in anchor)) return null;
  if (window.offset != null) return null;
  const parent = horizontalOf(anchor.parent);
  const child = horizontalOf(anchor.child);
  if (parent !== 'left' || child !== 'right') return null;
  const widthDp = Math.round(window.windowWidth);
  return {
    edge: 'left',
    widthDp,
    heightDp: Math.round(window.windowHeight),
    gapDp: ATTACHED_WINDOW_GAP_DP,
    stripWidthDp: widthDp + ATTACHED_WINDOW_GAP_DP,
  };
}

/**
 * The PICO panel's launch size in dp: the hosted window's own
 * `windowWidth` x `windowHeight`, the numbers the Quest window opens at, so
 * the two platforms cannot drift.
 */
export function panelLaunchSizeDp(window: Pick<MetaWindowProps, 'windowWidth' | 'windowHeight'>): {
  widthDp: number;
  heightDp: number;
} {
  return { widthDp: Math.round(window.windowWidth), heightDp: Math.round(window.windowHeight) };
}
