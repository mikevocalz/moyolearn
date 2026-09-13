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
  railWidthFor,
  spatialDistance,
  spatialFontSize,
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
  // side, so a rail exactly one key wide is a rail that squeezes every key.
  const key = minHitSize(spatialDistance.board, false, 'young');
  assert.ok(boardComposition.railWidth >= key + spatialSpacing.xs * 2 - 1e-12);
  assert.equal(boardComposition.railWidth, railWidthFor(spatialDistance.board, false, 'young'));
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
