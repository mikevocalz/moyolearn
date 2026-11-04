import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Store, composeDiff, type Diff, type DiffSource, type Snapshot } from '@quickdrawjs/core';
import { createBoardDoc } from './board-doc.ts';
import { createForgeBoardSource } from './forge-board-source.ts';

const stroke = (id: string, x = 10) => ({
  id, typeName: 'shape' as const, type: 'draw', x, y: 20, z: 1, rot: 0,
  props: { color: 'black', size: 'm', dash: 'draw', pts: [0, 0, 0, 10, 10, 1] },
});

test('Forge source reads restored records without creating another editable document', () => {
  const saved = createBoardDoc();
  saved.applyDiff({ added: { ink: stroke('ink'), legacy: { typeName: 'future', payload: 42 } } }, 'local');
  const restored = createBoardDoc();
  restored.merge(saved.encode(), 'restore');
  const source = createForgeBoardSource(restored);
  assert.deepEqual(source.getSnapshot(), saved.snapshot());
  assert.deepEqual(Object.keys(source).sort(), ['getSnapshot', 'listen']);
  assert.equal(restored.canUndo(), false);
  saved.destroy();
  restored.destroy();
});

test('local edits, remote merges, update second values and deletions reach the same renderer source', () => {
  const doc = createBoardDoc();
  const source = createForgeBoardSource(doc);
  // A real QuickDraw Store stands in for the native parser's record collection.
  // Only the document is authored; this store receives renderer projection diffs.
  const rendered = new Store();
  rendered.loadSnapshot(source.getSnapshot());
  const seen: Diff[] = [];
  const stop = source.listen((diff) => {
    seen.push(diff);
    rendered.applyDiff(diff, 'remote');
  });
  const before = stroke('ink');
  const after = stroke('ink', 99);
  doc.applyDiff({ added: { ink: before } }, 'local');
  doc.applyDiff({ updated: { ink: [before, after] } }, 'local');
  assert.deepEqual(rendered.get('ink'), after);

  const peer = createBoardDoc();
  peer.applyDiff({ added: { peer: stroke('peer') } }, 'local');
  doc.merge(peer.encode(), 'remote');
  assert.deepEqual(rendered.getSnapshot(), source.getSnapshot());
  doc.applyDiff({ removed: { ink: after } }, 'local');
  assert.equal(rendered.has('ink'), false);
  assert.deepEqual(rendered.getSnapshot(), source.getSnapshot());
  assert.ok(seen.every((diff) => diff.added && diff.updated && diff.removed));
  assert.equal(rendered.canUndo, false, 'renderer projections must not create an independent undo history');
  stop();
  doc.destroy();
  peer.destroy();
});

test('the existing Yjs undo/redo changes the renderer while leaving peer records intact', () => {
  const doc = createBoardDoc();
  const source = createForgeBoardSource(doc);
  const rendered = new Store();
  const stop = source.listen((diff) => rendered.applyDiff(diff, 'remote'));
  doc.applyDiff({ added: { mine: stroke('mine') } }, 'local');
  doc.applyDiff({ added: { theirs: stroke('theirs') } }, 'remote');
  doc.undo();
  assert.equal(rendered.has('mine'), false);
  assert.equal(rendered.has('theirs'), true);
  assert.deepEqual(rendered.getSnapshot(), source.getSnapshot());
  doc.redo();
  assert.deepEqual(rendered.getSnapshot(), source.getSnapshot());
  assert.equal(rendered.has('mine'), true);
  stop();
  doc.destroy();
});

test('QuickDraw composes source diffs without losing records or writing back to Yjs', () => {
  const doc = createBoardDoc();
  const source = createForgeBoardSource(doc);
  let composed: Diff = { added: {}, updated: {}, removed: {} };
  let events = 0;
  const stop = source.listen((diff) => {
    events += 1;
    composed = composeDiff(composed, diff);
  });
  doc.applyDiff({ added: { ink: stroke('ink') } }, 'local');
  doc.applyDiff({ updated: { ink: [stroke('ink'), stroke('ink', 42)] } }, 'local');
  doc.applyDiff({ added: { transient: stroke('transient') } }, 'local');
  doc.applyDiff({ removed: { transient: stroke('transient') } }, 'local');
  const rendered = new Store();
  rendered.applyDiff(composed, 'remote');
  assert.deepEqual(rendered.getSnapshot(), source.getSnapshot());
  assert.equal(events, 4, 'a presentation must not echo projections back into Yjs');
  stop();
  doc.applyDiff({ added: { late: stroke('late') } }, 'local');
  assert.equal(events, 4, 'a detached renderer still received records');
  doc.destroy();
});

test('source filtering preserves QuickDraw origin semantics, including restore and history', () => {
  const doc = createBoardDoc();
  const source = createForgeBoardSource(doc);
  const all: DiffSource[] = [];
  const local: DiffSource[] = [];
  const remote: DiffSource[] = [];
  const stops = [
    source.listen((_diff, origin) => all.push(origin)),
    source.listen((_diff, origin) => local.push(origin), { source: 'user' }),
    source.listen((_diff, origin) => remote.push(origin), { source: 'remote' }),
  ];
  doc.applyDiff({ added: { saved: stroke('saved') } }, 'restore');
  doc.applyDiff({ added: { mine: stroke('mine') } }, 'local');
  doc.undo();
  doc.redo();
  assert.deepEqual(all, ['remote', 'user', 'user', 'user']);
  assert.deepEqual(local, ['user', 'user', 'user']);
  assert.deepEqual(remote, ['remote']);
  for (const stop of stops) stop();
  doc.destroy();
});

test('legacy bytes survive presentation creation and destruction', () => {
  const doc = createBoardDoc();
  const legacy = { id: 'legacy', typeName: 'shape', type: 'unsupported-new-kind', props: { opaque: [1, 2, 3] } };
  doc.applyDiff({ added: { legacy } }, 'restore');
  const before = doc.encode();
  const source = createForgeBoardSource(doc);
  const stop = source.listen(() => assert.fail('read-only presentation emitted an edit'));
  assert.deepEqual((source.getSnapshot() as Snapshot).document.store.legacy, legacy);
  stop();
  assert.deepEqual(doc.encode(), before);
  assert.equal(doc.canUndo(), false);
  doc.destroy();
});
