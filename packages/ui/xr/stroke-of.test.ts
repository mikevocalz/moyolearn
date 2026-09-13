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
import { test } from 'node:test';
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
