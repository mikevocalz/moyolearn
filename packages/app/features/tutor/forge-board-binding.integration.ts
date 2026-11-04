import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Store, type Diff, type Snapshot } from '@quickdrawjs/core';
import { createInkOutlineEncoder, createWhiteboardRendererBinding, type WhiteboardRendererTarget } from '@nitro-forge/board';
import { compileQuickDrawScene } from '@nitro-forge/board/skia';
import { getInkOutline } from '@viro-external/ui/src/quickdraw-headless/ink-outline.ts';
import { createBoardDoc } from './board-doc.ts';
import { createForgeBoardSource } from './forge-board-source.ts';

const stroke = (id: string, x = 10) => ({
  id, typeName: 'shape' as const, type: 'draw' as const, x, y: 20, z: 1, rot: 0,
  props: { color: 'black', size: 'm', dash: 'draw', isPen: true, pts: [0, 0, 0, 10, 10, 1] },
});

function frameQueue() {
  const pending = new Map<number, (timestampMs: number) => void>();
  let serial = 0;
  return {
    pending,
    requestFrame(callback: (timestampMs: number) => void) {
      serial += 1;
      pending.set(serial, callback);
      return serial;
    },
    cancelFrame(handle: number) { pending.delete(handle); },
    run() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(100);
    },
  };
}

function rendererRecorder() {
  const records = new Store();
  const snapshots: string[] = [];
  const diffs: string[] = [];
  const revisions: number[] = [];
  const listeners = new Set<(state: 'lost') => void>();
  const renderer: WhiteboardRendererTarget = {
    loadSnapshot(revision, json) {
      revisions.push(revision);
      snapshots.push(json);
      records.loadSnapshot(JSON.parse(json) as Snapshot, 'remote');
    },
    applyDiff(revision, json) {
      revisions.push(revision);
      diffs.push(json);
      records.applyDiff(JSON.parse(json) as Diff, 'remote');
    },
    setCamera() {},
    setOverlay() {},
    addOnStateChangedListener(listener) {
      listeners.add(listener);
      return { remove: () => { listeners.delete(listener); } };
    },
  };
  return {
    renderer, records, snapshots, diffs, revisions, listeners,
    loseSurface() { for (const listener of listeners) listener('lost'); },
  };
}

test('actual Forge binding renders one Yjs document through restore, edits, merges, undo and redo', () => {
  const saved = createBoardDoc();
  saved.applyDiff({ added: { restored: stroke('restored') } }, 'local');
  const doc = createBoardDoc();
  doc.merge(saved.encode(), 'restore');
  saved.destroy();
  const source = createForgeBoardSource(doc);
  const target = rendererRecorder();
  const frames = frameQueue();
  const encoder = createInkOutlineEncoder(getInkOutline);
  const errors: Error[] = [];
  const binding = createWhiteboardRendererBinding({
    store: source, renderer: target.renderer, getInkOutline,
    requestFrame: frames.requestFrame, cancelFrame: frames.cancelFrame,
    onError: (error) => errors.push(error),
  });
  const assertCurrent = () => {
    const expected = JSON.parse(encoder.encodeSnapshot(source.getSnapshot()));
    assert.deepEqual(target.records.getSnapshot(), expected);
    assert.equal(compileQuickDrawScene(expected).kind, 'ready');
  };
  frames.run();
  assertCurrent();
  assert.equal(target.snapshots.length, 1);
  assert.ok((target.records.get('restored') as unknown as { inkOutline: number[] }).inkOutline.length > 0);
  const restoredRecord = source.getSnapshot().document.store.restored;
  assert.equal(restoredRecord?.typeName, 'shape');
  assert.ok(restoredRecord?.typeName === 'shape');
  assert.equal((restoredRecord.props as { pts: number[] }).pts[2], 0);

  doc.applyDiff({ added: { mine: stroke('mine') } }, 'local');
  const peer = createBoardDoc();
  peer.applyDiff({ added: { theirs: stroke('theirs') } }, 'local');
  doc.merge(peer.encode(), 'remote');
  peer.destroy();
  assert.equal(frames.pending.size, 1, 'many source changes must share one render frame');
  frames.run();
  assertCurrent();

  doc.undo();
  frames.run();
  assertCurrent();
  assert.equal(target.records.has('mine'), false);
  assert.equal(target.records.has('restored'), true);
  assert.equal(target.records.has('theirs'), true);
  doc.redo();
  frames.run();
  assertCurrent();

  doc.applyDiff({ updated: { mine: [stroke('mine'), stroke('mine', 84)] } }, 'local');
  doc.applyDiff({ removed: { theirs: stroke('theirs') } }, 'remote');
  frames.run();
  assertCurrent();
  assert.equal(target.records.get('mine')?.typeName, 'shape');
  assert.equal((target.records.get('mine') as { x: number }).x, 84);
  assert.equal(target.records.has('theirs'), false);
  assert.equal(target.records.canUndo, false, 'renderer projection created an independent undo history');
  assert.deepEqual(errors, []);
  assert.deepEqual(target.revisions, target.revisions.map((_value, index) => index + 1));

  binding.dispose();
  doc.destroy();
});

