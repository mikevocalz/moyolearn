// The spatial chat companion's contract, in a file the Viro renderer does not own.
//
// Same reason as `tutor-xr-screen.types.ts`: a type-only re-export is erased at
// build but still RESOLVED by a bundler, so naming `XrChatPanel.native.tsx`
// from the web fork is naming `@reactvision/react-viro` on web. The row, action
// and panel shapes live here, and `web-condition.test.ts` holds that line
// mechanically.
// SOT: packages/ui/xr/XrChatPanel.native.tsx · packages/app/features/tutor/tutor-xr-screen.types.ts
// SOT-KEYWORDS: xr chat panel props types rows actions platform neutral no viro

import type { SpatialBand } from './spatial-tokens.ts';

/** A turn, reduced to what a spatial row can honestly show. */
export interface XrChatRow {
  id: string;
  role: 'learner' | 'tutor';
  text: string;
  /** How many attachments the turn carried, named rather than rendered. */
  attachments?: number;
}

/** An action the live turn offers — Try it, Next hint, Back to plan. */
export interface XrChatAction {
  id: string;
  label: string;
  onPress: () => void;
}

export interface XrChatPanelProps {
  width: number;
  height: number;
  distanceM: number;
  handsPrimary: boolean;
  /** Sizes the live turn's action keys. Required — see `XrRailProps.band`. */
  band: SpatialBand;
  tutorName: string;
  /** Here / Speaking / Thinking / Listening — `statusFor(state)`'s answer. */
  status: string;
  /** The band's assurance line, unchanged from the 2D presence rail. */
  assurance: string;
  /** Oldest first. The caller windows this; the panel does not scroll. */
  rows: readonly XrChatRow[];
  /** How many turns are above the window, so "earlier" is honest. */
  earlierCount: number;
  /**
   * How many board records the headset could not draw — `XrBoardInk`'s count.
   *
   * Required for the same reason `band` is. An optional count defaults to
   * silence, and silence is precisely the failure: the child's typed note is
   * missing from the paper and nothing on the screen says so. Zero renders
   * nothing, so an honest board costs no pixels.
   */
  skippedCount: number;
  actions?: readonly XrChatAction[];
  /** True in `ended` and `crisis`, when the 2D composer locks too. */
  inputLocked: boolean;
}
