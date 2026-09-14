// The same entry point on web, which renders no XR and loads no renderer.
//
// THERE IS NO XR ON WEB, and this file is how that is enforced rather than
// hoped for. `@reactvision/react-viro` publishes `dist/index.js` as its only
// entry and ships no web build of `ViroXRSceneNavigator`, so a web bundle that
// reaches it pulls native-only modules into `app.moyolearn.com` — and a headset
// whiteboard behind a browser tab would not be the feature anyway.
//
// What web DOES get is the pure things: the 5:7 layout function and the spatial
// tokens, which are arithmetic and constants. They are exported here because
// the same numbers describe the 2D board's geometry in tests, and because a
// shared entry point that answers "nothing" for half its names is an entry
// point every caller has to branch on.
// SOT: packages/ui/xr/index.native.ts
// SOT-KEYWORDS: xr index web entry point no viro unsupported platform fork stub

export {
  XrPanel,
  XrRail,
  XrBoardInk,
  XrChatPanel,
  XrQuestionLine,
  XrPlacementControls,
} from './unsupported.web.tsx';
/* The prop types come from `.types.ts` files, never from the `.native` files
   that implement them. A type-only re-export is erased at build, but the
   specifier is still RESOLVED by a bundler — naming `XrRail.native.tsx` here
   would put Viro on the web resolver's path. See `web-condition.test.ts`. */
/* Names, not renderers — see `material-names.ts`. */
export { XR_MATERIAL, inkMaterial } from './material-names.ts';

export type { XrRailProps } from './XrRail.types.ts';
export type { XrBoardInkProps } from './XrBoardInk.types.ts';
export type {
  XrChatPanelProps,
  XrChatRow,
  XrChatAction,
} from './XrChatPanel.types.ts';
export type {
  XrQuestionLineProps,
  XrPlacementControlsProps,
} from './XrOrnaments.types.ts';
/* Colour constants are plain strings off the token file — no renderer in them,
   so the web fork answers with the same values rather than with nothing. */
export { XR_COLOR, XR_SURFACE } from './xr-colors.ts';
export {
  boardComposition,
  boardSurfacePixels,
  minHitSize,
  railContentHeight,
  railGrid,
  railWidthFor,
  spatialDistance,
  spatialFontSize,
  spatialSpacing,
  spatialTarget,
  spatialTextHeight,
  spatialType,
  type SpatialBand,
} from './spatial-tokens.ts';
export {
  BOARD_ASPECT,
  layoutBoard,
  type BoardLayout,
  type BoardLayoutMiss,
} from './board-layout.ts';
/* Pure, so web gets it too — it is a parser, not a renderer. */
export { strokeOf, type StrokeGeometry } from './stroke-of.ts';
export type {
  XrCompanion,
  XrOrnament,
  XrPanelProps,
  XrPanelState,
  XrPlacement,
  XrSurfaceInput,
  XrVector3,
} from './XrPanel.types.ts';
