// Placement bookkeeping for windows hosted as PICO panels (a second Activity),
// kept free of native imports so node:test can drive it.
// SOT: modules/spatial-panels · src/spatial/panelWindows.tsx
// SOT-KEYWORDS: pico spatial panel window placement store rail
import { create } from 'zustand';
import type { MetaWindowPlacement, MetaWindowProps } from './metaWindowTypes.ts';

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
