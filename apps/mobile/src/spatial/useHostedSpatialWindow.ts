// The one seam a surface uses to ask for its own OS window.
// SOT: src/spatial/SpatialWindowHost.tsx · Harlem Might docs/spatial-layout/adr/0005
// SOT-KEYWORDS: spatial window hook hosted placement fallback quest pico
import { useLayoutEffect, type ReactNode } from 'react';
import type { MetaWindowPlacement, MetaWindowProps } from './metaWindowTypes';
import { spatialWindows } from './spatialWindows';
import { useSpatialWindowHostStore } from './spatialWindowHost.store';

/**
 * Asks for `content` to show in its own OS window, rendered by
 * {@linkcode SpatialWindowHost}: a Meta spatial window on quest builds, a
 * second Activity panel on pico builds, or the main window's left strip for a
 * window Quest attaches to that edge (see `spatialWindows.ts`).
 *
 * Returns the window's placement. Render the in-window fallback yourself
 * whenever it is not `spatial`: `pending` while the OS places it, `dropped`
 * when capacity, an error or the user closing it refused it, `inline` where
 * nothing asks for a window. The host never draws the content inline.
 *
 * Pass `window: null` to stay in the main window. On builds with neither
 * backend, the window is never requested and the result is always `inline`.
 *
 * `content` renders outside the caller's tree position, so it sees the app
 * root's providers only (on PICO, only the panel root's). Wrap it in any
 * context it needs.
 */
export function useHostedSpatialWindow(
  window: MetaWindowProps | null,
  content: ReactNode,
): MetaWindowPlacement {
  const spatialAvailable = spatialWindows.useSpatialAvailable();
  const requested = window != null && spatialWindows.linked && spatialAvailable ? window : null;
  const label = requested?.label;
  const placement = spatialWindows.usePlacement(label ?? '');
  const mount = useSpatialWindowHostStore((state) => state.mount);
  const unmount = useSpatialWindowHostStore((state) => state.unmount);

  useLayoutEffect(() => {
    if (requested) mount({ window: requested, content });
  });
  useLayoutEffect(() => {
    if (label == null) return;
    return () => unmount(label);
  }, [label, unmount]);

  return requested ? placement : 'inline';
}
