import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { panelPlacementAfter, usePanelPlacementStore } from './panelWindowsCore.ts';

describe('panelPlacementAfter', () => {
  it('is pending from the request until the panel reports open', () => {
    assert.equal(panelPlacementAfter({ type: 'requested' }), 'pending');
    assert.equal(panelPlacementAfter({ type: 'opened' }), 'spatial');
  });

  it('drops a panel the user closed or the launch refused, so the in-window rail returns', () => {
    assert.equal(panelPlacementAfter({ type: 'closed', reason: 'user' }), 'dropped');
    assert.equal(panelPlacementAfter({ type: 'failed' }), 'dropped');
  });

  it('returns an app-closed panel to inline, the state of no request', () => {
    assert.equal(panelPlacementAfter({ type: 'closed', reason: 'app' }), 'inline');
  });
});

describe('usePanelPlacementStore', () => {
  beforeEach(() => usePanelPlacementStore.setState({ placements: {} }));

  it('tracks each label on its own', () => {
    const { apply } = usePanelPlacementStore.getState();
    apply('rail', { type: 'requested' });
    apply('other', { type: 'requested' });
    apply('rail', { type: 'opened' });
    assert.deepEqual(usePanelPlacementStore.getState().placements, { rail: 'spatial', other: 'pending' });
  });
});
