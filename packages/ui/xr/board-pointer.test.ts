import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoardPointer } from './board-pointer.ts';
const point = { u: 0.2, v: 0.3, source: 1 };
test('a second controller cannot steal, move, or release a stroke', () => {
  const p = new BoardPointer();
  assert.equal(p.begin(point)?.phase, 'begin');
  assert.equal(p.begin({ ...point, source: 2 }), null);
  assert.equal(p.move({ u: 0.8, v: 0.8, source: 2 }), null);
  assert.equal(p.finish(2), null);
  assert.deepEqual(p.finish(1), { ...point, phase: 'end' });
  assert.equal(p.finish(1), null);
});
test('off-board motion ends at the last valid sample without an edge line or reentry bridge', () => {
  const p = new BoardPointer(); p.begin(point);
  const last = { ...point, u: 0.9 }; p.move(last);
  assert.deepEqual(p.move({ ...point, u: 1.01 }), { ...last, phase: 'end' });
  assert.equal(p.move(point), null);
  assert.equal(p.finish(1), null);
  assert.equal(p.begin(point)?.phase, 'begin');
});
test('invalid input is ignored and lifecycle cancellation is delivered once', () => {
  const p = new BoardPointer();
  assert.equal(p.begin({ ...point, u: NaN }), null);
  assert.equal(p.begin({ ...point, v: -0.01 }), null);
  p.begin(point);
  assert.equal(p.move({ ...point, v: Infinity }), null);
  assert.deepEqual(p.cancel(), { ...point, phase: 'cancel' });
  assert.equal(p.cancel(), null);
});
test('release uses the latest move, not the frozen initial Viro hit', () => {
  const p = new BoardPointer(); p.begin(point);
  const last = { ...point, u: 0.7, v: 0.6 };
  p.move(last);
  assert.deepEqual(p.finish(1), { ...last, phase: 'end' });
});
