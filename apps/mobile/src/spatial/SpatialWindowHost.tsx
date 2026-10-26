// Root host that renders every promoted window at the main surface origin.
// SOT: Harlem Might docs/spatial-layout/adr/0005-spatial-shell-rail-window.md
// SOT-KEYWORDS: spatial window host origin pressability quest rail
import { View } from '@acme/ui/tw';
import { metaWindows } from './metaWindows';
import { PanelWindowHost, panelWindows } from './panelWindows';
import { useSpatialWindowHostStore } from './spatialWindowHost.store';

/**
 * Renders every hosted `<SpatialWindow>` at the main surface's origin. Mount
 * it once, near the app root, inside `metaWindows.SceneProvider`.
 *
 * Why the origin (Harlem Might ADR 0005): Meta's `SpatialWindowRootViewGroup`
 * dispatches touches with `pageX/pageY` relative to the promoted window, while
 * RN's Pressability measures the pressed view in the main surface. Content
 * declared deep in a layout sits hundreds of dp from the origin, so the first
 * MOVE of a controller ray or a pinch reads as leaving the press rectangle and
 * cancels the press. Hosted at (0,0), a view's main-surface position equals
 * its position inside the window, and presses complete.
 *
 * Windows render with `fallback: 'drop'`, so nothing ever draws inline at the
 * origin; a surface whose window is dropped draws its own in-window fallback
 * (see `useHostedSpatialWindow`).
 *
 * On pico builds the same store drives `PanelWindowHost` and `PicoMainFrame`:
 * windows Quest attaches outside the main window's left edge (the rail) draw
 * in the main window's own strip, and `PanelWindowHost` opens each other
 * window as its own Activity panel instead. Renders nothing where neither
 * backend is linked.
 */
export function SpatialWindowHost() {
  const windows = useSpatialWindowHostStore((state) => state.windows);
  if (!metaWindows.linked) return panelWindows.linked ? <PanelWindowHost /> : null;
  return (
    <View className="absolute left-0 top-0 h-0 w-0" pointerEvents="box-none">
      {Object.values(windows).map(({ window, content }) => (
        <metaWindows.Window key={window.label} window={{ ...window, fallback: 'drop' }}>
          {content}
        </metaWindows.Window>
      ))}
    </View>
  );
}
