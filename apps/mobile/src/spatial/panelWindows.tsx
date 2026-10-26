// Hosted spatial windows on PICO: each one a second Activity panel rendering
// its content from the shared window store on the app's one ReactHost.
// SOT: modules/spatial-panels · src/spatial/panelWindowsCore.ts
// SOT-KEYWORDS: pico spatial panel window host activity rail
import { useEffect, useRef } from 'react';
import { AppRegistry } from 'react-native';
import { SafeAreaProvider, whenLaunchPermissionsAsked } from '@acme/app';
import { View } from '@acme/ui/tw';
import { spatialPanels } from '../../modules/spatial-panels';
import type { MetaWindowPlacement } from './metaWindowTypes';
import { panelLaunchSizeDp, usePanelPlacementStore } from './panelWindowsCore';
import { useSpatialWindowHostStore } from './spatialWindowHost.store';

/*
  PICO, NOT META'S SDK. `@metavr/layout-compat`'s `HorizonSpatialCapability`
  checks `hasSystemFeature("horizonos.software.horizon_os")` and then asks for
  `metavr.app.volumetricwindow.VolumetricWindowManager`, a Horizon framework
  service, logging "Not a HorizonOS device — inline fallback mode" otherwise
  (javap of layout-react-compat 1.0.0). On a PICO it can never promote. PICO's
  own WindowContainer API (Spatial SDK 6) needs PICO OS 6 framework classes the
  PICO 4 Ultra on OS 5 does not have. What both OSes run is Android's own
  multi-window launch: a second Activity in its own task, which PICO places in
  its own window container. The OS chooses where that panel opens; unlike the
  quest rail it cannot be pinned to the main panel's left edge.
*/

const PREFIX = 'MoyoSpatialPanel.';
const LABEL_PROP = 'label';

/** The panel module's name for `label`'s surface. One registered component per label. */
function componentFor(label: string): string {
  return PREFIX + label;
}

function labelOf(name: string): string | null {
  return name.startsWith(PREFIX) ? name.slice(PREFIX.length) : null;
}

/**
 * The root of a panel's surface. The surface has none of the main tree's
 * providers, so the ones window content leans on are re-created here. The
 * content itself comes from the same store the main tree writes, which works
 * because the panel shares the main window's JS runtime.
 */
function SpatialPanelRoot(props: Record<string, string | undefined>) {
  const label = props[LABEL_PROP] ?? '';
  const content = useSpatialWindowHostStore((state) => state.windows[label]?.content ?? null);
  return (
    <SafeAreaProvider>
      <View className="flex-1">{content}</View>
    </SafeAreaProvider>
  );
}

const linked = spatialPanels.isAvailable;
const usePanelPlacement = (label: string): MetaWindowPlacement =>
  usePanelPlacementStore((state) => state.placements[label] ?? 'pending');

/** The PICO backend of `useHostedSpatialWindow`. Never linked off the pico build. */
export const panelWindows = {
  linked,
  usePlacement: linked ? usePanelPlacement : (): MetaWindowPlacement => 'inline',
  useSpatialAvailable: (): boolean => linked,
};

/**
 * Opens a panel for each window in the host store and closes it when the
 * window leaves the store. A label the user closed stays closed (and its
 * surface draws its in-window fallback) until the label is mounted afresh.
 */
export function PanelWindowHost() {
  const windows = useSpatialWindowHostStore((state) => state.windows);
  const apply = usePanelPlacementStore((state) => state.apply);
  const requested = useRef(new Set<string>());

  useEffect(() => {
    const opened = spatialPanels.addOnPanelOpenedListener(({ name }) => {
      const label = labelOf(name);
      if (label != null) apply(label, { type: 'opened' });
    });
    const closed = spatialPanels.addOnPanelClosedListener(({ name, reason }) => {
      const label = labelOf(name);
      if (label != null) apply(label, { type: 'closed', reason });
    });
    return () => {
      opened.remove();
      closed.remove();
    };
  }, [apply]);

  useEffect(() => {
    const labels = new Set(Object.keys(windows));
    for (const label of labels) {
      if (requested.current.has(label)) continue;
      requested.current.add(label);
      const name = componentFor(label);
      AppRegistry.registerComponent(name, () => SpatialPanelRoot);
      apply(label, { type: 'requested' });
      // PICO opens a panel centered in front of the main window, which would
      // cover the launch permission dialog; open once those are answered.
      whenLaunchPermissionsAsked()
        .then(() => {
          if (!requested.current.has(label)) return;
          const entry = useSpatialWindowHostStore.getState().windows[label];
          if (!entry) return;
          return spatialPanels.openPanel(name, panelLaunchSizeDp(entry.window), { [LABEL_PROP]: label });
        })
        .catch((error: Error) => {
          console.warn(`[panelWindows] ${label} panel did not open: ${error.message}`);
          apply(label, { type: 'failed' });
        });
    }
    for (const label of requested.current) {
      if (labels.has(label)) continue;
      requested.current.delete(label);
      void spatialPanels.closePanel(componentFor(label));
    }
  }, [windows, apply]);

  return null;
}
