import { createStore } from 'zustand/vanilla';
import type { RivePanel } from 'nitro-canvas-in-Vision';

export type PanelPose = { position: [number, number, number]; rotation: [number, number, number] };
type Pieces = [number, number, number, number];

export function createRivePanelStore(pose: PanelPose) {
  return createStore(() => ({ pose, grabbed: false, status: 'Loading lesson…',
    pieces: [0, 0, 0, 0] as Pieces, count: 0, materialsReady: false }));
}

/** Rive owns the piece selections; Zustand derives and publishes their total. */
export function bindRiveSelection(runtime: Pick<RivePanel, 'getNumber' | 'setNumber' | 'observeNumber'>,
  store: ReturnType<typeof createRivePanelStore>) {
  let active = true;
  const sync = () => {
    if (!active) return;
    const pieces = [0, 1, 2, 3].map(i => runtime.getNumber(`piece${i}`)) as Pieces;
    const count = pieces.reduce((total, value) => total + (value > 0.5 ? 1 : 0), 0);
    const previous = store.getState();
    if (pieces.some((value, i) => value !== previous.pieces[i])) store.setState({ pieces, count });
    // The authored aggregate converter stays zero on Android. Keep the Rive
    // counter aligned with the actual selection, without replacing its clicks.
    if (runtime.getNumber('selectedCount') !== count) runtime.setNumber('selectedCount', count);
  };
  for (let i = 0; i < 4; i++) runtime.observeNumber(`piece${i}`, sync);
  sync();
  // Native runtime disposal removes observers. Retire callbacks immediately so
  // an already queued notification cannot update an unmounted/replaced probe.
  return () => { active = false; };
}
