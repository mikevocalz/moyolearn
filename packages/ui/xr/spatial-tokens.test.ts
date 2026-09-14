// Every spatial control, measured against the floor it claims to sit on.
//
// The whole feature's hit sizing is one function and a handful of multipliers,
// and it shipped with every control in the scene under 4° — the rail's keys at
// 3.82°, Clear at 3.06°, the ink swatches at 2.67°, the placement and chat keys
// at 2.40°. Nothing noticed, because an under-sized target in a headset is not
// visible in a screenshot: it looks exactly like a target that works, until a
// six-year-old points at it.
//
// So the angles are asserted rather than described. These tests are the reason
// the `Math.min` clamp cannot come back, and the reason a band that stops
// arriving is a red test rather than a child with an adult's controls.
// SOT: packages/ui/xr/spatial-tokens.ts · docs/design/xr-whiteboard/03-design-system.md §6
// SOT-KEYWORDS: spatial tokens test hit target angle floor band multiplier rail font size

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { targets } from '@acme/theme';
import {
  boardComposition,
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
} from './spatial-tokens.ts';

const BANDS = ['young', 'child', 'teen', 'adult'] as const satisfies readonly SpatialBand[];

/** The angle a size of `metres` subtends at `distanceM`, in degrees. */
const degrees = (metres: number, distanceM: number): number =>
  (2 * Math.atan(metres / 2 / distanceM) * 180) / Math.PI;

test('the floor is the floor, at every distance and in both input modes', () => {
  for (const distanceM of [
    spatialDistance.comfortableUI.min,
    spatialDistance.board,
    spatialDistance.comfortableUI.max,
  ]) {
    for (const hands of [false, true]) {
      for (const band of BANDS) {
        const angle = degrees(minHitSize(distanceM, hands, band), distanceM);
        assert.ok(
          angle >= spatialTarget.minAngleDeg - 1e-9,
          `${band} / hands=${hands} / ${distanceM}m is ${angle.toFixed(2)}°`,
        );
      }
    }
  }
});

test('the band multiplier is the 2D target ramp and not a second opinion', () => {
  const px = (token: string) => Number.parseFloat(token);
  assert.equal(spatialTarget.bandMultiplier.adult, 1);
  assert.equal(spatialTarget.bandMultiplier.young, px(targets.young) / px(targets.adult));
  // Monotonic, in the direction the 2D bands already ramp: younger reads bigger.
  assert.ok(
    spatialTarget.bandMultiplier.young > spatialTarget.bandMultiplier.child &&
      spatialTarget.bandMultiplier.child > spatialTarget.bandMultiplier.teen &&
      spatialTarget.bandMultiplier.teen > spatialTarget.bandMultiplier.adult,
  );
});

test('a K-2 learner gets a bigger spatial target than an adult, at the same distance', () => {
  const young = minHitSize(spatialDistance.board, false, 'young');
  const adult = minHitSize(spatialDistance.board, false, 'adult');
  assert.ok(young > adult, 'the band never reached the derivation');
  // The same ratio their 2D targets have: 72 dp to 44 dp.
  assert.ok(Math.abs(young / adult - 72 / 44) < 1e-12);
});

test('the rail token is wide enough to hold a floor-sized key inside its padding', () => {
  // `XrRail` lays its keys out inside a `spatialSpacing.xs` padding on each
  // side and between each pair, so a rail exactly one key wide is a rail that
  // squeezes every key.
  const key = minHitSize(spatialDistance.board, false, 'young');
  assert.ok(
    boardComposition.railWidth >=
      key * railGrid.columns + spatialSpacing.xs * (railGrid.columns + 1) - 1e-12,
  );
  assert.equal(boardComposition.railWidth, railWidthFor(spatialDistance.board, false, 'young'));
});

