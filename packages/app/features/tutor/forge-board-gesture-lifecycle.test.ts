import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Store, type Diff, type ShapeRecord } from '@quickdrawjs/core';
import type { BoardDoc } from './board-doc.ts';

const stroke = (id: string): ShapeRecord => ({
  id, typeName: 'shape', type: 'draw', x: 1, y: 2, z: 1, rot: 0,
  props: { pts: [0, 0, 0], color: 'black', size: 'm', dash: 'draw' },
});
const keys = (doc: BoardDoc) => Object.keys((doc.snapshot() as { document: { store: object } }).document.store).sort();

test('explicit gesture lifetime preserves Yjs history across stationary pauses and cancellations', async (t) => {
  // lib0 captures Date.now when Yjs is imported. Load BoardDoc only after the
  // fake clock is active so these tests advance real UndoManager capture time.
  t.mock.timers.enable({ apis: ['Date'], now: 10_000 });
  const { createBoardDoc } = await import('./board-doc.ts');

  await t.test('a long pause inside one gesture does not split its undo step', () => {
    const doc = createBoardDoc();
    const engine = new Store();
    const stop = engine.listen((diff, source) => { if (source === 'user') doc.applyDiff(diff, 'local'); });
    const remote = doc.onRemote((diff) => engine.applyDiff(diff as Diff, 'remote'));
    doc.beginGesture();
    engine.beginBatch();
    engine.put(stroke('ink'));
    t.mock.timers.tick(2_000);
    engine.update('ink', { props: { pts: [0, 0, 0, 10, 20, 1] } });
    engine.endBatch();
    doc.endGesture();
    doc.applyDiff({ added: { peer: stroke('peer') } }, 'remote');
    doc.undo();
    assert.deepEqual(keys(doc), ['peer']);
    assert.deepEqual(engine.getSnapshot(), doc.snapshot());
    doc.redo();
    assert.deepEqual(keys(doc), ['ink', 'peer']);
    assert.deepEqual((engine.get('ink') as ShapeRecord).props.pts, [0, 0, 0, 10, 20, 1]);
    stop(); remote(); doc.destroy();
  });

  await t.test('a long paused cancellation never resurfaces through undo or redo', () => {
    const doc = createBoardDoc();
    doc.beginGesture();
    doc.applyDiff({ added: { kept: stroke('kept') } }, 'local');
    doc.endGesture();
    doc.beginGesture();
    doc.applyDiff({ added: { canceled: stroke('canceled') } }, 'local');
    t.mock.timers.tick(2_000);
    doc.applyDiff({ updated: { canceled: [stroke('canceled'), { ...stroke('canceled'), x: 20 }] } }, 'local');
    t.mock.timers.tick(2_000);
    doc.applyDiff({ removed: { canceled: stroke('canceled') } }, 'local');
    doc.endGesture();
    doc.applyDiff({ added: { peer: stroke('peer') } }, 'remote');
    assert.deepEqual(keys(doc), ['kept', 'peer']);
    doc.undo();
    assert.deepEqual(keys(doc), ['peer']);
    doc.redo();
    assert.deepEqual(keys(doc), ['kept', 'peer']);
    doc.undo(); doc.undo();
    assert.deepEqual(keys(doc), ['peer']);
    doc.redo(); doc.redo();
    assert.deepEqual(keys(doc), ['kept', 'peer']);
    doc.destroy();
  });

  await t.test('completed rapid gestures remain independent and begin/end calls are idempotent', () => {
    const doc = createBoardDoc();
    doc.beginGesture(); doc.beginGesture();
    doc.applyDiff({ added: { first: stroke('first') } }, 'local');
    t.mock.timers.tick(2_000);
    doc.applyDiff({ updated: { first: [stroke('first'), { ...stroke('first'), x: 42 }] } }, 'local');
    doc.endGesture(); doc.endGesture();
    doc.beginGesture();
    doc.applyDiff({ added: { second: stroke('second') } }, 'local');
    doc.endGesture();
    doc.undo();
    assert.deepEqual(keys(doc), ['first']);
    doc.undo();
    assert.deepEqual(keys(doc), []);
    doc.destroy();
  });

  await t.test('the original capture timeout still applies outside explicit gestures', () => {
    const doc = createBoardDoc();
    doc.beginGesture();
    doc.applyDiff({ added: { gesture: stroke('gesture') } }, 'local');
    doc.endGesture();
    doc.applyDiff({ added: { beforePause: stroke('beforePause') } }, 'local');
    t.mock.timers.tick(501);
    doc.applyDiff({ added: { afterPause: stroke('afterPause') } }, 'local');
    doc.undo();
    assert.deepEqual(keys(doc), ['beforePause', 'gesture'], 'gesture timeout leaked Infinity into ordinary edits');
    doc.undo();
    assert.deepEqual(keys(doc), ['gesture']);
    doc.destroy();
  });

  await t.test('undo settles an active gesture and restores ordinary capture timing', () => {
    const doc = createBoardDoc();
    doc.beginGesture();
    doc.applyDiff({ added: { active: stroke('active') } }, 'local');
    doc.undo();
    assert.deepEqual(keys(doc), []);
    doc.applyDiff({ added: { first: stroke('first') } }, 'local');
    t.mock.timers.tick(501);
    doc.applyDiff({ added: { second: stroke('second') } }, 'local');
    doc.undo();
    assert.deepEqual(keys(doc), ['first']);
    doc.endGesture();
    doc.destroy();
  });
});
