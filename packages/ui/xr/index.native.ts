// The spatial surface's public API — native only.
//
// Everything Viro-shaped is behind this entry point and behind `.native`
// filenames, so the only way to load `@reactvision/react-viro` is to be a
// native bundle asking for `@acme/ui/xr`. The main `packages/ui/index.ts`
// barrel does not re-export any of it, which `tooling/check-barrels.mjs`
// verifies from the other direction.
// SOT: packages/ui/xr/index.web.ts
// SOT-KEYWORDS: xr index native entry point viro barrel platform fork

export { XrPanel } from './XrPanel.native.tsx';
export { XrRail, type XrRailProps } from './XrRail.native.tsx';
export {
  XrQuestionLine,
  XrPlacementControls,
  type XrQuestionLineProps,
  type XrPlacementControlsProps,
} from './XrOrnaments.native.tsx';
export { XrBoardInk, type XrBoardInkProps } from './XrBoardInk.native.tsx';
export { strokeOf, type StrokeGeometry } from './stroke-of.ts';
export {
  XrChatPanel,
  type XrChatPanelProps,
  type XrChatRow,
  type XrChatAction,
} from './XrChatPanel.native.tsx';
export { XR_MATERIAL, inkMaterial } from './spatial-materials.native.ts';
export { XR_COLOR } from './xr-colors.ts';
export {
  boardComposition,
  boardSurfacePixels,
  minHitSize,
  spatialDistance,
  spatialSpacing,
  spatialTarget,
  spatialType,
} from './spatial-tokens.ts';
export { BOARD_ASPECT, layoutBoard, type BoardLayout } from './board-layout.ts';
export type {
  XrCompanion,
  XrOrnament,
  XrPanelProps,
  XrPanelState,
  XrPlacement,
  XrSurfaceInput,
  XrVector3,
} from './XrPanel.types.ts';
