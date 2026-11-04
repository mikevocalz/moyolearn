import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProblemStorage } from './problem-storage.shared.ts';
import { advanceWorksheet, readWorksheet, writeWorksheet, type WorksheetSession } from './worksheet-session.ts';

function fakeStorage(): ProblemStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getString: (key) => values.get(key),
    set: (key, value) => { values.set(key, value); },
    remove: (key) => { values.delete(key); },
  };
}

const session = (ownerId = 'learner-1'): WorksheetSession => ({
  schemaVersion: 1,
  id: 'worksheet-1',
  ownerId,
  subject: 'Math',
  title: 'Math — Thursday',
  instructions: 'Solve each.',
  createdAt: '2026-10-15T12:00:00.000Z',
  questions: [
    { id: 'q1', text: '2+2=', sourcePage: 1, sourceNumber: 1 },
    { id: 'q2', text: '3+3=', sourcePage: 1, sourceNumber: 2 },
  ],
  currentIndex: 0,
});

test('questions remain ordered across a reload, progression is explicit and bounded', () => {
  const storage = fakeStorage();
  writeWorksheet(storage, session());
  assert.equal(readWorksheet(storage, 'learner-1')?.currentIndex, 0);
  const next = advanceWorksheet(storage, 'learner-1');
  assert.equal(next?.currentIndex, 1);
  assert.equal(next?.questions[1]?.text, '3+3=');
  assert.equal(advanceWorksheet(storage, 'learner-1'), null);
  assert.equal(readWorksheet(storage, 'learner-1')?.currentIndex, 1);
});

test('no other learner can read or advance a worksheet', () => {
  const storage = fakeStorage();
  writeWorksheet(storage, session());
  assert.equal(readWorksheet(storage, 'learner-2'), null);
  assert.equal(advanceWorksheet(storage, 'learner-2'), null);
  writeWorksheet(storage, session('learner-2'));
  assert.equal(readWorksheet(storage, 'learner-1')?.id, 'worksheet-1');
  assert.equal(readWorksheet(storage, 'learner-2')?.ownerId, 'learner-2');
});

test('corrupt, empty, or unverified candidate sessions are not accepted', () => {
  const storage = fakeStorage();
  const invalid = { ...session(), questions: [{ id: 'q1', text: '', sourcePage: 1, sourceNumber: 1 }] };
  assert.throws(() => writeWorksheet(storage, invalid));
  const valid = session();
  writeWorksheet(storage, valid);
  const [key] = storage.values.keys();
  assert.ok(key);
  storage.values.set(key!, '{not json');
  assert.equal(readWorksheet(storage, 'learner-1'), null);
  storage.values.set(key!, JSON.stringify({ ...valid, currentIndex: -1 }));
  assert.equal(readWorksheet(storage, 'learner-1'), null);
});
