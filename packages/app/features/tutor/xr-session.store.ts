'use client';
// The spatial screen's own state: what it is doing, and where the board is.
//
// Separate from `tutor.store` on purpose. That store is the SESSION — messages,
// the live turn, the voice — and it must be identical whether a child is in a
// headset or not; a lesson that behaves differently because of the display it
// is on is two lessons. This holds only the facts the spatial presentation
// invents: a lifecycle, a placement, and whether an entry is already in flight.
//
// Placement lives here rather than in the panel because it has to survive the
// panel remounting. Tracking blinks, the scene reloads, and a child who has
// already put their paper where they want it should not place it again.
// SOT: packages/ui/xr/XrPanel.types.ts · docs/decisions/adr-117-spatial-whiteboard-bridge.md
// SOT-KEYWORDS: xr session store zustand placement lifecycle recenter entering state machine spatial

import { create } from 'zustand';
import { boardComposition, type XrPanelState, type XrPlacement } from '@acme/ui/xr';
import type { WhiteboardInk, WhiteboardTool } from '@acme/ui';

/**
 * Where the composition starts: dropped below the eye line at the near end of
 * the comfortable range, facing the child squarely.
 */
const INITIAL_PLACEMENT: XrPlacement = {
  position: boardComposition.anchor,
  rotation: [0, 0, 0],
  scale: 1,
};

/**
 * Why a spatial board could not open, in the child's terms.
 *
 * A union rather than a message string, because each of these has a different
 * answer and the copy for them is reviewed (`04-copy.md`) rather than written
 * at the throw site.
 */
export type XrUnsupportedReason =
  | 'no-xr-runtime'
  | 'permission-declined'
  | 'device-not-eligible';

interface XrSessionState {
  state: XrPanelState;
  reason: XrUnsupportedReason | null;
  placement: XrPlacement;
  /**
   * True between the button being pressed and the route being on screen.
   *
   * A flag rather than a ref because it gates a control that renders: two taps
   * on a button that takes a moment to open a scene is two scenes, two audio
   * owners, and a child hearing Natalie twice.
   */
  entering: boolean;
  /** How many strokes the renderer could not draw, for the report — not the UI. */
  skippedRecords: number;
  /**
   * The rail's tool and ink, and whether a board is in flight.
   *
   * IN THE STORE RATHER THAN IN THE SCREEN'S STATE, and that is forced by how
   * the renderer works rather than chosen. `ViroARSceneNavigator` captures
   * `initialScene` in its CONSTRUCTOR (`sceneDictionary[tag].sceneClass`) and
   * renders it as a component type from then on — a scene function rebuilt on a
   * later render is never picked up. So anything the scene must react to has to
   * reach it through a subscription rather than through a closure, or the
   * headset keeps drawing the first render forever.
   */
  tool: WhiteboardTool;
  ink: WhiteboardInk;
  asking: boolean;
  /**
   * Bumped whenever the board document changes.
   *
   * The document is not React state and must not become it — a Yjs doc in a
   * store is a mutable object React would try to diff. The scene re-reads the
   * records when this moves.
   */
  revision: number;
  /**
   * A board exported in the headset, waiting for the tutor screen to send it.
   *
   * THE ASK PATH IS NOT DUPLICATED, and this slot is why. Staging a board as an
   * attachment is `tutor-screen`'s `handleAskBoard`: it enforces the four-image
   * cap, mints the attachment id, and arms the send that fires once the image
   * is staged. Reimplementing that for a second route would be two rules about
   * what a child is allowed to send. The spatial rail exports the PNG, leaves
   * it here, and the tutor screen — still mounted beneath the pushed route —
   * picks it up and takes its one path.
   */
  pendingAsk: string | null;

  beginEntry(): void;
  setState(next: XrPanelState): void;
  unsupported(reason: XrUnsupportedReason): void;
  setPlacement(next: XrPlacement): void;
  /** Put the board back where it started, relative to where the child is now. */
  recenter(): void;
  setSkipped(count: number): void;
  setTool(tool: WhiteboardTool): void;
  setInk(ink: WhiteboardInk): void;
  setAsking(asking: boolean): void;
  bumpRevision(): void;
  /** The spatial rail exported a board. `null` is an empty board and is dropped. */
  queueAsk(png: string | null): void;
  /** The tutor screen claims it. Reading it clears it, so it cannot send twice. */
  takeAsk(): string | null;
  /** Leaving the spatial screen. The session itself is untouched. */
  exit(): void;
}

export const useXrSession = create<XrSessionState>((set, get) => ({
  state: 'checking',
  reason: null,
  placement: INITIAL_PLACEMENT,
  entering: false,
  skippedRecords: 0,
  pendingAsk: null,
  tool: 'draw',
  ink: 'black',
  asking: false,
  revision: 0,

  beginEntry: () => set({ entering: true }),
  setState: (next) => set({ state: next, entering: false }),
  unsupported: (reason) => set({ state: 'unsupported', reason, entering: false }),
  setPlacement: (next) => set({ placement: next }),
  recenter: () => set({ placement: INITIAL_PLACEMENT }),
  setSkipped: (count) => set({ skippedRecords: count }),
  setTool: (tool) => set({ tool }),
  setInk: (ink) => set({ ink }),
  setAsking: (asking) => set({ asking }),
  bumpRevision: () => set((state) => ({ revision: state.revision + 1 })),
  queueAsk: (png) => set({ pendingAsk: png }),
  takeAsk: () => {
    /* `get`, not the hook: reading the store from inside its own initialiser
       makes its type circular and infers `any` for the whole slice. */
    const { pendingAsk } = get();
    if (pendingAsk !== null) set({ pendingAsk: null });
    return pendingAsk;
  },
  /*
    Back to `checking`, not to `ready`. Re-entering re-runs the capability and
    permission path, because the answer can have changed while the child was
    away — a permission revoked in system settings is the common one.
  */
  exit: () => set({ state: 'checking', reason: null, entering: false, pendingAsk: null, asking: false }),
}));
