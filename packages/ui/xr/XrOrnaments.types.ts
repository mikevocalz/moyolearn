// The ornaments' contracts, in a file the Viro renderer does not own.
//
// Same reason as `tutor-xr-screen.types.ts`: a type-only re-export is erased at
// build but still RESOLVED by a bundler, so naming `XrOrnaments.native.tsx`
// from the web fork is naming `@reactvision/react-viro` on web. The question
// line and placement control props live here, and `web-condition.test.ts` holds
// that line mechanically.
// SOT: packages/ui/xr/XrOrnaments.native.tsx · packages/app/features/tutor/tutor-xr-screen.types.ts
// SOT-KEYWORDS: xr ornaments props types question line placement controls platform neutral no viro

import type { SpatialBand } from './spatial-tokens.ts';

export interface XrQuestionLineProps {
  text: string;
  width: number;
}

export interface XrPlacementControlsProps {
  width: number;
  distanceM: number;
  handsPrimary: boolean;
  /** Sizes every key. Required and undefaulted — see `XrRailProps.band`. */
  band: SpatialBand;
  onRecenter: () => void;
  onExit: () => void;
}
