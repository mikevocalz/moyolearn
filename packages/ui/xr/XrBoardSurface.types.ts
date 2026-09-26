// The drawing surface's contract, in a file the Viro renderer does not own.
//
// Same reason as every other `*.types.ts` here: a type-only re-export is erased
// at build but still RESOLVED by a bundler, so naming `XrBoardSurface.native.tsx`
// from the web fork is naming `@reactvision/react-viro` on web.
// SOT: packages/ui/xr/XrBoardSurface.native.tsx
// SOT-KEYWORDS: xr board surface props types platform neutral no viro pointer draw

import type { XrSurfaceInput } from './XrPanel.types.ts';

export interface XrBoardSurfaceProps {
  /**
   * The child's head in world metres — the arc, and so the board, is measured
   * from it. Ignored when `anchor` is set: the caller has already resolved the
   * content rect's world pose (a dragged carrier has moved since the head
   * settled, so the slot alone is no longer where the paper is).
   */
  headPosition: readonly [number, number, number];
  /** The child's facing about Y, in degrees. Ignored when `anchor` is set. */
  headYawDeg: number;
  /**
   * The surface's world anchor and extent, when the default does not apply.
   *
   * DEFAULT: `worldSlot('center')` + `panelMediaArea('boardPanel')` — the board
   * sized panel measured from the head. OVERRIDE for the Rive-framed panel:
   * the chrome's `contentRect` is already resolved into carrier-world metres
   * (`board-chrome-layout.ts`), and the surface must cover exactly that rect —
   * never the whole panel — so rays over the toolbar fall through to the Rive
   * quad while rays over the paper draw. That geometric partition IS the
   * input arbitration; there is no router to add.
   */
  anchor?: { position: readonly [number, number, number]; yawDeg: number };
  area?: { width: number; height: number };
  /**
   * Whether a ray may draw right now.
   *
   * False parks the surface and abandons any stroke in flight rather than
   * committing it — a child whose session dropped mid-line did not finish it.
   */
  enabled: boolean;
  termination?: { source: number; cancel: boolean; revision: number };
  onSurfaceInput: (sample: XrSurfaceInput) => void;
}
