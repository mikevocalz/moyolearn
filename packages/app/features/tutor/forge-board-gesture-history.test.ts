import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Store, type Diff, type ShapeRecord } from '@quickdrawjs/core';
import { createBoardDoc } from './board-doc.ts';

function inputEngine() {
  const doc = createBoardDoc();
  const engine = new Store();
  let lastCompleted = engine.undos.at(-1);
  let checkpoints = 0;
  const stopInput = engine.listen((diff, source) => {
    if (source === 'user') doc.applyDiff(diff, 'local');
  });
  const stopHistory = engine.listenHistory(() => {
    // The public tail changes only when the engine completes a gesture, not
    // for each point transaction while beginBatch/endBatch keeps it open.
    const next = engine.undos.at(-1);
    if (next === lastCompleted) return;
    lastCompleted = next;
    checkpoints += 1;
    doc.stopCapturing();
  });
  const stopRemote = doc.onRemote((diff) => engine.applyDiff(diff as Diff, 'remote'));
  return {
    doc, engine, checkpoints: () => checkpoints,
    dispose() { stopInput(); stopHistory(); stopRemote(); doc.destroy(); },
  };
}

const stroke = (id: string): ShapeRecord => ({
  id, typeName: 'shape', type: 'draw', x: 10, y: 20, z: 1, rot: 0,
  props: { color: 'black', size: 'm', dash: 'draw', isPen: true, pts: [0, 0, 0] },
});

function completeStroke(engine: Store, id: string) {
  engine.beginBatch();
  engine.put(stroke(id));
  engine.update(id, { props: { pts: [0, 0, 0, 4, 8, 0.5] } });
  engine.update(id, { props: { pts: [0, 0, 0, 4, 8, 0.5, 8, 10, 1] } });
  engine.endBatch();
}

test('two rapid completed engine gestures undo independently in the existing Yjs manager', () => {
  const { doc, engine, checkpoints, dispose } = inputEngine();
  completeStroke(engine, 'first');
  completeStroke(engine, 'second');
  const peer = createBoardDoc();
  peer.applyDiff({ added: { peer: stroke('peer') } }, 'local');
  doc.merge(peer.encode(), 'remote');
  peer.destroy();
  assert.equal(checkpoints(), 2, 'each completed gesture needs one capture boundary');
  assert.equal(engine.undos.length, 2);
  doc.undo();
  assert.deepEqual(engine.ids().sort(), ['first', 'peer'], 'undo merged both rapid gestures');
  assert.deepEqual(engine.getSnapshot(), doc.snapshot());
  doc.redo();
  assert.deepEqual(engine.ids().sort(), ['first', 'peer', 'second']);
  assert.deepEqual(engine.getSnapshot(), doc.snapshot());
  assert.deepEqual((engine.get('second') as ShapeRecord).props.pts, [0, 0, 0, 4, 8, 0.5, 8, 10, 1]);
  dispose();
});

test('per-point history notifications do not split a still-open engine gesture', () => {
  const { doc, engine, checkpoints, dispose } = inputEngine();
  engine.beginBatch();
  engine.put(stroke('ink'));
  assert.equal(checkpoints(), 0);
  engine.update('ink', { props: { pts: [0, 0, 0, 2, 3, 0.5] } });
  assert.equal(checkpoints(), 0);
  engine.endBatch();
  assert.equal(checkpoints(), 1);
  doc.undo();
  assert.equal(engine.has('ink'), false, 'undo removed only the latest point instead of the whole gesture');
  dispose();
});

test('a canceled put/update/remove gesture leaves no shape or completed checkpoint', () => {
  const { doc, engine, checkpoints, dispose } = inputEngine();
  completeStroke(engine, 'first');
  completeStroke(engine, 'second');
  doc.applyDiff({ added: { peer: stroke('peer') } }, 'remote');
  engine.beginBatch();
  engine.put(stroke('canceled'));
  engine.update('canceled', { props: { pts: [0, 0, 0, 4, 8, 0.5] } });
  engine.remove(['canceled']);
  engine.endBatch();
  assert.equal(checkpoints(), 2, 'cancel must not invent a completed engine gesture');
  assert.equal(engine.has('canceled'), false);
  assert.deepEqual(engine.getSnapshot(), doc.snapshot());
  doc.undo();
  assert.deepEqual(engine.ids().sort(), ['first', 'peer']);
  assert.deepEqual(engine.getSnapshot(), doc.snapshot());
  doc.redo();
  assert.deepEqual(engine.ids().sort(), ['first', 'peer', 'second']);
  assert.equal(engine.has('canceled'), false);
  dispose();
});
