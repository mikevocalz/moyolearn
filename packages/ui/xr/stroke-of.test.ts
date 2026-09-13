// The vendor-internal record shape, pinned.
//
// `strokeOf` reads a key (`props.pts`) that `@quickdrawjs/core` types as
// `any` — so a vendor bump can change it with no type error anywhere. These
// assertions are the only thing that would notice. They also pin the skip
// behaviour, because the alternative to skipping an unrecognised record is
// throwing inside a render during a child's session.
// SOT: packages/ui/xr/stroke-of.ts
// SOT-KEYWORDS: stroke record test quickdraw pts defensive parse skip highlight

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { SIZES } from '@quickdrawjs/core';
import { strokeOf } from './stroke-of.ts';

const freehand = (over: Record<string, unknown> = {}) => ({
  id: 'shape:a',
  typeName: 'shape',
  type: 'draw',
  x: 100,
  y: 200,
  rot: 0,
  z: 0,
  props: { pts: [[0, 0, 0.5], [10, 4, 0.6]], color: 'blue', size: 'm', dash: 'solid' },
  ...over,
});

test('a freehand record becomes absolute page points', () => {
  const stroke = strokeOf('shape:a', freehand());
  assert.notEqual(stroke, null);
  // `pts` are deltas from the record's own origin, which is the part that is
  // easy to get wrong and impossible to see in a screenshot.
  assert.deepEqual(stroke?.points, [
    { x: 100, y: 200 },
    { x: 110, y: 204 },
  ]);
  assert.equal(stroke?.colourId, 'blue');
  assert.equal(stroke?.highlight, false);
  assert.ok((stroke?.width ?? 0) > 0, 'the vendor size id did not resolve to a width');
});

test('a highlighter record is the same geometry, marked', () => {
  const stroke = strokeOf('shape:h', freehand({ type: 'highlight' }));
  assert.equal(stroke?.highlight, true);
});

test('records the spatial board cannot draw are skipped, not guessed at', () => {
  const cases: [string, unknown][] = [
    ['a text shape', freehand({ type: 'text' })],
    ['an asset record', { id: 'asset:1', typeName: 'asset', src: 'data:', w: 1, h: 1 }],
    ['no props at all', freehand({ props: undefined })],
    ['props with no pts', freehand({ props: { color: 'black' } })],
    ['an empty pts array', freehand({ props: { pts: [], color: 'black' } })],
    ['a non-numeric origin', freehand({ x: '100' })],
    ['null', null],
    ['a string', 'shape:a'],
  ];
  for (const [what, record] of cases) {
    assert.equal(strokeOf('id', record), null, `${what} was read as a stroke`);
  }
});

test('a malformed point inside a good stroke drops that point, not the stroke', () => {
  const stroke = strokeOf('shape:a', freehand({ props: { pts: [[0, 0], 'nope', [5, 5]], color: 'red', size: 'm' } }));
  assert.deepEqual(stroke?.points, [
    { x: 100, y: 200 },
    { x: 105, y: 205 },
  ]);
});

test('missing colour and size fall back rather than throwing', () => {
  const stroke = strokeOf('shape:a', freehand({ props: { pts: [[0, 0]] } }));
  assert.equal(stroke?.colourId, 'black');
  assert.ok((stroke?.width ?? 0) > 0);
});

/*
  THE FOUR CONSTANTS A STROKE'S WEIGHT IS MADE OF.

  `SIZES` is public. `INK_SIZES`, `HIGHLIGHT_SCALE` and `HIGHLIGHT_ALPHA` are in
  `@quickdrawjs/core/src/palette.js` and are re-exported by neither `src/index.js`
  nor the package's `exports` map, so `stroke-of.ts` mirrors them. This reads the
  vendor's file as TEXT and checks the mirror still matches: a bump that retunes
  the pencil fails here rather than silently re-weighting a child's handwriting
  in the headset only.
*/
const palette = readFileSync(
  createRequire(import.meta.url).resolve('@quickdrawjs/core/package.json').replace(/package\.json$/, 'src/palette.js'),
  'utf8',
);

test('the vendor constants the spatial ink mirrors are still the vendor constants', () => {
  assert.match(palette, /export const INK_SIZES = \{ s: 3\.4, m: 5\.2, l: 6\.5, xl: 10 \}/);
  assert.match(palette, /export const HIGHLIGHT_ALPHA = 0\.55\b/);
  assert.match(palette, /export const HIGHLIGHT_SCALE = 4\.5\b/);
  assert.deepEqual(SIZES, { s: 2.5, m: 4, l: 6.5, xl: 10 });
});

test('a pressure-ink stroke is the INK_SIZES weight, not the SIZES one', () => {
  /*
    `shapes.js:333` sends anything whose dash is absent or `'draw'` down
    `drawPath`, which builds its outline from `INK_SIZES[p.size]`. Resolving it
    through `SIZES` drew a default `m` pen at 4 page px where the 2D board draws
    5.2 — 23% thin, and invisible in a screenshot because a thin line still
    looks like a line.
  */
  assert.equal(strokeOf('shape:a', freehand({ props: { pts: [[0, 0]], size: 'm', dash: 'draw' } }))?.width, 5.2);
  assert.equal(strokeOf('shape:a', freehand({ props: { pts: [[0, 0]], size: 's' } }))?.width, 3.4);
  // `l` and `xl` are the same in both tables, which is why this was survivable.
  assert.equal(strokeOf('shape:a', freehand({ props: { pts: [[0, 0]], size: 'l' } }))?.width, 6.5);
});

test('a styled line is the flat SIZES centreline, because the engine draws it that way', () => {
  for (const dash of ['solid', 'dashed', 'dotted'] as const) {
    assert.equal(
      strokeOf('shape:a', freehand({ props: { pts: [[0, 0]], size: 'm', dash } }))?.width,
      SIZES.m,
      `dash=${dash} did not take the even-width path`,
    );
  }
});

test('a highlighter is a band at the vendor alpha, not a pencil line at 0.4', () => {
  const stroke = strokeOf('shape:h', freehand({ type: 'highlight', props: { pts: [[0, 0]], size: 'm' } }));
  // SIZES.m × HIGHLIGHT_SCALE — 18 page px, where this used to draw 4.
  assert.equal(stroke?.width, 18);
  assert.equal(stroke?.opacity, 0.55);
});

test('ink is fully opaque, and an unknown size id is the m default in every path', () => {
  assert.equal(strokeOf('shape:a', freehand())?.opacity, 1);
  assert.equal(strokeOf('shape:a', freehand({ props: { pts: [[0, 0]], size: 'xxl' } }))?.width, 5.2);
});
