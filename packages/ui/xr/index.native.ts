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
export { XrBoardTray } from './XrBoardTray.native.tsx';
export { worldSlot, xrRotateY, type XrWorldPose } from './world-slot.ts';
export { probePremiumImports } from './premium/probe.ts';
export type { XrTriPanelProps, XrPanelRow } from './XrTriPanel.types.ts';
export type { XrBoardSurfaceProps } from './XrBoardSurface.types.ts';
export {
  PremiumXRMediaPanel,
  SLOTS,
  SIZES,
  panelMediaArea,
  type MediaPanelRow,
  type PanelSlot,
} from './premium/index.ts';
export { uncoveredRecords } from './raster-coverage.ts';
export { natalieMorphs, MORPH_FLOOR } from './natalie-morphs.ts';
export type { NatalieMorph, NatalieShape } from './natalie-morphs.ts';
export { strokeOf, type StrokeGeometry } from './stroke-of.ts';
export { XrChatPanel } from './XrChatPanel.native.tsx';
/* Values from the `.native` files, contracts from the `.types` files — the
   same split the web fork reads, so both platforms name one shape. */
export type { XrRailProps } from './XrRail.types.ts';
export type { XrBoardTrayProps } from './XrBoardTray.types.ts';
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
  boardTrayGrid,
  boardTrayHeight,
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
/* Pure geometry + command vocabulary for the Rive-framed board — no renderer. */
export {
  CHROME_ARTBOARD,
  CONTENT_BAND,
  CONTENT_RECT_PANEL,
  INK_ROW,
  PANEL_HEIGHT_M,
  PANEL_WIDTH_M,
  TITLE_BAND,
  TOOLBAR_BAND,
  TOOL_ROW,
  artboardCenter,
  artboardToPanel,
  contentAnchorWorld,
  type ArtboardRect,
  type PanelRect,
} from './board-chrome-layout.ts';
export {
  BOARD_COMMAND,
  decodeBoardCommand,
  inkToRive,
  toolToRive,
  type BoardChromeIntent,
} from './board-chrome-commands.ts';
export type {
  XrCompanion,
  XrOrnament,
  XrPanelProps,
  XrPanelState,
  XrPlacement,
  XrSurfaceInput,
  XrVector3,
} from './XrPanel.types.ts';
/* The dynamic question panel — pure contracts, resolver and geometry; the
   renderer composition lives in `XrQuestionPanel` and is not part of this
   export yet. */
export {
  QUESTION_COMMAND,
  decodeQuestionCommand,
  phaseToRive,
  type QuestionChromeIntent,
} from './question-commands.ts';
export {
  QUESTION_ARTBOARD,
  QUESTION_CHOICE_RAIL,
  QUESTION_CONTENT_BAND,
  QUESTION_CONTENT_RECT_PANEL,
  QUESTION_FOOTER_BAND,
  QUESTION_HEADER_BAND,
  QUESTION_PANEL_HEIGHT_M,
  QUESTION_PANEL_WIDTH_M,
  QUESTION_SCALE,
  questionArtboardCenter,
  questionArtboardToPanel,
  questionSurfacePixels,
  type QuestionArtboardRect,
  type QuestionPanelRect,
} from './question-chrome-layout.ts';
export {
  resolveQuestionLayout,
  type QuestionLayout,
  type QuestionLayoutKind,
  type QuestionLayoutViewport,
} from './question-layout.ts';
export {
  MAX_RIVE_CHOICES,
  type LearningSubject,
  type QuestionChoice,
  type QuestionEvaluation,
  type QuestionInteraction,
  type XrAnswerDraft,
  type XrLearningQuestion,
  type XrQuestionFeedback,
  type XrQuestionOutcome,
  type XrQuestionPhase,
} from './question-contract.ts';
export {
  type DiagramLabel,
  type MapMarker,
  type QuestionContentBlock,
  type QuestionContentBlockType,
  type QuestionMediaSource,
  type StructuredChart,
  type TableCell,
  type TableColumn,
  type TableRow,
  type TimelineEvent,
} from './question-content.ts';
export { criticalMediaOf, secondaryMediaOf } from './question-ready.ts';
export {
  normalizeXrQuestion,
  type NormalizedQuestion,
} from './question-normalize.ts';
export {
  SUBJECT_CAPABILITIES,
  interactionSupported,
  type SubjectCapabilities,
} from './question-capabilities.ts';
export {
  XR_FIXTURE_SEQUENCE,
  XR_QUESTION_FIXTURES,
  fixtureById,
} from './question-fixtures.ts';
export { XrQuestionContent } from './QuestionContent.native.tsx';
export type {
  QuestionContentProps,
  QuestionMediaResolver,
} from './QuestionContent.types.ts';
