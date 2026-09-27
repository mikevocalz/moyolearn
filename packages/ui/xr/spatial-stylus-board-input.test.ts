// The spatial pen's board mapping and stroke ownership, without a headset.
// SOT: spatial-stylus-board-input.ts · board-pointer.ts · surface-drag.ts
// SOT-KEYWORDS: muse stylus xr board ray contact yaw lifecycle pressure test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoardPointer } from './board-pointer.ts';
import {
  spatialStylusHit, SpatialStylusBoardInput, SPATIAL_STYLUS_SOURCE,
  type SpatialStylusFrame,
} from './spatial-stylus-board-input.ts';
import { xrDragPlane } from './surface-drag.ts';

const board = {
  position: [0, 0, -1.5] as const,
  yawDeg: 0,
  width: 0.6,
  height: 0.375,
  plane: xrDragPlane({
    position: [0, 0, -1.5], yawDeg: 0, scale: 1,
    offset: 0.002, width: 0.6, height: 0.375,
  }),
};
const frame: SpatialStylusFrame = {
  tracked: true, position: [0.05, 0, -0.5], headPosition: [0, 0, 0],
  tipPressed: false, primaryPressed: true, secondaryPressed: false, pressure: 0.65,
};
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should be ${expected}`);

test('side button projects the head-through-tip ray onto the floating board', () => {
  const hit = spatialStylusHit(frame, board);
  assert.ok(hit);
  near(hit.u, 0.5 + (0.05 * (1.5 - 0.002) / 0.5) / 0.6);
  near(hit.v, 0.5);
  assert.equal(hit.pressure, 0.65);
  assert.equal(spatialStylusHit({ ...frame, headPosition: null }, board), null);
});

test('tip contact uses its real position, while an unpressed tip cannot draw in air', () => {
  const tip: SpatialStylusFrame = {
    ...frame, position: [0.12, 0.04, -1.496],
    primaryPressed: false, tipPressed: true, pressure: 0.3,
  };
  const hit = spatialStylusHit(tip, board);
  assert.ok(hit);
  near(hit.u, 0.7);
  near(hit.v, 0.5 - 0.04 / board.height);
  assert.equal(hit.pressure, 0.3);
  assert.equal(spatialStylusHit({ ...tip, position: [0.12, 0.04, -0.5] }, board), null);
});

test('turned board follows the same yaw as controller input', () => {
  const turned = {
    ...board, yawDeg: 90,
    plane: xrDragPlane({
      position: board.position, yawDeg: 90, scale: 1,
      offset: 0.002, width: board.width, height: board.height,
    }),
  };
  const hit = spatialStylusHit({
    ...frame, headPosition: [1, 0, -1.5], position: [0.5, 0, -1.5],
  }, turned);
  assert.ok(hit);
  near(hit.u, 0.5);
  near(hit.v, 0.5);
});

test('one press owns begin, move and end; another source cannot take the stroke', () => {
  const pointer = new BoardPointer();
  const input = new SpatialStylusBoardInput(pointer);
  const begin = input.handle(frame, board);
  assert.equal(begin?.phase, 'begin');
  assert.equal(begin?.source, SPATIAL_STYLUS_SOURCE);
  assert.equal(pointer.begin({ u: 0.5, v: 0.5, source: 1 }), null);
  const move = input.handle({ ...frame, position: [0.08, 0, -0.5] }, board);
  assert.equal(move?.phase, 'move');
  assert.ok((move?.u ?? 0) > (begin?.u ?? 1));
  assert.equal(move?.pressure, 0.65);
  assert.equal(input.handle({ ...frame, primaryPressed: false }, board)?.phase, 'end');
  assert.equal(pointer.active, false);
});

test('lost tracking cancels a stroke and release does not resurrect it', () => {
  const pointer = new BoardPointer();
  const input = new SpatialStylusBoardInput(pointer);
  input.handle(frame, board);
  assert.equal(input.handle({ ...frame, tracked: false, position: null }, board)?.phase, 'cancel');
  assert.equal(input.handle({ ...frame, primaryPressed: false }, board), null);
  assert.equal(pointer.active, false);
});

test('off-paper motion ends once and never begins again during the held button', () => {
  const pointer = new BoardPointer();
  const input = new SpatialStylusBoardInput(pointer);
  input.handle(frame, board);
  assert.equal(input.handle({ ...frame, position: [0.2, 0, -0.5] }, board)?.phase, 'end');
  assert.equal(input.handle(frame, board), null);
  input.handle({ ...frame, primaryPressed: false }, board);
  assert.equal(input.handle(frame, board)?.phase, 'begin');
});

test('a controller stroke blocks a pen until the pen button is released', () => {
  const pointer = new BoardPointer();
  pointer.begin({ u: 0.5, v: 0.5, source: 1 });
  const input = new SpatialStylusBoardInput(pointer);
  assert.equal(input.handle(frame, board), null);
  pointer.finish(1);
  assert.equal(input.handle(frame, board), null);
  input.handle({ ...frame, primaryPressed: false }, board);
  assert.equal(input.handle(frame, board)?.phase, 'begin');
});
