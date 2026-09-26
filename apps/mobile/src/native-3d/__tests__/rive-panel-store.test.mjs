import test from 'node:test';
import assert from 'node:assert/strict';
import { bindRiveSelection, createRivePanelStore } from '../rive-panel-store.ts';

const pose = { position: [0, 0, -2], rotation: [0, 0, 0] };
function fixture() {
  const values = { piece0: 0, piece1: 1, piece2: 1, piece3: 0, selectedCount: 0 };
  const listeners = new Map();
  const runtime = {
    getNumber: name => values[name],
    setNumber: (name, value) => { values[name] = value; },
    observeNumber: (name, callback) => { listeners.set(name, callback); },
  };
  const store = createRivePanelStore(pose);
  const stop = bindRiveSelection(runtime, store);
  return { values, listeners, store, stop };
}
test('hydrates from existing Rive selections and repairs its stale aggregate', () => {
  const { values, store } = fixture();
  assert.deepEqual(store.getState().pieces, [0, 1, 1, 0]);
  assert.equal(store.getState().count, 2);
  assert.equal(values.selectedCount, 2);
});
test('native changes update both labels, including deselection and reset', () => {
  const { values, listeners, store } = fixture();
  values.piece1 = 0;
  listeners.get('piece1')(0);
  assert.equal(store.getState().count, 1);
  assert.equal(values.selectedCount, 1);
  values.piece2 = 0;
  listeners.get('piece2')(0);
  assert.equal(store.getState().count, 0);
  assert.equal(values.selectedCount, 0);
});
test('retired callbacks cannot update a remounted probe or its runtime', () => {
  const { values, listeners, store, stop } = fixture();
  const other = createRivePanelStore(pose);
  stop();
  values.piece0 = 1;
  listeners.get('piece0')(1);
  assert.equal(store.getState().count, 2);
  assert.equal(values.selectedCount, 2);
  assert.equal(other.getState().count, 0);
});
