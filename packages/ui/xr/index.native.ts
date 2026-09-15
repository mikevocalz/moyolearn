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
export { XrRail } from './XrRail.native.tsx';
export { XrQuestionLine, XrPlacementControls } from './XrOrnaments.native.tsx';
export { XrBoardInk } from './XrBoardInk.native.tsx';
export { XrBoardRaster } from './XrBoardRaster.native.tsx';
export { XrBoardLive } from './XrBoardLive.native.tsx';
export { BoardTextureHost } from './BoardTextureHost.native.tsx';
export { XrTriPanel } from './XrTriPanel.native.tsx';
export { XrBoardSurface } from './XrBoardSurface.native.tsx';
export { worldSlot, xrRotateY, type XrWorldPose } from './world-slot.ts';
export { probePremiumImports } from './premium/probe.ts';
export type { XrTriPanelProps, XrPanelRow } from './XrTriPanel.types.ts';
export type { XrBoardSurfaceProps } from './XrBoardSurface.types.ts';
export { PremiumXRMediaPanel, SLOTS, type MediaPanelRow, type PanelSlot } from './premium/index.ts';
export { uncoveredRecords } from './raster-coverage.ts';
export { natalieMorphs, MORPH_FLOOR } from './natalie-morphs.ts';
export type { NatalieMorph, NatalieShape } from './natalie-morphs.ts';
export { strokeOf, type StrokeGeometry } from './stroke-of.ts';
export { XrChatPanel } from './XrChatPanel.native.tsx';
/* Values from the `.native` files, contracts from the `.types` files — the
   same split the web fork reads, so both platforms name one shape. */
export type { XrRailProps } from './XrRail.types.ts';
export type { XrBoardInkProps } from './XrBoardInk.types.ts';
export type { XrBoardRasterProps } from './XrBoardRaster.types.ts';
export type { XrBoardLiveProps } from './XrBoardLive.types.ts';
export type {
  BoardTextureBinding,
  BoardTextureHostProps,
} from './BoardTextureHost.types.ts';
export type { XrChatPanelProps, XrChatRow, XrChatAction } from './XrChatPanel.types.ts';
export type { XrQuestionLineProps, XrPlacementControlsProps } from './XrOrnaments.types.ts';
export { XR_MATERIAL, inkMaterial } from './material-names.ts';
/* `registerXrMaterials` is deliberately NOT re-exported. It registers at module
   load and every `Xr*.native.tsx` in this barrel imports that module directly,
   so the materials exist before any of them can name one. Exporting it invited
   a scene to call it again — which cost a red typecheck here, because the web
   barrel has no such name to answer with, and could not have helped anyway. */
export { XR_COLOR, XR_SURFACE } from './xr-colors.ts';
export {
  boardComposition,
  boardLayer,
  boardSurfacePixels,
  minHitSize,
  railContentHeight,
  railGrid,
  railWidthFor,
  spatialDistance,
  spatialFontSize,
  spatialLabelFontSize,
  spatialLabelScale,
  spatialLayer,
  spatialSpacing,
  spatialTarget,
  spatialTextHeight,
  spatialType,
  type SpatialBand,
  type SpatialTypeStep,
} from './spatial-tokens.ts';
export {
  BOARD_ASPECT,
  layoutBoard,
  type BoardLayout,
  type BoardLayoutMiss,
} from './board-layout.ts';
export { placeInFrontOf, type XrHeadPose, type XrPlaceInput } from './board-placement.ts';
export type {
  XrCompanion,
  XrOrnament,
  XrPanelProps,
  XrPanelState,
  XrPlacement,
  XrSurfaceInput,
  XrVector3,
} from './XrPanel.types.ts';
