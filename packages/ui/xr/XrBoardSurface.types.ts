// The drawing surface's contract, in a file the Viro renderer does not own.
//
// Same reason as every other `*.types.ts` here: a type-only re-export is erased
// at build but still RESOLVED by a bundler, so naming `XrBoardSurface.native.tsx`
// from the web fork is naming `@reactvision/react-viro` on web.
// SOT: packages/ui/xr/XrBoardSurface.native.tsx
// SOT-KEYWORDS: xr board surface props types platform neutral no viro pointer draw

import type { XrSurfaceInput } from './XrPanel.types.ts';

export interface XrBoardSurfaceProps {
  /** The child's head in world metres — the arc, and so the board, is measured from it. */
  headPosition: readonly [number, number, number];
  /** The child's facing about Y, in degrees. The centre panel is flat on to it. */
  headYawDeg: number;
  /**
   * Whether a ray may draw right now.
   *
   * False parks the surface and abandons any stroke in flight rather than
   * committing it — a child whose session dropped mid-line did not finish it.
   */
  enabled: boolean;
  onSurfaceInput: (sample: XrSurfaceInput) => void;
}
