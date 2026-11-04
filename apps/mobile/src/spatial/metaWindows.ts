// The app's single Meta VR Layout SDK facade, live in the quest flavor only.
// SOT: src/spatial/metaWindowsCore.ts · Harlem Might apps/mobile/src/spatial/metaWindows.ts
// SOT-KEYWORDS: spatial window meta layout sdk quest horizon rail facade
import { isHorizonBuild } from './horizonBuild';
import { createMetaWindows, type MetaLayoutModules } from './metaWindowsCore';

/**
 * Elsewhere the requires below never run and every window renders inline.
 * The shell rail (`ShellTabBar`) is the only window today; every window
 * renders from `SpatialWindowHost` at the main surface's origin.
 */
export const metaWindows = createMetaWindows(isHorizonBuild, () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const layout = require('@metavr/layout-compat');
  const window = require('@metavr/layout-window-compat');
  const owners = require('../../modules/spatial-window-owners');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    layout: {
      SpatialSceneProvider: layout.SpatialSceneProvider,
      useSpatialScene: layout.useSpatialScene,
    },
    window: {
      SpatialWindow: window.SpatialWindow,
      createWindowScene: window.createWindowScene,
      useSpatialWindowState: window.useSpatialWindowState,
    },
    windowOwners: owners.SpatialWindowOwners,
  } as MetaLayoutModules;
});
