'use client';
// Pane-override persistence — the store factory over whatever synchronous
// key-value storage the platform fork hands in (MMKV native, localStorage
// web) — the `last-shell` arrangement in packages/app/providers/session,
// reused rather than re-invented. Synchronous is the requirement: the first
// render must already know the answer, or a pane flashes open and then closes
// once an async read resolves.
// SOT: ./README.md (Pane visibility: automatic policy vs manual overrides)
// SOT-KEYWORDS: pane overrides store shared storage persistence zustand factory
import { create } from 'zustand';
import type { WindowSizeClass } from './constants.ts';
import {
  clearPaneOverrides,
  togglePaneOverride,
  type PaneOverrides,
  type TogglablePane,
} from './pane-overrides.ts';

export const STORAGE_KEY = 'pane-overrides';

/** The three operations this needs. MMKV has this shape; web adapts localStorage. */
export interface PaneOverrideStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

export function readOverrides(storage: PaneOverrideStorage): PaneOverrides {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PaneOverrides;
  } catch {
    // A malformed blob means a partial write or a shape change across versions.
    // Automatic behaviour is always a safe layout, so drop it rather than
    // leaving the user with panes that will not open.
    storage.remove(STORAGE_KEY);
    return {};
  }
}

export interface PaneOverrideState {
  overrides: PaneOverrides;
  /** Toggle one pane for one size class. `visible` is what is on screen NOW. */
  toggle: (sizeClass: WindowSizeClass, pane: TogglablePane, visible: boolean) => void;
  /** Return one size class to automatic behaviour. */
  reset: (sizeClass: WindowSizeClass) => void;
}

/**
 * Overrides stay module-level (unlike the per-instance layout store): they are
 * a device-wide preference persisted across process death, not per-surface
 * state — hiding the sidebar on a tablet is a choice about the tablet.
 */
export function createPaneOverrideStore(storage: PaneOverrideStorage) {
  return create<PaneOverrideState>((set, get) => ({
    overrides: readOverrides(storage),

    toggle: (sizeClass, pane, visible) => {
      const overrides = togglePaneOverride(get().overrides, sizeClass, pane, visible);
      storage.set(STORAGE_KEY, JSON.stringify(overrides));
      set({ overrides });
    },

    reset: (sizeClass) => {
      const overrides = clearPaneOverrides(get().overrides, sizeClass);
      storage.set(STORAGE_KEY, JSON.stringify(overrides));
      set({ overrides });
    },
  }));
}
