// Picks the build's spatial window backend once, at module load.
// SOT: src/spatial/metaWindows.ts · src/spatial/panelWindows.tsx
// SOT-KEYWORDS: spatial window backend quest pico meta panel
import type { MetaWindowPlacement } from './metaWindowTypes';
import { metaWindows } from './metaWindows';
import { panelWindows } from './panelWindows';

export type SpatialWindowBackend = {
  readonly linked: boolean;
  usePlacement: (label: string) => MetaWindowPlacement;
  useSpatialAvailable: () => boolean;
};

/**
 * Meta's layout SDK where it is linked (quest), PICO's panel activity where
 * it is declared (pico), otherwise Meta's unlinked facade, which reports
 * `inline` for everything. The two never coexist: each is gated on its own
 * flavor. Chosen once so no component switches hook implementations between
 * renders.
 */
export const spatialWindows: SpatialWindowBackend = metaWindows.linked
  ? metaWindows
  : panelWindows.linked
    ? panelWindows
    : metaWindows;
