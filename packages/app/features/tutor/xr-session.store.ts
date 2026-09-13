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
//
// THE LIFECYCLE IS DRIVEN FROM FACTS, NOT FROM OPTIMISM. Every move in
// `TRANSITIONS` below is made by something that actually happened:
// `spatialEligibility` reading this binary and this device, the runtime's own
// permission result, the child's answer to the primer, the engine reporting it
// has an editor, and `ViroARScene`'s tracking events. Nothing here advances on
// a timer or on a render, because a board that says it is ready before it is
// hands a child a surface their pencil falls through.
// SOT: packages/ui/xr/XrPanel.types.ts · packages/app/features/tutor/xr-capability.ts
//      docs/decisions/adr-117-spatial-whiteboard-bridge.md
// SOT-KEYWORDS: xr session store zustand placement lifecycle recenter entering state machine spatial permission primer tracking

import { create } from 'zustand';
import { boardComposition, type XrPanelState, type XrPlacement } from '@acme/ui/xr';
import type { WhiteboardInk, WhiteboardTool } from '@acme/ui';
import type { AgeBand } from '../capture/age-band.ts';

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

/**
 * Why the board is on screen but cannot be written on for a moment.
 *
 * Separate from `XrUnsupportedReason` because the answer is different in kind:
 * an unsupported board never opens and the child's move is to go back, while an
 * interruption resolves itself when the headset finds the room again and the
 * child's move is to wait. Collapsing the two would put "go back to the normal
 * screen" in front of a child whose board is about to return.
 */
export type XrInterruptionReason = 'tracking-lost' | 'tracking-limited';

/**
 * WHAT THE SPATIAL SCREEN IS DOING — the whole lifecycle, as one value.
 *
 * A discriminated union rather than a `XrPanelState` plus loose `reason`
 * fields, because the reasons do not belong to every state: "ready, because
 * permission was declined" and "unsupported, tracking limited" are both
 * writable when the reason is a sibling field, and neither means anything.
 *
 * IT IS A SUPERSET OF `XrPanelState`, ON PURPOSE. `permission-required` is a
 * stage of this screen and NOT a state of the spatial panel, because the primer
 * is answered before any scene is mounted — a consent question asked from
 * inside the thing it is granting consent for is a question already answered.
 * `panelStateOf` is the one place the superset narrows to what the panel
 * understands, so the panel's contract is not widened by a stage it can never
 * render.
 */
export type XrPhase =
  | { kind: 'checking' }
  | { kind: 'permission-required' }
  | { kind: 'preparing' }
  | { kind: 'ready' }
  | { kind: 'interrupted'; reason: XrInterruptionReason }
  | { kind: 'unsupported'; reason: XrUnsupportedReason }
  | { kind: 'exiting' };

/**
 * The only legal moves, as a table rather than as scattered `if`s.
 *
 * Written down because the sequence is the feature: a screen that can jump from
 * `checking` to `ready` has skipped the permission primer, and a screen that can
 * go from `unsupported` back to `preparing` has told a child their headset can
 * do this after saying it cannot.
 *
 * `exiting` is reachable from everywhere and leads nowhere: leaving is always
 * allowed and is always the last thing that happens on this screen. Re-entry
 * goes through `exit()`, which resets rather than transitions.
 */
const TRANSITIONS: Record<XrPhase['kind'], readonly XrPhase['kind'][]> = {
  checking: ['permission-required', 'preparing', 'unsupported', 'exiting'],
  'permission-required': ['preparing', 'unsupported', 'exiting'],
  preparing: ['ready', 'interrupted', 'unsupported', 'exiting'],
  ready: ['interrupted', 'exiting'],
  interrupted: ['ready', 'exiting'],
  unsupported: ['exiting'],
  exiting: [],
};

/**
 * What the spatial panel is told, from what the screen knows.
 *
 * `permission-required` reports as `checking` rather than growing the panel's
 * union: the panel is not mounted while the primer is up, and a state it can
 * never be in is a branch nobody can test. `checking` is also the honest answer
 * — from the panel's side the availability question genuinely is still open.
 */
export function panelStateOf(phase: XrPhase): XrPanelState {
  return phase.kind === 'permission-required' ? 'checking' : phase.kind;
}

/** Two phases are the same when the stage AND the reason for it are. */
function samePhase(a: XrPhase, b: XrPhase): boolean {
  if (a.kind !== b.kind) return false;
  return ('reason' in a ? a.reason : null) === ('reason' in b ? b.reason : null);
}

