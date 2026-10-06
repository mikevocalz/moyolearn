// Contract for the store that hands a mounted AdaptivePanes' toggle set to the
// shell chrome. The rules under test are the ones that keep a blurred tab
// screen's controls from leaking into the focused screen's header: entries are
// keyed by the host screen's OWN route.key — independent, so a blurred host
// republishing can never displace or be displaced — an unmount cleanup can
// only retract its OWN registration, and the header resolves its entry by its
// own screen's key.
// SOT: ./pane-controls.store.ts
// SOT-KEYWORDS: pane controls store contract publish clear owner route key
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clearPaneControls,
  publishPaneControls,
  usePaneControlsStore,
  type PaneControlsRegistration,
} from './pane-controls.store.ts';

const REGISTRATION: PaneControlsRegistration = {
  owner: 'host-a',
  columnCount: 2,
  inspector: true,
};

function reset(): void {
  usePaneControlsStore.setState({ entries: {}, headerConsumers: 0 });
}

describe('publishPaneControls', () => {
  it('registers the toggle set under the host screen’s route key', () => {
    reset();
    publishPaneControls('route-reports', REGISTRATION);
    assert.deepEqual(
      usePaneControlsStore.getState().entries['route-reports'],
      REGISTRATION,
    );
  });

  it('is a no-op when the same host republishes an identical registration', () => {
    reset();
    publishPaneControls('route-reports', REGISTRATION);
    const first = usePaneControlsStore.getState().entries;
    publishPaneControls('route-reports', { ...REGISTRATION });
    assert.equal(usePaneControlsStore.getState().entries, first);
  });

  it('updates the entry when the same host re-renders with a different set', () => {
    reset();
    publishPaneControls('route-reports', REGISTRATION);
    publishPaneControls('route-reports', { ...REGISTRATION, inspector: false });
    assert.equal(
      usePaneControlsStore.getState().entries['route-reports']?.inspector,
      false,
    );
  });

  it('keeps a second screen’s host independent — blurred entries survive', () => {
    reset();
    publishPaneControls('route-reports', REGISTRATION);
    publishPaneControls('route-classes', {
      owner: 'host-b',
      columnCount: 1,
      inspector: false,
    });
    const { entries } = usePaneControlsStore.getState();
    assert.equal(entries['route-reports']?.owner, 'host-a');
    assert.equal(entries['route-classes']?.owner, 'host-b');
  });
});

describe('clearPaneControls', () => {
  it('retracts the registration for its own key and owner', () => {
    reset();
    publishPaneControls('route-reports', REGISTRATION);
    clearPaneControls('route-reports', 'host-a');
    assert.equal(
      usePaneControlsStore.getState().entries['route-reports'],
      undefined,
    );
  });

  it('cannot let a stale unmount clear another host’s entry at the same key', () => {
    reset();
    publishPaneControls('route-reports', REGISTRATION);
    publishPaneControls('route-reports', { ...REGISTRATION, owner: 'host-b' });
    clearPaneControls('route-reports', 'host-a');
    assert.equal(
      usePaneControlsStore.getState().entries['route-reports']?.owner,
      'host-b',
    );
  });

  it('does not touch other screens’ entries', () => {
    reset();
    publishPaneControls('route-reports', REGISTRATION);
    publishPaneControls('route-classes', {
      owner: 'host-b',
      columnCount: 1,
      inspector: false,
    });
    clearPaneControls('route-reports', 'host-a');
    const { entries } = usePaneControlsStore.getState();
    assert.equal(entries['route-reports'], undefined);
    assert.equal(entries['route-classes']?.owner, 'host-b');
  });
});
