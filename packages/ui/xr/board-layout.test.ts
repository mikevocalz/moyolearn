// The 5:7 promise, and the two ways a layout silently breaks it.
//
// Ratio drift and overlap are both invisible in a still screenshot: the board
// still looks like a board, and the rail still looks like a rail, right up to
// the point where a stroke lands somewhere the child did not aim or a control
// sits under the paper's edge. Both are pinned here instead.
// SOT: packages/ui/xr/board-layout.ts
// SOT-KEYWORDS: board layout test aspect ratio 5:7 rail chat overlap constrained

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD_ASPECT, layoutBoard } from './board-layout.ts';
import { boardComposition, railWidthFor, spatialDistance } from './spatial-tokens.ts';

// The §9 starting geometry, in metres: rail 0.10, gap 0.05, chat 0.45 + 0.05.
const spatial = { W: 1.2, H: 0.9, R: 0.1, G: 0.05, minRail: 0.105 } as const;

const ratio = (l: { boardWidth: number; boardHeight: number }) => l.boardWidth / l.boardHeight;

test('the writable surface is 5:7 across every space that fits it', () => {
  const cases = [
    { ...spatial, R: 0.12 },
    { ...spatial, R: 0.12, H: 2 }, // width-bound
    { ...spatial, R: 0.12, W: 6 }, // height-bound
    { ...spatial, R: 0.12, C: 0.45, GC: 0.05 }, // chat shares the budget
    { W: 900, H: 700, R: 56, G: 12, minRail: 56 }, // dp, a 2D pane
  ];

  for (const input of cases) {
    const l = layoutBoard(input);
    assert.equal(l.fits, true);
    if (!l.fits) continue;
    assert.ok(
      Math.abs(ratio(l) - BOARD_ASPECT.w / BOARD_ASPECT.h) < 1e-12,
      `off ratio: ${ratio(l)}`,
    );
    assert.ok(l.boardWidth > 0 && l.boardHeight > 0);
    assert.ok(l.boardHeight <= input.H + 1e-12, 'board taller than the space');
  }
});

test('rail, board and chat occupy disjoint spans', () => {
  const l = layoutBoard({ ...spatial, R: 0.12, C: 0.45, GC: 0.05 });
  assert.equal(l.fits, true);
  if (!l.fits) return;

  const railRight = l.railCenterX + 0.12 / 2;
  const boardLeft = -l.boardWidth / 2;
  const boardRight = l.boardWidth / 2;
  const chatLeft = l.chatCenterX! - 0.45 / 2;

  assert.ok(railRight <= boardLeft, 'rail overlaps the paper');
  assert.ok(chatLeft >= boardRight, 'chat overlaps the paper');
  // The gaps are the ones asked for, not whatever fell out of the arithmetic.
  assert.ok(Math.abs(boardLeft - railRight - 0.05) < 1e-12);
  assert.ok(Math.abs(chatLeft - boardRight - 0.05) < 1e-12);
});

test('a space that cannot hold the rail and paper reports it instead of guessing', () => {
  const l = layoutBoard({ ...spatial, R: 0.12, W: 0.16 });
  assert.equal(l.fits, false);
  if (l.fits) return;
  assert.equal(l.miss, 'no-room');
});

test('a rail under its target floor is an answer, not an exception', () => {
  // It used to throw, which meant the only thing a constrained composition
  // could produce inside a child's session was a crash.
  const l = layoutBoard({ ...spatial, R: 0.08 });
  assert.equal(l.fits, false);
  if (l.fits) return;
  assert.equal(l.miss, 'rail-below-target');
});

test('a non-finite length still throws — it is a bug, not a small room', () => {
  assert.throws(() => layoutBoard({ ...spatial, R: 0.12, W: Number.NaN }), RangeError);
  assert.throws(() => layoutBoard({ ...spatial, R: 0.12, H: Number.POSITIVE_INFINITY }), RangeError);
});

/*
  THE REASON THE GUARD EXISTS, WITH THE COMPOSITION'S OWN NUMBERS.

  `minRail` used to arrive as `Math.min(railWidth, minHitSize(…))`, which is
  `<= R` by construction — so the rail floor could never be crossed and the
  branch above was dead code. `railWidthFor` is the undefeatable form: it
  answers what the rail has to be, and the allocated rail either is that or it
  is not.
*/
const composition = (distanceM: number, hands: boolean, band: 'young' | 'adult') => ({
  W: boardComposition.boardWidth + boardComposition.railWidth + boardComposition.railGap,
  H: (boardComposition.boardWidth * BOARD_ASPECT.h) / BOARD_ASPECT.w,
  R: boardComposition.railWidth,
  G: boardComposition.railGap,
  minRail: railWidthFor(distanceM, hands, band),
});

test('the shipped composition holds a reachable rail at the case it is sized for', () => {
  // A K–2 learner with controllers at the board's own distance: the design case
  // `railWidth` is derived from, so it must fit exactly and not by luck.
  const l = layoutBoard(composition(spatialDistance.board, false, 'young'));
  assert.equal(l.fits, true);
});

test('a rail that cannot hold the band and reach it is asked for reports it', () => {
  // Hand tracking widens the floor by a quarter, and a board pushed to the far
  // end of `comfortableUI` widens it again. Neither shrinks a child's keys now;
  // both come back as a state the caller can draw.
  for (const [what, input] of [
    ['hands, K–2, at the board distance', composition(spatialDistance.board, true, 'young')],
    ['controllers, K–2, at 2 m', composition(spatialDistance.comfortableUI.max, false, 'young')],
  ] as const) {
    const l = layoutBoard(input);
    assert.equal(l.fits, false, `${what} was reported as fitting`);
    if (l.fits) continue;
    assert.equal(l.miss, 'rail-below-target', what);
  }
});