test('actual Forge compiler returns whole-document fallback for unsupported and corrupt records', () => {
  const doc = createBoardDoc();
  const source = createForgeBoardSource(doc);
  const encoder = createInkOutlineEncoder(getInkOutline);
  doc.applyDiff({ added: { ink: stroke('ink') } }, 'local');
  assert.equal(compileQuickDrawScene(encoder.encodeSnapshot(source.getSnapshot())).kind, 'ready');
  const future = { id: 'future', typeName: 'shape', type: 'future-record', props: { data: 'preserve me' } };
  doc.applyDiff({ added: { future } }, 'restore');
  const before = doc.encode();
  const scene = compileQuickDrawScene(encoder.encodeSnapshot(source.getSnapshot()));
  assert.equal(scene.kind, 'unsupported');
  assert.ok(scene.kind === 'unsupported' && scene.reasons.some((reason) => reason.includes('future')));
  assert.equal('marks' in scene, false, 'fallback must not present a partial successful scene');
  assert.deepEqual(doc.encode(), before, 'a renderer changed persisted records to gain compatibility');
  assert.deepEqual(source.getSnapshot().document.store.future, future);
  assert.equal(compileQuickDrawScene('{broken').kind, 'unsupported');
  assert.equal(compileQuickDrawScene({ document: { store: { broken: null } } }).kind, 'unsupported');
  doc.destroy();
});

test('actual Forge binding resynchronizes after surface loss and detaches pending frame and listeners', () => {
  const doc = createBoardDoc();
  const source = createForgeBoardSource(doc);
  const target = rendererRecorder();
  const frames = frameQueue();
  const binding = createWhiteboardRendererBinding({
    store: source, renderer: target.renderer, getInkOutline,
    requestFrame: frames.requestFrame, cancelFrame: frames.cancelFrame,
  });
  frames.run();
  doc.applyDiff({ added: { ink: stroke('ink') } }, 'local');
  frames.run();
  target.records.loadSnapshot({ document: { store: {} } });
  target.loseSurface();
  frames.run();
  assert.equal(target.snapshots.length, 2);
  assert.equal(target.records.has('ink'), true);
  const bytes = doc.encode();
  doc.applyDiff({ added: { pending: stroke('pending') } }, 'local');
  assert.equal(frames.pending.size, 1);
  const calls = target.revisions.length;
  binding.dispose();
  binding.dispose();
  assert.equal(frames.pending.size, 0);
  assert.equal(target.listeners.size, 0);
  frames.run();
  doc.applyDiff({ added: { detached: stroke('detached') } }, 'local');
  frames.run();
  assert.equal(target.revisions.length, calls);
  const restored = createBoardDoc();
  restored.merge(bytes, 'restore');
  assert.equal(createForgeBoardSource(restored).getSnapshot().document.store.ink?.id, 'ink');
  restored.destroy();
  doc.destroy();
});
