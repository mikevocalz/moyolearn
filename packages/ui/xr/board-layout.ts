// Where the board, its control rail and the chat panel sit, in one unit.
//
// The spatial workspace has a promise the 2D panes never had to keep: the
// writable paper is exactly 5:7, portrait, and the rail and the chat panel are
// outside that measurement. Getting it wrong is not a visual nit — a board that
// drifts off ratio when the composition is scaled rewrites where a child's
// handwriting lands relative to where they aimed.
//
// So the ratio lives in a pure function with no renderer attached. The caller
// supplies one unit (metres in space, dp in a 2D test) and gets back centres
// and extents in that same unit. Nothing here knows what draws it, which is why
// it can be asserted without a device.
//
// SOT-KEYWORDS: whiteboard board layout aspect ratio 5:7 rail chat spatial xr geometry

/** Every length is in the SAME unit as every other. The caller picks the unit. */
export interface BoardLayoutInput {
  /** Width and height available to board + rail (+ chat, when it shares the budget). */
  W: number;
  H: number;
  /** Rail width, and the gap between rail and board. */
  R: number;
  G: number;
  /** Chat panel width and the board-to-chat gap. Omit when chat is not in this budget. */
  C?: number;
  GC?: number;
  /**
   * The narrowest rail that can hold a reachable key, in the caller's unit.
   *
   * In metres this is `railWidthFor(distanceM, handsPrimary, band)` and NOTHING
   * ELSE. It used to arrive as `Math.min(railWidth, minHitSize(…))`, which is
   * `minRail <= R` by construction — a floor that can never be crossed is not a
   * floor, and it is why the guard below had never run.
   */
  minRail: number;
}

/** Why a space could not hold the composition, so the caller can say which. */
export type BoardLayoutMiss = 'no-room' | 'rail-below-target';

export type BoardLayout =
  | { fits: false; miss: BoardLayoutMiss }
  | {
      fits: true;
      boardWidth: number;
      boardHeight: number;
      /** Centres on the composition's X axis, board centre = 0. */
      railCenterX: number;
      chatCenterX?: number;
    };

/** The writable surface is portrait 5:7. Width divided by height is 5/7, always. */
export const BOARD_ASPECT = { w: 5, h: 7 } as const;

export function layoutBoard(input: BoardLayoutInput): BoardLayout {
  const { W, H, R, G, C = 0, GC = 0, minRail } = input;

  // A non-finite length here would propagate into a transform and put ink
  // somewhere unrelated to the input that drew it, so it throws rather than
  // returning a shape the caller would render.
  if (![W, H, R, G, C, GC, minRail].every(Number.isFinite)) {
    throw new RangeError('layoutBoard: non-finite layout input');
  }
  // A rail squeezed under its target floor is an unreachable rail. The caller
  // renders the constrained state instead of shrinking a child's controls —
  // which is what the comment always said and what the code never did: this
  // threw, so the only thing a constrained composition could produce was a
  // crash inside a child's session. It is an ANSWER now, in the same shape as
  // the width miss, because "this room cannot hold a reachable rail" is a state
  // to draw and not a programming error.
  if (R < minRail) return { fits: false, miss: 'rail-below-target' };

  const widthBudget = W - R - G - (C > 0 ? C + GC : 0);
  if (widthBudget <= 0 || H <= 0) return { fits: false, miss: 'no-room' };

  // Height is the binding constraint on a portrait surface far more often than
  // width, so the board takes whichever of the two allows the full ratio.
  const boardWidth = Math.min(widthBudget, H * (BOARD_ASPECT.w / BOARD_ASPECT.h));
  const boardHeight = boardWidth * (BOARD_ASPECT.h / BOARD_ASPECT.w);

  return {
    fits: true,
    boardWidth,
    boardHeight,
    railCenterX: -(boardWidth / 2 + G + R / 2),
    chatCenterX: C > 0 ? boardWidth / 2 + GC + C / 2 : undefined,
  };
}