test('the rail fits its own controls inside the paper it hangs beside', () => {
  /*
    THE DEFECT THIS REPLACES IS ARITHMETIC AND WAS TRUE FOR EVERY SESSION. The
    rail drew eight keys and a separator in one column — 1.4714 m of content in
    a 0.72 m box at the `young` band, 2.0× — and Yoga's default `flexShrink` is
    0, so Undo and Clear were drawn outside the slab rather than compressed. The
    ink picker stacked seven more below them: 2.6714 m, 3.7×.

    The acceptance condition `07-critique.md` §5 sets is that Undo and Clear are
    both inside the slab at the `young` band with the picker open. That is what
    this asserts: the tallest column fits the box, and the grid is wide enough
    to hold all eight controls at `rows` per column.
  */
  const boardHeight = (boardComposition.boardWidth * 7) / 5;
  const box = boardHeight - spatialSpacing.xs * 2;
  const CONTROLS = 8; // pen, mark, erase, ink, ask, redo, undo, clear

  for (const band of BANDS) {
    const content = railContentHeight(spatialDistance.board, false, band);
    assert.ok(
      content <= box + 1e-12,
      `${band}: the rail's tallest column is ${content.toFixed(4)} m in a ${box.toFixed(4)} m box`,
    );
  }
  assert.ok(
    railGrid.columns * railGrid.rows >= CONTROLS,
    'the grid has fewer cells than the rail has controls',
  );
  // And the picker is a sibling slab of the same grid, so the seven swatches
  // fit it too — they are the reason `rows` is 4 rather than 3.
  assert.ok(railGrid.columns * railGrid.rows >= 7, 'the palette cannot hold seven swatches');
});

test('the ornament heights can hold what their components draw in them', () => {
  // Both were literals written twice — once here, once inside `XrOrnaments` —
  // and neither could hold its content: 0.06 m for a 0.2 m glyph, 0.08 m for a
  // key whose short edge has to clear 4°.
  assert.ok(
    boardComposition.topOrnamentHeight >= spatialTextHeight.body * 2 + spatialSpacing.xs * 2 - 1e-12,
    'the question bar cannot hold two lines of body type',
  );
  assert.ok(
    boardComposition.bottomOrnamentHeight >=
      minHitSize(spatialDistance.board, false, 'young') + spatialSpacing.xs * 2 - 1e-12,
    'the placement row cannot hold a floor-sized key',
  );
});

test('the board anchor sits at the distance every static token was sized at', () => {
  assert.equal(Math.abs(boardComposition.anchor[2]), spatialDistance.board);
  assert.ok(
    spatialDistance.board >= spatialDistance.comfortableUI.min &&
      spatialDistance.board <= spatialDistance.comfortableUI.max,
  );
});

test('every point size lands inside the metre range its type step declares', () => {
  // `spatialType` was exported and used by nowhere while every `ViroText` chose
  // its own point size. This is the derivation that made it load-bearing —
  // through the renderer's `kTextPointToWorldScale = 0.01`.
  for (const step of ['caption', 'body', 'title'] as const) {
    const metres = spatialTextHeight[step];
    assert.ok(
      metres >= spatialType[step].min && metres <= spatialType[step].max,
      `${step} renders at ${metres} m, outside ${spatialType[step].min}–${spatialType[step].max}`,
    );
    assert.ok(Number.isInteger(spatialFontSize[step]), `${step} is not a whole point size`);
  }
  assert.ok(spatialFontSize.title > spatialFontSize.body);
  assert.ok(spatialFontSize.body > spatialFontSize.caption);
});

test('a label laid out large and scaled down renders at exactly its metre height', () => {
  /*
    The whole of the `XrLabel` trick, as arithmetic. A step's point size is its
    metre height, which is a 3–9 pt face — a glyph made of a handful of texels
    however close a child leans in. So a label is laid out at
    `spatialLabelFontSize` and its NODE is scaled by `spatialLabelScale`, and
    the product has to come back to the same metres: a raster improvement that
    also changed the type size would be a redesign wearing a performance note.
  */
  for (const step of ['caption', 'body', 'title'] as const) {
    assert.equal(
      spatialLabelFontSize[step] * spatialLabelScale,
      spatialFontSize[step],
      `${step} does not scale back to its declared height`,
    );
    // iOS truncates a point size to an `int` (`VRTText.mm`), so a fractional
    // logical size would quietly round the glyph — and with it the height.
    assert.ok(Number.isInteger(spatialLabelFontSize[step]), `${step} is not a whole point size`);
    // And the raster has to actually be finer, which is the point of the trick.
    assert.ok(spatialLabelFontSize[step] > spatialFontSize[step]);
  }
});

test('a plate layers its quads front to back without sharing a plane', () => {
  /*
    Two quads at one Z z-fight, and a z-fight in a headset is a surface that
    flickers between two colours as the child's head moves. The steps are also
    ORDERED: content in front of the inset face, which is in front of the frame
    at 0.
  */
  assert.ok(spatialLayer.surface > 0);
  assert.ok(spatialLayer.content > spatialLayer.surface);
  // Small enough that the stack still reads as one object at the board's
  // distance — under a millidegree of parallax across the whole plate.
  assert.ok(spatialLayer.content < spatialSpacing.xs);
});