interface XrSessionState {
  phase: XrPhase;
  placement: XrPlacement;
  /**
   * True between the button being pressed and the route being on screen.
   *
   * A flag rather than a ref because it gates a control that renders: two taps
   * on a button that takes a moment to open a scene is two scenes, two audio
   * owners, and a child hearing Natalie twice.
   */
  entering: boolean;
  /**
   * How many records this renderer had no primitive for — text, notes, arrows,
   * images — reported by `XrBoardInk` after every change.
   *
   * IT IS ON A SURFACE A CHILD READS, and the comment here used to say the
   * opposite ("for the report — not the UI"). Nothing called `setSkipped` and
   * nothing rendered the number, which is exactly how a board silently missing
   * a child's typed working looked identical to a complete one. The companion
   * panel says it now; zero says nothing.
   */
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
   * The signed-in learner's band, which sizes every key in the composition.
   *
   * HERE FOR THE SAME CONSTRUCTOR-CAPTURE REASON AS `tool` AND `ink`, and for no
   * other: the band is not a fact the spatial presentation invents — it comes
   * from `activeContext` exactly as it does on the 2D screen — but the scene
   * cannot be handed a prop, so the only way it reaches `minHitSize` is through
   * a subscription.
   *
   * `young` is the start value, which is the LARGEST multiplier and therefore
   * the only safe guess. The screen sets the real band before the navigator can
   * mount — the lifecycle has to leave `checking` first, and that takes an
   * async tick — so this is never what a child sees; it is what the wrong
   * ordering would degrade to, and being wrong towards bigger keys costs an
   * adult nothing while being wrong the other way costs a six-year-old their
   * eraser.
   */
  band: AgeBand;
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
  /**
   * The route is on screen. This is the OTHER end of `entering` — see its note.
   *
   * Called by the route rather than by the screen, because the screen is behind
   * a lazy import: a renderer that fails to fetch means the screen never
   * mounts, and a guard that only the screen can clear would leave the button
   * saying "Opening…" for the rest of the session.
   */
  arrive(): void;
  /**
   * Move the lifecycle on. An illegal move is DROPPED, not thrown.
   *
   * The callers are a permission promise, an engine callback and the renderer's
   * tracking events, all of which can land after the child has already pressed
   * Go back — and a late `ready` that crashes a child's screen is a worse
   * outcome than a late `ready` that goes nowhere. Returns whether it moved, so
   * a caller that needs to know can ask.
   */
  advance(next: XrPhase): boolean;
  setPlacement(next: XrPlacement): void;
  /** Put the board back where it started, relative to where the child is now. */
  recenter(): void;
  setSkipped(count: number): void;
  setBand(band: AgeBand): void;
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
  phase: { kind: 'checking' },
  placement: INITIAL_PLACEMENT,
  entering: false,
  skippedRecords: 0,
  pendingAsk: null,
  band: 'young',
  tool: 'draw',
  ink: 'black',
  asking: false,
  revision: 0,

  beginEntry: () => set({ entering: true }),
  arrive: () => set({ entering: false }),
  advance: (next) => {
    const { phase } = get();
    /*
      A repeat of the phase the screen is already in is not a move. The renderer
      reports tracking on a timer as well as on a change, so without this a
      settled board would `set` — and re-render the scene graph — at that rate.
    */
    if (samePhase(phase, next)) return false;
    /*
      Refining the reason WITHIN a phase is legal and deliberately absent from
      the table: limited tracking becoming lost tracking is the same stage of
      the lifecycle with a more accurate reason, not a transition. Only
      `interrupted` produces one today — every other phase's reason is decided
      once, before a child has read it.
    */
    if (phase.kind !== next.kind && !TRANSITIONS[phase.kind].includes(next.kind)) return false;
    set({ phase: next, entering: false });
    return true;
  },
  setPlacement: (next) => set({ placement: next }),
  recenter: () => set({ placement: INITIAL_PLACEMENT }),
  setSkipped: (count) => set({ skippedRecords: count }),
  setBand: (band) => set({ band }),
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
    A RESET, NOT A TRANSITION — which is why it does not go through `advance`.
    Back to `checking`, so re-entering re-runs the capability and permission
    path: the answer can have changed while the child was away, and a permission
    revoked in system settings is the common one.

    `entering` is cleared here as well as in `arrive`, and that is the guard
    against the dead door. A child who presses Go back while the renderer is
    still being fetched never reaches `arrive`, and a flag left standing would
    disable the only way into the spatial board for the rest of the session.
  */
  exit: () =>
    set({ phase: { kind: 'checking' }, entering: false, pendingAsk: null, asking: false }),
}));
