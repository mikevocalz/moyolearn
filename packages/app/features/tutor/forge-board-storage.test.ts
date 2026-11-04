import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD_KEY, type ProblemStorage } from '../capture/problem-storage.shared.ts';
import { createBoardDoc, encodeBoardUpdate } from './board-doc.ts';
import { readSavedForgeBoard, writeSavedForgeBoard } from './forge-board-storage.ts';

function memory(raw?: string) {
  const data = new Map<string, string>();
  if (raw !== undefined) data.set(BOARD_KEY, raw);
  const storage: ProblemStorage = {
    getString: (key) => data.get(key),
    set: (key, value) => { data.set(key, value); },
    remove: (key) => { data.delete(key); },
  };
  return { data, storage };
}
const ink = { id: 'ink', typeName: 'shape', type: 'draw', props: { pressure: 0 } };

test('current Yjs bytes reopen unchanged with no migration or recovery writes', () => {
  const source = createBoardDoc();
  source.applyDiff({ added: { ink } }, 'local');
  const raw = JSON.stringify(encodeBoardUpdate(source.encode()));
  const saved = memory(raw);
  const update = readSavedForgeBoard(saved.storage);
  assert.deepEqual(update, source.encode());
  assert.deepEqual([...saved.data], [[BOARD_KEY, raw]]);
  const restored = createBoardDoc();
  restored.merge(update!, 'restore');
  assert.deepEqual(restored.snapshot(), source.snapshot());
  assert.equal(restored.canUndo(), false);
  restored.destroy();
  source.destroy();
});

test('legacy snapshots migrate every record and retain the exact original JSON', () => {
  const legacy = { document: { store: { ink, future: { typeName: 'future', data: [1, 2, 3] } } } };
  const raw = JSON.stringify(legacy, null, 2);
  const saved = memory(raw);
  const update = readSavedForgeBoard(saved.storage);
  const restored = createBoardDoc();
  restored.merge(update!, 'restore');
  assert.deepEqual(restored.snapshot(), legacy);
  assert.equal(restored.canUndo(), false);
  assert.equal(saved.data.get(BOARD_KEY), raw, 'reading must not replace the legacy slot');
  assert.equal(saved.data.get(`${BOARD_KEY}:recovery`), raw);
  writeSavedForgeBoard(saved.storage, restored);
  assert.deepEqual(readSavedForgeBoard(saved.storage), restored.encode());
  assert.equal(saved.data.get(`${BOARD_KEY}:recovery`), raw);
  assert.equal(saved.data.size, 2, 'repeated reads or writes should not duplicate the same recovery value');
  restored.destroy();
});

test('corrupt JSON, base64 and Yjs payloads cannot crash document restoration or be discarded by the next save', () => {
  const corruptValues = ['{unfinished', '"not base64!"', JSON.stringify(btoa('not a Yjs update')), '42'];
  for (const raw of corruptValues) {
    const saved = memory(raw);
    assert.equal(readSavedForgeBoard(saved.storage), null);
    assert.equal(saved.data.get(BOARD_KEY), raw);
    assert.equal(saved.data.get(`${BOARD_KEY}:recovery`), raw);
    assert.equal(readSavedForgeBoard(saved.storage), null);
    assert.equal(saved.data.size, 2);
    const next = createBoardDoc();
    next.applyDiff({ added: { ink } }, 'local');
    writeSavedForgeBoard(saved.storage, next);
    assert.deepEqual(readSavedForgeBoard(saved.storage), next.encode());
    assert.equal(saved.data.get(`${BOARD_KEY}:recovery`), raw);
    next.destroy();
  }
});

test('a newer corrupt value never overwrites an older recovery value', () => {
  const saved = memory('{first');
  readSavedForgeBoard(saved.storage);
  saved.data.set(BOARD_KEY, '{second');
  readSavedForgeBoard(saved.storage);
  assert.equal(saved.data.get(`${BOARD_KEY}:recovery`), '{first');
  assert.equal(saved.data.get(`${BOARD_KEY}:recovery:1`), '{second');
});

test('a corrupt external replacement is preserved even after this storage has saved valid bytes', () => {
  const saved = memory();
  const doc = createBoardDoc();
  writeSavedForgeBoard(saved.storage, doc);
  saved.data.set(BOARD_KEY, '{externally damaged');
  writeSavedForgeBoard(saved.storage, doc);
  assert.equal(saved.data.get(`${BOARD_KEY}:recovery`), '{externally damaged');
  assert.deepEqual(readSavedForgeBoard(saved.storage), doc.encode());
  doc.destroy();
});

test('recovery storage failure leaves the original slot intact', () => {
  const raw = '{unfinished';
  const saved = memory(raw);
  const originalSet = saved.storage.set;
  saved.storage.set = (key, value) => {
    if (key !== BOARD_KEY) throw new Error('storage full');
    originalSet(key, value);
  };
  const next = createBoardDoc();
  assert.throws(() => readSavedForgeBoard(saved.storage), /storage full/);
  assert.throws(() => writeSavedForgeBoard(saved.storage, next), /storage full/);
  assert.equal(saved.data.get(BOARD_KEY), raw);
  next.destroy();
});
