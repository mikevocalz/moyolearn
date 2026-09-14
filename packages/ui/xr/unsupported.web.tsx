'use client';
// The spatial components on web: present in the type system, absent on screen.
//
// THERE IS NO XR ON WEB, and these are how that is said without making every
// caller branch. The names exist so `@acme/ui/xr` is one shape on both
// platforms — the convention `brand`, `haptics` and `icons` already follow in
// this package — and each renders nothing, because there is no headset behind a
// browser tab and no web build of `ViroXRSceneNavigator` to pretend with.
//
// Nothing here imports `@reactvision/react-viro`, and nothing here NAMES a
// `.native` file either — not even for a type, because a type-only import is
// erased at build but still resolved by a bundler. That is the whole point: a
// web bundle that resolves this file must not pull a native-only renderer into
// `app.moyolearn.com`. `web-condition.test.ts` walks the resolved graph and
// fails if it ever does.
//
// The route a child could reach never renders these — `tutor-xr-entry.tsx` says
// where their board actually is, in words, before it gets this far.
// SOT: packages/ui/xr/index.native.ts · packages/app/features/tutor/tutor-xr-entry.tsx
// SOT-KEYWORDS: xr web stub unsupported no viro null render platform fork

import type { XrPanelProps } from './XrPanel.types.ts';
import type { XrRailProps } from './XrRail.types.ts';
import type { XrBoardInkProps } from './XrBoardInk.types.ts';
import type { XrBoardRasterProps } from './XrBoardRaster.types.ts';
import type { XrChatPanelProps } from './XrChatPanel.types.ts';
import type { XrQuestionLineProps, XrPlacementControlsProps } from './XrOrnaments.types.ts';

export function XrPanel(_props: XrPanelProps) {
  return null;
}
export function XrRail(_props: XrRailProps) {
  return null;
}
export function XrBoardInk(_props: XrBoardInkProps) {
  return null;
}
export function XrBoardRaster(_props: XrBoardRasterProps) {
  return null;
}
export function XrChatPanel(_props: XrChatPanelProps) {
  return null;
}
export function XrQuestionLine(_props: XrQuestionLineProps) {
  return null;
}
export function XrPlacementControls(_props: XrPlacementControlsProps) {
  return null;
}
