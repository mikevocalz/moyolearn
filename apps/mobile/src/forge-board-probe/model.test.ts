import assert from 'node:assert/strict';
import test from 'node:test';
import type { WhiteboardPointerSample } from '@acme/ui';
import type { ProblemStorage } from '@acme/app/features/capture/problem-storage.shared.ts';
import { BOARD_KEY } from '@acme/app/features/capture/problem-storage.shared.ts';
import { writeSavedForgeBoard } from '@acme/app/features/tutor/forge-board-storage.ts';
import { FORGE_PROBE_STORAGE_ID, injectProbeStroke, probeMarkCount, restoreProbeDocument } from './model.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: ProblemStorage = {
    getString: (key) => values.get(key),
    set: (key, value) => { values.set(key, value); },
    remove: (key) => { values.delete(key); },
  };
  return { storage, values };
}

test('fixture saves and reopens the real Yjs document through production persistence', () => {
  assert.equal(FORGE_PROBE_STORAGE_ID, 'moyo-forge-validation');
  const { storage } = memoryStorage();
  const first = restoreProbeDocument(storage);
  assert.equal(first.restored, false);
  first.doc.applyDiff({ added: { test: { id: 'test', typeName: 'shape' } } }, 'local');
  writeSavedForgeBoard(storage, first.doc);
  first.doc.destroy();
  const reopened = restoreProbeDocument(storage);
  assert.equal(reopened.restored, true);
  assert.equal(probeMarkCount(reopened.doc.snapshot()), 1);
  assert.equal(reopened.doc.canUndo(), false, 'restoration is not a new local edit');
  reopened.doc.applyDiff({ added: { next: { id: 'next', typeName: 'shape' } } }, 'local');
  assert.equal(probeMarkCount(reopened.doc.snapshot()), 2);
  reopened.doc.undo();
  assert.equal(probeMarkCount(reopened.doc.snapshot()), 1);
  reopened.doc.redo();
  assert.equal(probeMarkCount(reopened.doc.snapshot()), 2);
  reopened.doc.destroy();
});

test('resetting the fixture slot leaves another storage adapter untouched', () => {
  const fixture = memoryStorage();
  const learner = memoryStorage();
  learner.storage.set(BOARD_KEY, 'learner original bytes');
  const first = restoreProbeDocument(fixture.storage);
  first.doc.applyDiff({ added: { test: { id: 'test' } } }, 'local');
  writeSavedForgeBoard(fixture.storage, first.doc);
  first.doc.destroy();
  fixture.storage.remove(BOARD_KEY);
  const reset = restoreProbeDocument(fixture.storage);
  assert.equal(probeMarkCount(reset.doc.snapshot()), 0);
  assert.equal(reset.doc.canUndo(), false);
  assert.equal(learner.storage.getString(BOARD_KEY), 'learner original bytes');
  reset.doc.destroy();
});

test('synthetic stroke calls the actual input seam with pressure zero preserved', () => {
  const samples: WhiteboardPointerSample[] = [];
  injectProbeStroke({ injectPointer: (sample) => { samples.push(sample); } });
  assert.deepEqual(samples.map((s) => s.phase), ['begin', 'move', 'move', 'move', 'end']);
  assert.deepEqual(samples.map((s) => s.pressure), [0, 0.25, 0.75, 1, 0]);
});
