import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBoardDoc, type BoardDoc } from './board-doc.ts';
import { acquireBoardSession, disposeBoardSession, type BoardPersistence } from './board-session.ts';

function persistence() {
  const local: unknown[] = [];
  const remote: unknown[] = [];
  const store: BoardPersistence = {
    readLocal: () => null,
    writeLocal: (doc: BoardDoc) => { local.push(doc.snapshot()); },
    fetchRemote: async () => null,
    pushRemote: async (_id, doc: BoardDoc) => { remote.push(doc.snapshot()); },
  };
  return { local, remote, store };
}
const ink = { id: 'ink', typeName: 'shape', type: 'draw', x: 1, y: 2 };

test('document undo and redo are saved without requiring an engine echo', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const saved = persistence();
  const key = 'forge-history-save';
  const session = acquireBoardSession(key, saved.store);
  t.after(() => disposeBoardSession(key));
  session.setSessionId(key);
  session.change('pane', { added: { ink } }, 'user');
  t.mock.timers.tick(2000);
  saved.local.length = 0;
  saved.remote.length = 0;

  session.doc.undo();
  t.mock.timers.tick(2000);
  assert.deepEqual(saved.local, [{ document: { store: {} } }]);
  assert.deepEqual(saved.remote, saved.local);
  session.doc.redo();
  t.mock.timers.tick(2000);
  assert.deepEqual(saved.local[1], { document: { store: { ink } } });
  assert.deepEqual(saved.remote, saved.local);
});

test('remote merges save the converged local board without pushing an echo', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const saved = persistence();
  const key = 'forge-remote-save';
  const session = acquireBoardSession(key, saved.store);
  t.after(() => disposeBoardSession(key));
  session.setSessionId(key);
  const peer = createBoardDoc();
  peer.applyDiff({ added: { ink } }, 'local');
  session.doc.merge(peer.encode(), 'remote');
  peer.destroy();
  t.mock.timers.tick(2000);
  assert.deepEqual(saved.local, [{ document: { store: { ink } } }]);
  assert.deepEqual(saved.remote, []);
});
