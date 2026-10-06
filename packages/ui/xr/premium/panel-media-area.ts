// Shared media-plane geometry for the panel, its pointer, and the ink layer.
// Keep the actual panel renderer and all its non-XR typecheck consumers on one
// set of dimensions.
import { BOARD_ASPECT } from '../board-layout.ts';
import { spatialCorners } from '../spatial-tokens.ts';
import { panelSize } from './spatialTokens.ts';

export const HEADER_H = 0.16;
export const MEDIA_ART_Z = 0.004;

export const SIZES = {
  compactCard: panelSize.compactCard,
  standardCard: panelSize.standardCard,
  /* 0.85: the conversation column wraps hard at 0.62 — chat rows are text,
     and text needs width. On the 2.6 m arc at 34° azimuth the inner edge still
     clears the centre board's outer edge by ~14°. */
  portraitCard: { width: 0.85, height: 1.1 },
  toolsCard: { width: 0.9, height: 1.42 },
  boardPanel: {
    width: 0.9 + spatialCorners.panel * 2,
    height: 0.9 * BOARD_ASPECT.h / BOARD_ASPECT.w + HEADER_H + spatialCorners.panel * 2,
  },
  widePanel: panelSize.widePanel,
  theaterPanel: panelSize.theaterPanel,
} as const;

/** The image and input rectangle below the panel header, in panel-local metres. */
export function panelMediaArea(size: keyof typeof SIZES): {
  width: number;
  height: number;
  centerY: number;
  z: number;
} {
  const { width, height } = SIZES[size];
  const inset = size === 'boardPanel' ? spatialCorners.panel : 0;
  return {
    width: width - inset * 2,
    height: height - HEADER_H - inset * 2,
    centerY: -HEADER_H / 2,
    z: MEDIA_ART_Z,
  };
}
