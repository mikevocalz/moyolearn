// Zustand registry of the windows the root SpatialWindowHost renders.
// SOT: Harlem Might docs/spatial-layout/adr/0005-spatial-shell-rail-window.md
// SOT-KEYWORDS: spatial window host store zustand rail
import type { ReactNode } from 'react';
import { create } from 'zustand';
import type { MetaWindowProps } from './metaWindowTypes.ts';

/** One window the root host renders: its `SpatialWindow` props and content. */
export interface HostedSpatialWindow {
  window: MetaWindowProps;
  content: ReactNode;
}

interface SpatialWindowHostState {
  /** Mounted windows by label, in mount order. */
  windows: Readonly<Record<string, HostedSpatialWindow>>;
  /** Adds or replaces the window with this label. */
  mount: (entry: HostedSpatialWindow) => void;
  /** Removes the window with this label. A label that is not mounted is ignored. */
  unmount: (label: string) => void;
}

/**
 * The windows {@linkcode SpatialWindowHost} renders at the main surface's
 * origin (Harlem Might docs/spatial-layout/adr/0005). Surfaces add themselves
 * with `useHostedSpatialWindow` instead of rendering `<SpatialWindow>` where
 * they are declared.
 */
export const useSpatialWindowHostStore = create<SpatialWindowHostState>((set) => ({
  windows: {},
  mount: (entry) =>
    set((state) => ({ windows: { ...state.windows, [entry.window.label]: entry } })),
  unmount: (label) =>
    set((state) => {
      if (!(label in state.windows)) return state;
      const { [label]: _removed, ...rest } = state.windows;
      return { windows: rest };
    }),
}));
