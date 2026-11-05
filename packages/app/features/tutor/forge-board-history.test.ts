import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBoardDoc, type BoardHistory } from './board-doc.ts';

const ink = (id: string) => ({ id, typeName: 'shape', type: 'draw', props: {} });

test('history reports the settled Yjs stack after record observers have run', () => {
  const doc = createBoardDoc();
  const seen: BoardHistory[] = [];
  const order: string[] = [];
  doc.onRecords(() => order.push(`record:${doc.canUndo()}:${doc.canRedo()}`));
  const stop = doc.onHistory((value) => {
    seen.push(value);
    order.push(`history:${value.canUndo}:${value.canRedo}`);
  });
  assert.deepEqual(seen, [{ canUndo: false, canRedo: false }]);
  doc.applyDiff({ added: { mine: ink('mine') } }, 'local');
  assert.deepEqual(order.slice(0, 3), ['history:false:false', 'record:false:false', 'history:true:false']);
  doc.undo();
  doc.redo();
  assert.deepEqual(seen, [
    { canUndo: false, canRedo: false },
    { canUndo: true, canRedo: false },
    { canUndo: false, canRedo: true },
    { canUndo: true, canRedo: false },
  ]);
  stop();
  doc.destroy();
});

test('restore and remote merge never advertise local undo or clear local redo', () => {
  const doc = createBoardDoc();
  const seen: BoardHistory[] = [];
  doc.onHistory((value) => seen.push(value));
  const saved = createBoardDoc();
  saved.applyDiff({ added: { restored: ink('restored') } }, 'local');
  doc.merge(saved.encode(), 'restore');
  doc.applyDiff({ added: { remote: ink('remote') } }, 'remote');
  assert.deepEqual(seen, [{ canUndo: false, canRedo: false }]);
  doc.applyDiff({ added: { local: ink('local') } }, 'local');
  doc.undo();
  doc.applyDiff({ added: { remoteAgain: ink('remoteAgain') } }, 'remote');
  assert.deepEqual(seen.at(-1), { canUndo: false, canRedo: true });
  doc.redo();
  assert.deepEqual(seen.at(-1), { canUndo: true, canRedo: false });
  saved.destroy();
  doc.destroy();
});

test('late history listeners receive current availability and detach independently', () => {
  const doc = createBoardDoc();
  doc.applyDiff({ added: { first: ink('first') } }, 'local');
  const first: BoardHistory[] = [];
  const second: BoardHistory[] = [];
  const stopFirst = doc.onHistory((value) => first.push(value));
  const stopSecond = doc.onHistory((value) => second.push(value));
  assert.deepEqual(first, [{ canUndo: true, canRedo: false }]);
  stopFirst();
  stopFirst();
  doc.undo();
  assert.equal(first.length, 1);
  assert.deepEqual(second.at(-1), { canUndo: false, canRedo: true });
  stopSecond();
  doc.redo();
  assert.equal(second.length, 2);
  doc.destroy();
});

test('history listeners do not receive destruction or duplicate availability for captured edits', () => {
  const doc = createBoardDoc();
  const seen: BoardHistory[] = [];
  doc.onHistory((value) => seen.push(value));
  doc.applyDiff({ added: { first: ink('first') } }, 'local');
  doc.applyDiff({ added: { second: ink('second') } }, 'local');
  assert.equal(seen.length, 2);
  doc.destroy();
  assert.equal(seen.length, 2);
});
