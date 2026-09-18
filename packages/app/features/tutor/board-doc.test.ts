// The board document's two promises, asserted rather than assumed.
//
// Both were broken in ways the UI could not show: a merged update that reached
// the canvas as nothing, and an origin filter that decided whose undo stack a
// restore landed in. Neither is visible in a screenshot until a child loses
// their working, so they are pinned here.
// SOT: packages/app/features/tutor/board-doc.ts
// SOT-KEYWORDS: board document yjs crdt test merge diff origin undo remote restore

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBoardDoc, decodeBoardUpdate, encodeBoardUpdate } from './board-doc.ts';
import type { WhiteboardDiff } from '@acme/ui';

const shape = (id: string) => ({ id, typeName: 'shape', type: 'draw', x: 1, y: 2 });

test('a merged update reaches a listener as a diff the engine can apply', () => {
  const authored = createBoardDoc();
  authored.applyDiff({ added: { 'shape:a': shape('shape:a'), 'shape:b': shape('shape:b') } }, 'local');

  // The round trip a second device actually makes: encode, base64, decode.
  const wire = decodeBoardUpdate(encodeBoardUpdate(authored.encode()));

  const arriving = createBoardDoc();
  const seen: Record<string, unknown>[] = [];
  arriving.onRemote((diff) => {
    if (diff.added) seen.push(diff.added);
  });
  arriving.merge(wire, 'remote');

  const ids = seen.flatMap((added) => Object.keys(added));
  assert.deepEqual(ids.sort(), ['shape:a', 'shape:b']);
  // The RECORD has to travel, not just its id — `store.applyDiff` puts values.
  assert.deepEqual(seen[0]?.['shape:a'], shape('shape:a'));

  authored.destroy();
  arriving.destroy();
});

test('a local edit does not echo back to the listener', () => {
  const doc = createBoardDoc();
  let fired = 0;
  doc.onRemote(() => {
    fired += 1;
  });
  doc.applyDiff({ added: { 'shape:a': shape('shape:a') } }, 'local');
  assert.equal(fired, 0, 'a local edit re-broadcast is the echo loop');
  doc.destroy();
});

test('undo walks the local author only', () => {
  const doc = createBoardDoc();
  doc.applyDiff({ added: { 'shape:mine': shape('shape:mine') } }, 'local');
  doc.applyDiff({ added: { 'shape:theirs': shape('shape:theirs') } }, 'remote');

  doc.undo();

  const store = (doc.snapshot() as { document: { store: Record<string, unknown> } }).document.store;
  assert.ok(!('shape:mine' in store), 'undo should remove this author’s own record');
  assert.ok('shape:theirs' in store, 'undo must never remove a collaborator’s record');
  doc.destroy();
});

test('a restore is nobody’s edit and cannot be undone', () => {
  const source = createBoardDoc();
  source.applyDiff({ added: { 'shape:saved': shape('shape:saved') } }, 'local');
  const wire = source.encode();

  const restored = createBoardDoc();
  restored.merge(wire, 'restore');
  restored.undo();

  const store = (restored.snapshot() as { document: { store: Record<string, unknown> } }).document
    .store;
  assert.ok('shape:saved' in store, 'a restored board must not be undoable out of existence');
  source.destroy();
  restored.destroy();
});

test('removals travel as keys the engine reads', () => {
  const doc = createBoardDoc();
  doc.applyDiff({ added: { 'shape:a': shape('shape:a') } }, 'local');

  const seen: string[] = [];
  doc.onRemote((diff) => {
    if (diff.removed) seen.push(...Object.keys(diff.removed));
  });
  // Quickdraw's `removed` is keyed by id — the engine reads `Object.keys`, so a
  // diff that carried an array here dropped every deletion silently.
  doc.applyDiff({ removed: { 'shape:a': shape('shape:a') } }, 'remote');

  assert.deepEqual(seen, ['shape:a']);
  doc.destroy();
});

test('the renderer subscription hears this hand`s own strokes and the engine one does not', () => {
  /*
    The spatial board draws the document rather than mirroring an engine, so a
    local stroke it is not told about is ink the child sees in 2D and not in the
    headset. Both subscriptions are asserted together because the value of one
    is exactly that the other stays blind.
  */
  const doc = createBoardDoc();
  const engine: string[] = [];
  const renderer: [string, string][] = [];
  doc.onRemote((diff) => engine.push(...Object.keys(diff.added ?? {})));
  doc.onRecords((diff, origin) => {
    for (const id of Object.keys(diff.added ?? {})) renderer.push([id, origin]);
  });

  doc.applyDiff({ added: { 'shape:mine': shape('shape:mine') } }, 'local');
  assert.deepEqual(engine, [], 'the engine was told about a stroke it drew itself');
  assert.deepEqual(renderer, [['shape:mine', 'local']]);

  const peer = createBoardDoc();
  peer.applyDiff({ added: { 'shape:theirs': shape('shape:theirs') } }, 'local');
  doc.merge(peer.encode(), 'remote');
  assert.deepEqual(engine, ['shape:theirs']);
  assert.deepEqual(renderer[1], ['shape:theirs', 'remote']);
});

test('redo returns a stroke undo removed, and neither touches a collaborator`s', () => {
  const doc = createBoardDoc();
  doc.applyDiff({ added: { 'shape:mine': shape('shape:mine') } }, 'local');

  const peer = createBoardDoc();
  peer.applyDiff({ added: { 'shape:theirs': shape('shape:theirs') } }, 'local');
  doc.merge(peer.encode(), 'remote');

  const ids = () => Object.keys((doc.snapshot() as { document: { store: object } }).document.store).sort();
  assert.deepEqual(ids(), ['shape:mine', 'shape:theirs']);

  assert.equal(doc.canUndo(), true);
  assert.equal(doc.canRedo(), false);
  doc.undo();
  assert.deepEqual(ids(), ['shape:theirs'], 'undo took the wrong author`s record');
  assert.equal(doc.canRedo(), true);

  doc.redo();
  assert.deepEqual(ids(), ['shape:mine', 'shape:theirs']);

  // Nothing of this author's is left to undo past their own first stroke.
  doc.undo();
  doc.undo();
  assert.deepEqual(ids(), ['shape:theirs'], 'a second undo reached across authors');
});

test('an undone stroke reaches the renderer as a change it must redraw for', () => {
  const doc = createBoardDoc();
  const seen: WhiteboardDiff[] = [];
  doc.onRecords((diff) => seen.push(diff));

  doc.applyDiff({ added: { 'shape:a': shape('shape:a') } }, 'local');
  doc.undo();

  assert.equal(seen.length, 2);
  assert.deepEqual(Object.keys(seen[1]?.removed ?? {}), ['shape:a']);
});
