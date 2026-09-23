// The placement arithmetic that replaced Yoga, held to what Yoga did.
//
// The spatial panels are stacked quads now, so "the second key, below the
// first" is a number this package computes instead of a layout engine. That is
// a trade worth testing: the flex columns it replaced failed SILENTLY — Yoga's
// `flexShrink` is 0, so a column that overflowed its box drew its last children
// outside the slab, which is how the rail shipped with Undo and Clear floating
// in the room beside the panel.
//
// So the two properties that matter are here. A run's offsets reproduce what a
// column with `justifyContent: 'flex-start'` or `'center'` produced, and an
// overflowing run REPORTS the overflow rather than clamping it — a clamp would
// be the same silence in a different file.
// SOT: packages/ui/xr/run-layout.ts
// SOT-KEYWORDS: xr run layout test offsets column row overflow centre flex replacement

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extentOf, runOffsets } from './run-layout.ts';

const close = (actual: number, expected: number, what: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-12, `${what}: ${actual}, expected ${expected}`);

test('an empty run occupies nothing and places nothing', () => {
  assert.equal(extentOf([], 0.1), 0);
  assert.deepEqual(runOffsets([], 1, 0.1, 'center'), []);
});

test('a run of one is its own size, with no gap counted', () => {
  assert.equal(extentOf([0.2], 0.05), 0.2);
});

test('gaps are counted between items and never at the ends', () => {
  close(extentOf([0.1, 0.1, 0.1], 0.02), 0.34, 'three items, two gaps');
});

test('a start-justified run begins at the box edge', () => {
  const offsets = runOffsets([0.2, 0.2, 0.1], 1, 0, 'start');
  close(offsets[0]!, 0.1, 'first centre');
  close(offsets[1]!, 0.3, 'second centre');
  close(offsets[2]!, 0.45, 'third centre');
});

test('a centred run leaves the same slack at both ends', () => {
  const sizes = [0.2, 0.2];
  const gap = 0.05;
  const offsets = runOffsets(sizes, 1, gap, 'center');
  const lead = offsets[0]! - sizes[0]! / 2;
  const trail = 1 - (offsets[1]! + sizes[1]! / 2);
  close(lead, trail, 'slack at the two ends');
  close(lead, (1 - extentOf(sizes, gap)) / 2, 'slack is half the leftover');
});

test('a centred run of one sits in the middle of its box', () => {
  close(runOffsets([0.3], 1, 0, 'center')[0]!, 0.5, 'lone centre');
});

test('an overflowing run reaches past the box rather than being clamped', () => {
  /*
    The regression this file exists for. A run longer than its box must produce
    offsets that visibly leave the box, because the caller — and
    `spatial-tokens.test.ts`'s rail fit — can only check a number it is given.
    Clamping here would reproduce Yoga's silence with better manners.
  */
  const sizes = [0.5, 0.5, 0.5];
  assert.ok(extentOf(sizes, 0) > 1, 'the fixture does not actually overflow');
  const offsets = runOffsets(sizes, 1, 0, 'start');
  assert.ok(offsets[2]! + 0.25 > 1, 'the last item was quietly pulled back inside the box');
});

test('a centred run that overflows overflows equally at both ends', () => {
  const offsets = runOffsets([2], 1, 0, 'center');
  close(offsets[0]!, 0.5, 'an oversized item stays centred');
});
