// The promises that let a board be shown in two places at once.
//
// All four of these were true by accident when one component owned the
// document, and all four break silently: the child draws, walks between
// surfaces, and finds either an empty board or their working written twice.
// None of them is visible in a screenshot of a board that looks fine.
// SOT: packages/app/features/tutor/board-session.ts
// SOT-KEYWORDS: board session test one document presentation echo late joiner debounce dispose

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WhiteboardDiff, WhiteboardHandle, WhiteboardSnapshot } from '@acme/ui';
import {
  acquireBoardSession,
  boardSessionKey,
  disposeBoardSession,
  releaseBoardSession,
  type BoardPersistence,
} from './board-session.ts';

/** A board that is kept nowhere, and says what it was asked to do. */
function fakeStore() {
  const writes: string[] = [];
  const store: BoardPersistence = {
    readLocal: () => null,
    writeLocal: () => writes.push('local'),
    fetchRemote: async () => null,
    pushRemote: async () => {
      writes.push('remote');
    },
  };
  return { store, writes };
}

/** A stand-in engine that records the order it was spoken to in. */
function fakeEngine() {
  const calls: string[] = [];
  const diffs: WhiteboardDiff[] = [];
  const handle: WhiteboardHandle = {
    exportPng: async () => null,
    getSnapshot: async () => null,
    applyDiff: (diff) => {
      calls.push('applyDiff');
      diffs.push(diff);
    },
    injectPointer: () => calls.push('injectPointer'),
    loadSnapshot: (snapshot: WhiteboardSnapshot) => {
      calls.push('loadSnapshot');
      void snapshot;
    },
    setTool: () => calls.push('setTool'),
    setInk: () => calls.push('setInk'),
    undo: () => calls.push('undo'),
    redo: () => calls.push('redo'),
    clear: () => calls.push('clear'),
  };
  return { handle, calls, diffs };
}

const shape = (id: string) => ({ id, typeName: 'shape', type: 'draw', x: 1, y: 2 });

test('leaving one surface and arriving at another keeps the same document', () => {
  /*
    The route transition this pins: the 2D tree unmounts BEFORE the spatial tree
    mounts, so holders reach zero in the gap. A registry that disposed there
    would hand the headset a board with nothing on it.
  */
  const key = boardSessionKey('session-a');
  const pane = acquireBoardSession(key, fakeStore().store);
  pane.doc.applyDiff({ added: { 'shape:a': shape('shape:a') } }, 'local');

  releaseBoardSession(key); // the 2D screen goes away
  const xr = acquireBoardSession(key, fakeStore().store); // the spatial screen arrives

  assert.equal(xr, pane, 'the second surface built a second document');
  const store = (xr.doc.snapshot() as { document: { store: object } }).document.store;
  assert.deepEqual(Object.keys(store), ['shape:a']);

  disposeBoardSession(key);
});

test('a disposed session is gone, and the next learner starts clean', () => {
  const key = boardSessionKey('session-b');
  const first = acquireBoardSession(key, fakeStore().store);
  first.doc.applyDiff({ added: { 'shape:b': shape('shape:b') } }, 'local');
  disposeBoardSession(key);

  const second = acquireBoardSession(key, fakeStore().store);
  assert.notEqual(second, first, 'a disposed session was handed out again');
  const store = (second.doc.snapshot() as { document: { store: object } }).document.store;
  assert.deepEqual(Object.keys(store), [], 'the previous session`s strokes survived');
  disposeBoardSession(key);
});

test('an attaching engine is handed the whole board before any diff streams', () => {
  const key = boardSessionKey('session-c');
  const session = acquireBoardSession(key, fakeStore().store);
  session.doc.applyDiff({ added: { 'shape:early': shape('shape:early') } }, 'local');

  const engine = fakeEngine();
  const detach = session.attach({ id: 'pane', board: engine.handle });
  assert.deepEqual(engine.calls, ['loadSnapshot'], 'the engine was fed a diff before a board');

  // Now a peer's stroke arrives; only then does a diff belong on the wire.
  const peer = acquireBoardSession(boardSessionKey('peer-c'), fakeStore().store);
  peer.doc.applyDiff({ added: { 'shape:late': shape('shape:late') } }, 'local');
  session.doc.merge(peer.doc.encode(), 'remote');
  assert.deepEqual(engine.calls, ['loadSnapshot', 'applyDiff']);
  assert.deepEqual(Object.keys(engine.diffs[0]?.added ?? {}), ['shape:late']);

  detach();
  session.doc.merge(peer.doc.encode(), 'remote');
  assert.equal(engine.calls.length, 2, 'a detached engine is still being written to');

  disposeBoardSession(key);
  disposeBoardSession(boardSessionKey('peer-c'));
});

test('a stroke is not echoed back into the engine that drew it', () => {
  const key = boardSessionKey('session-d');
  const session = acquireBoardSession(key, fakeStore().store);
  const engine = fakeEngine();
  const detach = session.attach({ id: 'pane', board: engine.handle });

  session.change('pane', { added: { 'shape:d': shape('shape:d') } }, 'user');
  assert.deepEqual(engine.calls, ['loadSnapshot'], 'the engine was handed back its own stroke');

  // And the document did take it.
  const store = (session.doc.snapshot() as { document: { store: object } }).document.store;
  assert.deepEqual(Object.keys(store), ['shape:d']);

  // A second presentation's stroke DOES reach this engine, since it has not drawn it.
  session.change('xr', { added: { 'shape:x': shape('shape:x') } }, 'user');
  assert.deepEqual(engine.calls, ['loadSnapshot', 'applyDiff']);

  detach();
  disposeBoardSession(key);
});

test('a change the engine calls remote never re-enters the document', () => {
  const key = boardSessionKey('session-e');
  const session = acquireBoardSession(key, fakeStore().store);
  session.change('pane', { added: { 'shape:echo': shape('shape:echo') } }, 'remote');
  const store = (session.doc.snapshot() as { document: { store: object } }).document.store;
  assert.deepEqual(Object.keys(store), [], 'an echo was written back as this hand`s work');
  disposeBoardSession(key);
});
