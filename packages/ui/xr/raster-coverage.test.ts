// The one thing about the two-layer paper that can be silently wrong.
//
// The raster shows the board; the live layer shows what the raster is too old
// to contain. If the set difference is wrong in one direction a child's stroke
// is drawn twice in the same colour at the same place, which nobody can see. If
// it is wrong in the other, the stroke under their hand is in neither layer —
// the board simply stops taking ink as far as they can tell. So the direction
// this is allowed to fail in is pinned here, along with the identity return
// that keeps `XrBoardInk` from re-walking the document on every drag frame.
// SOT: packages/ui/xr/raster-coverage.ts
// SOT-KEYWORDS: xr raster coverage test uncovered records identity set difference live ink

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { uncoveredRecords } from './raster-coverage.ts';

const store = { a: { n: 1 }, b: { n: 2 }, c: { n: 3 } } as const;

test('no raster yet owes a polyline for every record', () => {
  assert.equal(uncoveredRecords(store, null), store);
});

test('an empty coverage set is the same answer as no raster', () => {
  assert.equal(uncoveredRecords(store, new Set()), store);
});

test('a covered record is left to the raster', () => {
  const rest = uncoveredRecords(store, new Set(['a', 'b']));
  assert.deepEqual(Object.keys(rest), ['c']);
  assert.equal(rest.c, store.c, 'the record itself is passed through, not copied');
});

test('a record drawn since the raster was asked for is still drawn live', () => {
  /* The stroke under the child's hand: it did not exist when the raster was
     requested, so nothing covers it and the live layer must. */
  const withNew = { ...store, d: { n: 4 } };
  const rest = uncoveredRecords(withNew, new Set(['a', 'b', 'c']));
  assert.deepEqual(Object.keys(rest), ['d']);
});

test('a coverage set naming records the document no longer has removes nothing extra', () => {
  /* An erased record stays in the picture until the next raster — the stale
     direction this arrangement accepts — and must not take a live record with
     it on the way out. */
  const rest = uncoveredRecords(store, new Set(['gone', 'a']));
  assert.deepEqual(Object.keys(rest), ['b', 'c']);
});

test('a fully covered document draws nothing live', () => {
  assert.deepEqual(uncoveredRecords(store, new Set(['a', 'b', 'c'])), {});
});

test('the identity return survives a coverage set that overlaps nothing', () => {
  /* Not merely equal — the SAME object, or `XrBoardInk`'s memo re-walks the
     whole document on every frame of a placement drag. */
  assert.equal(uncoveredRecords(store, new Set(['x', 'y'])), store);
});
