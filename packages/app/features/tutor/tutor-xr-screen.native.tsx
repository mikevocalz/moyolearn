'use client';
// The spatial workspace: the same board and the same conversation, in a
// headset.
//
// WHAT IS ON SCREEN, AND WHERE IT COMES FROM. Nothing here is new content. The
// paper is the session's one `BoardDoc` (`board-session`), the strokes on it are
// that document's records, the rail is `Whiteboard.tsx`'s toolbar model, and the
// panel to the right is `useTutorStore`'s transcript. Entering is a second
// PRESENTATION of one lesson — not a second lesson — so no state is seeded, no
// opening is replayed, and no audio stream is opened.
//
// THE ENGINE IS STILL QUICKDRAW, AND IT IS STILL ON SCREEN — just not visibly.
// ViroReact cannot host a React Native view inside a scene — a scene graph takes
// Viro primitives and nothing else — so the engine is not MOUNTED on the paper.
// Its output is. It remains the only authority for strokes, tools, the eraser
// and export; the paper is textured with the picture it rasters of its own
// document (`XrBoardRaster`), the strokes it has not rastered yet are drawn in
// front as polylines (`XrBoardInk`), and a ray on the paper becomes a pointer in
// the engine. One engine, one document, two renderers — which is what keeps a
// stroke drawn in the headset identical to one drawn on a laptop, and what
// finally puts a child's typed notes, arrows and images on the spatial board
// instead of counting them as missing.
//
// The engine is laid out at `boardSurfacePixels` and parked off-screen so its
// client space is the space the ink is rendered from. A WebView with
// `display: none` would tear down its surface; moved aside, it keeps drawing.
//
// WHY THE SCENE READS ITS STATE INSTEAD OF RECEIVING IT. `ViroARSceneNavigator`
// captures `initialScene` in its CONSTRUCTOR — it goes into
// `state.sceneDictionary[tag].sceneClass` and is rendered from there as a
// component type for the life of the navigator. A scene function rebuilt by a
// later render is never picked up, and neither is `passProps`. So a scene
// closed over `store`, `placement` or `tool` would draw the first render of the
// session forever: a child would write on the board and watch nothing appear.
// Everything the scene reacts to therefore arrives through `useXrSession` or
// `useTutorStore`, and everything it merely needs a handle on arrives through
// the `active` holder below.
//
// THE HEADSET IS WHERE THE CHILD ASKED TO BE, SO IT IS THE FIRST THING THEY
// GET. This screen is the driver of `xr-session.store`'s lifecycle, and the
// order is what changed: eligibility is answered from constants — this binary's
// native modules and this device's build strings — while the store is being
// created, so an eligible headset opens at `preparing` and the navigator mounts
// on the FIRST render. A child who pressed a key marked with a headset used to
// read a flat card telling them the app was thinking about it; the wait is the
// same length either way, and the panel's own wait card serves it in the medium
// they asked for.
//
// PERMISSION IS THE ONE ANSWER THAT CANNOT BE HAD IN TIME, and it is the one
// thing the flat panel is still for. `checkPermissions` is a round trip, so the
// scene is already up when it lands; a no demotes the lifecycle back out to the
// primer, which renders flat because it has to — a consent question asked from
// inside the immersive scene it grants consent for is a question already
// answered. Tracking loss after that is an INTERRUPTION, never an ending: the
// board stays where the child put it and the strokes stay in the document.
// SOT: packages/app/features/tutor/board-session.ts · packages/app/features/tutor/xr-capability.ts
//      packages/app/features/tutor/xr-eligibility.ts · packages/ui/xr/XrPanel.types.ts
//      docs/decisions/adr-117-spatial-whiteboard-bridge.md
// SOT-KEYWORDS: tutor xr screen spatial whiteboard viro quest scene rail chat board session native permission primer tracking lifecycle calibration constrained layout fits miss direct entry

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ViroAmbientLight,
  ViroARScene,
  ViroController,
  ViroDirectionalLight,
  ViroTrackingStateConstants,
  ViroXRSceneNavigator,
  checkPermissions,
  requestRequiredPermissions,
  type ViroTrackingState,
} from '@reactvision/react-viro';
import {
  Button,
  Text,
  WhiteboardBoard,
  type WhiteboardCalibration,
  type WhiteboardDiff,
  type WhiteboardDiffSource,
  type WhiteboardHandle,
} from '@acme/ui';
import { View as UiView } from '@acme/ui/primitives';
import {
  BoardTextureHost,
  XrBoardInk,
  XrBoardLive,
  XrBoardRaster,
  XrChatPanel,
  XrPanel,
  XrPlacementControls,
  XrQuestionLine,
  XrRail,
  XR_COLOR,
  XR_MATERIAL,
  boardComposition,
  boardSurfacePixels,
  BOARD_ASPECT,
  layoutBoard,
  placeInFrontOf,
  railContentHeight,
  railWidthFor,
  spatialDistance,
  spatialSpacing,
  uncoveredRecords,
  type BoardLayoutMiss,
  type BoardTextureBinding,
  type XrHeadPose,
  type XrVector3,
  type XrChatRow,
  type XrPanelState,
  type XrSurfaceInput,
} from '@acme/ui/xr';
import { buttonSizeForBand } from '../capture';
import {
  acquireBoardSession,
  boardSessionKey,
  releaseBoardSession,
  type BoardSession,
} from './board-session.ts';
import { boardPersistence } from './board-storage.ts';
/* `.native` in the specifier for the same reason `Whiteboard` is imported from
   the package's native fork: the hook reaches the engine handle, and nothing on
   a web resolver's path may name it. */
import { useBoardRaster } from './board-raster.native.ts';
/* `.native` implicitly — this file is itself a `.native` fork, and she mounts a
   Viro object nothing on a web resolver's path may name. */
import { XrNatalie } from './XrNatalie.native.tsx';
import { useTutorStore } from './tutor.store.ts';
import type { TutorXrScreenProps } from './tutor-xr-screen.types.ts';
import { SPATIAL_PERMISSIONS, spatialPermissionsGranted } from './xr-capability.ts';
/* Bare specifier, so the `.native` fork is what a native bundle resolves and
   nothing on a web resolver's path ever names the renderer. */
import { currentXrEligibility } from './xr-eligibility';
import { panelStateOf, useXrSession, type XrPhase } from './xr-session.store.ts';

/** This presentation's id, so its own strokes are not echoed back at it. */
const PRESENTATION_ID = 'tutor-xr';

/** How many turns the spatial panel shows. See its header for why it is small. */
const CHAT_WINDOW = 4;

/**
 * The live objects the scene needs and cannot be handed as props.
 *
 * `ViroARSceneNavigator` captures `initialScene` in its constructor and renders
 * it as a component type from then on, so neither the scene function nor its
 * `passProps` can be replaced by a later render. Anything the scene must react
 * to therefore travels through a store (`useXrSession`); anything it merely
 * needs a reference to — the engine handle, the session, the way out — travels
 * through this holder, set by the screen that owns them.
 *
 * One entry rather than a map because there is exactly one spatial screen: it
 * is a full-immersion route, and a second would be a second headset.
 */
const active: {
  engine: WhiteboardHandle | null;
  session: BoardSession | null;
  onExit: () => void;
  onAsk: (png: string | null) => void;
  /**
   * THE LAST CALIBRATION VERDICT, and it is here rather than in the store
   * because it is never rendered from — the phase is.
   *
   * It exists because two other things promote the board to `ready` and neither
   * of them knows anything about the engine's mapping: the engine reporting an
   * editor, and the renderer reporting that tracking came back. A calibration
   * failure that lands while the phase is still `checking` is DROPPED by the
   * transition table, and a tracking blink after one would otherwise clear it —
   * either way a child ends up on a board whose ink lands somewhere they did
   * not point, with the screen saying it is ready. So both promotions read this
   * first and re-assert the interruption instead.
   *
   * It starts `true` — the board is trusted until it says otherwise — which is
   * the same direction the engine itself starts in: nothing is injected before
   * `mounted`, and `mounted` is what runs the first probe.
   */
  inkAligned: boolean;
  /**
   * WHERE THE CHILD'S HEAD IS, as the renderer last reported it.
   *
   * Here and not in the store for the reason `inkAligned` is: it arrives on a
   * renderer callback at frame rate and nothing renders from it. What reads it
   * is placement — the first pose the scene sees, and every recenter after
   * that — and both write a placement into the store, which is the thing the
   * composition is actually drawn from.
   */
  head: XrHeadPose | null;
} = {
  engine: null,
  session: null,
  onExit: () => undefined,
  onAsk: () => undefined,
  inkAligned: true,
  head: null,
};

/** The engine handle, as a stable reader — see `strokeOpen` in `BoardScene`. */
const readEngine = () => active.engine;

/** The composition's own case, so the two callers that place it cannot disagree. */
const BOARD_PLACE = { distanceM: spatialDistance.board, dropM: boardComposition.anchorDrop };

/** Where a board goes when the engine's mapping is the thing that is wrong. */
const INK_INTERRUPTED = { kind: 'interrupted', reason: 'calibration-failed' } as const;

/**
 * The phase a board that has an engine and a scene should be in — `ready`,
 * unless the last thing the engine said about its own mapping was that it is
 * wrong. One expression, because both promotion sites have to make the same
 * call and a second copy is a second answer.
 */
function readyOrInterrupted(): XrPhase {
  return active.inkAligned ? { kind: 'ready' } : INK_INTERRUPTED;
}

/** The paper's height, from the one aspect the board is allowed to have. */
const BOARD_HEIGHT = (boardComposition.boardWidth * BOARD_ASPECT.h) / BOARD_ASPECT.w;

/**
 * THE RENDERER'S OWN VERDICT ON WHETHER IT KNOWS WHERE THE ROOM IS.
 *
 * `ViroARScene.onTrackingUpdated` is the only signal in the installed package
 * that reports this, and its three states are an enum, not booleans
 * (`ViroTrackingStateConstants`). Limited and unavailable are BOTH interruptions
 * and are kept apart only in the reason, because a child cannot act on the
 * difference — the answer to each is the same one: wait, your work is safe.
 *
 * A module-level handler rather than a callback built in the scene: the scene is
 * captured by the navigator's constructor, so a handler rebuilt on a later
 * render would never be installed anyway, and one that closes over nothing
 * cannot go stale. It reads the store through `getState` for the same reason.
 *
 * TRACKING RETURNING IS NOT READINESS. Normal tracking promotes an INTERRUPTED
 * board back to ready and does nothing else; a scene that tracked the room
 * before the engine had an editor would otherwise announce a drawable board a
 * child's pencil falls straight through. The lifecycle table enforces it —
 * `preparing → ready` is the engine's move to make, not the renderer's.
 */
function handleTrackingUpdated(state: ViroTrackingState): void {
  const { advance, phase } = useXrSession.getState();
  if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
    /*
      THE ROOM COMING BACK DOES NOT VOUCH FOR THE ENGINE. This used to promote
      any interruption at all, so a tracking blink over a board whose mapping
      had already failed handed the child a `ready` board that still put ink in
      the wrong place — and it cleared the one sentence telling them why. The
      renderer only gets to end the interruption it caused.
    */
    if (phase.kind === 'interrupted') advance(readyOrInterrupted());
    return;
  }
  advance({
    kind: 'interrupted',
    reason:
      state === ViroTrackingStateConstants.TRACKING_UNAVAILABLE
        ? 'tracking-lost'
        : 'tracking-limited',
  });
}

/**
 * THE CHILD'S HEAD, EVERY FRAME, AND THE ONE FRAME IT DECIDES ANYTHING.
 *
 * `onCameraTransformUpdate` is how a scene that cannot close over state learns
 * where its user is. Two things read it and both write a placement rather than
 * rendering from the pose: the FIRST pose after the scene mounts, which is what
 * puts the board in front of the child instead of at the scene origin, and
 * recenter.
 *
 * WHY THE FIRST POSE MATTERS MORE THAN IT SOUNDS. The composition opened at a
 * constant `[0, -0.1, -1.5]`, which is "just below the eye line, 1.5 m out"
 * only when the scene's origin is the head. A PICO references it to the FLOOR,
 * so on device the board, the rail and Natalie were at the child's feet with
 * the panel above them still saying the board was in front of them. The fix is
 * not a height to subtract — see `board-placement.ts`.
 *
 * It fires at frame rate and does nothing on all but the first, which is why
 * the pose lives in the holder and the guard is a null check rather than a
 * comparison: a placement written every frame would fight the child's own drag.
 */
function handleCameraTransform(transform: { position: XrVector3; forward: XrVector3 }): void {
  const pose: XrHeadPose = { position: transform.position, forward: transform.forward };
  const first = active.head === null;
  active.head = pose;
  if (!first) return;
  useXrSession.getState().setPlacement(placeInFrontOf(pose, BOARD_PLACE));
}

/**
 * What a composition that does not fit says to the child, per miss.
 *
 * A CONSTRAINED BOARD IS A STATE, NOT AN ERROR, and the two misses are
 * different sentences because they have different next moves — which is the
 * whole reason `BoardLayoutMiss` is a union rather than a boolean
 * (`05-handoff.md` §6).
 *
 * `rail-below-target` is the one a child can fix, and it is the one they will
 * actually meet: the rail is sized for a K–2 learner at the board's own
 * distance, so dragging the paper further out is all it takes to put every key
 * under the 4° floor. The answer is in the sentence — pull it back, or press
 * the key that puts it back — and both are affordances already on screen.
 *
 * `no-room` cannot be reached from this caller today: the width budget is
 * `boardWidth + railWidth + railGap` less the rail and the gap, which is
 * `boardWidth`, and the chat is not in this budget at all. It is answered
 * anyway because the day the companion joins the budget it becomes reachable,
 * and an unhandled miss renders as a full-size board a child cannot use.
 *
 * Neither line names a screen a child in a headset cannot see; both say where
 * the work is, which is the only thing every dead end in this feature owes
 * them.
 *
 * `Recenter` is quoted because it is the key's own visible label
 * (`XrOrnaments.native.tsx`) — a sentence that tells a child to press something
 * has to use the word written on it. `04-copy.md` §3.6 proposes renaming that
 * key; this line moves with it.
 */
const MISS_ASSURANCE: Record<BoardLayoutMiss, string> = {
  'rail-below-target':
    'Your board is too far away to reach the pens. Pull it closer by its edge, or press Recenter to put it back.',
  'no-room':
    'There is not enough room here for your board and its pens. Take the headset off and your board is there, with everything you wrote.',
};

/**
 * The line under Natalie's name — hers normally, and the reason the board is
 * not taking ink whenever it is not.
 *
 * All of them are assurances and that is why they share the slot: every one
 * says the work is safe, and they exist to stop a board that has stopped taking
 * ink from reading as a board that has lost what is on it.
 *
 * THE ORDER IS THE POINT. A phase interruption comes first because it is the
 * one that resolves itself — a child told to drag their paper closer while the
 * headset is still finding the room would be moving a board that is about to
 * come back on its own. The layout miss speaks once the board is otherwise
 * fine, which is exactly when its instruction is worth following.
 */
function assuranceFor(phase: XrPhase, miss: BoardLayoutMiss | null): string {
  if (phase.kind === 'interrupted') {
    if (phase.reason === 'tracking-lost') {
      return 'The headset is finding your room again. Your work is safe — it comes back on its own.';
    }
    if (phase.reason === 'tracking-limited') {
      return 'The headset is having trouble seeing your room. Move gently; your work is safe.';
    }
    /*
      The mapping between the ray and the engine is wrong, so the board is not
      taking marks — see `active.inkAligned`. The cause is inside the engine and
      there is nothing in the room to adjust, so the line asks for nothing: it
      says what is happening, and that the work is safe.
    */
    return 'Your board is lining itself up, so it cannot take new marks yet. Everything you wrote is safe.';
  }
  if (miss !== null) return MISS_ASSURANCE[miss];
  return "Press Ask and she'll see your board.";
}

/**
 * THE SCENE, as a stable component type.
 *
 * It reads its state rather than receiving it, for the constructor-capture
 * reason above. Every hook here is a narrow selector: a scene that re-rendered
 * on every message of a streaming tutor turn would rebuild the board's polyline
 * set at token rate.
 */
function BoardScene() {
  const phase = useXrSession((s) => s.phase);
  const placement = useXrSession((s) => s.placement);
  const setPlacement = useXrSession((s) => s.setPlacement);
  const recenter = useXrSession((s) => s.recenter);
  const tool = useXrSession((s) => s.tool);
  const ink = useXrSession((s) => s.ink);
  const asking = useXrSession((s) => s.asking);
  const band = useXrSession((s) => s.band);
  /*
    NO `registerXrMaterials()` CALL SITS HERE ANY MORE. It was added on the
    theory that `VRActivity`'s renderer had its own material registry this
    scene was missing; the renderer has no such thing, and the blank headset
    that suggested it was a `ReferenceError` on this component's first render.
    The argument in full, with the source that settles it, is on the function
    itself — `packages/ui/xr/spatial-materials.native.ts`.
  */
  /*
    THE COUNT OF WHAT THIS RENDERER COULD NOT DRAW, finally on a surface a child
    reads. `skippedRecords` and `setSkipped` were written with the store and
    never called by anything, so a board silently missing the child's typed note
    looked exactly like a complete one. `XrBoardInk` now reports the number and
    the companion panel says it; zero renders nothing.
  */
  const skippedRecords = useXrSession((s) => s.skippedRecords);
  const setSkipped = useXrSession((s) => s.setSkipped);
  const revision = useXrSession((s) => s.revision);

  const messages = useTutorStore((s) => s.messages);
  const stageKind = useTutorStore((s) => s.state.kind);
  const problem = useTutorStore((s) => s.problem);

  const session = active.session;

  /*
    Whether a stroke this scene opened is still open, mirrored from what was
    handed to the engine rather than asked for back. A ref and not state: it
    changes at pointer rate and nothing renders from it — it exists so a stroke
    can be closed if the board stops accepting ink half way through one.
  */
  const drawing = useRef(false);
  /* Read through a stable function rather than passed as a value: the hook's
     effect must not re-run because a ref's contents moved, and `active.engine`
     is set by an effect in the screen above rather than by a render. */
  const strokeOpen = useCallback(() => drawing.current, []);

  /*
    The records, re-read when the document moves. Not memoised on `session`
    alone: the whole point of `revision` is that the document mutates in place.
  */
  const store = useMemo(() => {
    void revision;
    if (session === null) return {};
    return (session.doc.snapshot() as { document: { store: Record<string, unknown> } }).document
      .store;
  }, [revision, session]);

  /*
    THE BOARD ITSELF, AS A PICTURE, so the paper shows the whole document and
    not just the parts this renderer has a primitive for. `XrBoardInk` draws the
    strokes the picture is too new to contain — see `board-raster.native.ts` for
    which those are and why the overlap between the two layers is the safe
    direction to be wrong in.
  */
  /*
    AND WHETHER THE PAGE ITSELF IS ON THE PAPER, which decides whether any of
    that runs at all. `boardTextureBound` is the host's answer to one bind
    attempt (`BoardTextureHost`): bound, the child looks at the engine's own
    surface and a raster would be a second, older copy of it drawn underneath;
    not bound, this pair IS the board and nothing about it changes.
  */
  const boardTextureBound = useXrSession((s) => s.boardTextureBound);
  const raster = useBoardRaster(
    readEngine,
    store,
    session !== null && !boardTextureBound,
    strokeOpen,
  );
  const liveStore = useMemo(() => uncoveredRecords(store, raster.covered), [raster.covered, store]);

  /*
    Nothing is skipped when the page is what is drawn: `strokeOf`'s gaps — text,
    notes, arrows, images — are the polyline renderer's, and the engine has no
    such gaps in its own picture of itself. The count is cleared rather than
    left at whatever `XrBoardInk` last reported before it unmounted, or the
    companion panel would keep telling a child something is missing from a board
    that is showing them everything.
  */
  useEffect(() => {
    if (boardTextureBound) setSkipped(0);
  }, [boardTextureBound, setSkipped]);

  const distanceM = Math.abs(placement.position[2]);
  /*
    Controllers, not hands, until the runtime says otherwise — the smaller of
    the two hit-target multipliers is the one that must not be assumed, so the
    assumption here is the conservative direction only once hand tracking is
    actually reported. Wired as a constant rather than hidden in a token so the
    day it becomes dynamic there is one place to change.
  */
  const handsPrimary = false;

  /*
    The composition, from the one layout function both presentations share. A
    space that cannot hold the rail at its angular floor reports `fits: false`
    rather than shrinking a child's controls under a reachable size.
  */
  const geometry = layoutBoard({
    W: boardComposition.boardWidth + boardComposition.railWidth + boardComposition.railGap,
    H: BOARD_HEIGHT,
    R: boardComposition.railWidth,
    G: boardComposition.railGap,
    /*
      THE FLOOR, UNCLAMPED. It used to arrive as
      `Math.min(railWidth, minHitSize(…))`, which is `minRail <= R` by
      construction — a floor the allocated rail can never fall below is a guard
      that never runs, and it is why a six-year-old's keys shrank silently
      instead of the layout reporting `rail-below-target`. `railWidthFor` is the
      one expression `board-layout` names for this argument.
    */
    minRail: railWidthFor(distanceM, handsPrimary, band),
  });
  const boardWidth = geometry.fits ? geometry.boardWidth : boardComposition.boardWidth;
  const boardHeight = geometry.fits ? geometry.boardHeight : BOARD_HEIGHT;
  /*
    THE MISS, KEPT RATHER THAN DISCARDED. The two lines above read the same as
    they did when this was `geometry.fits ? … : …` and nothing else — the paper
    is still drawn at its design size, because the paper is not what the miss is
    about and shrinking it would make a child's writing smaller to punish them
    for a rail that does not fit. What changed is that the miss now reaches the
    panel and the assurance line instead of being thrown away, which is what
    turned an unreachable rail into a board that says nothing.

    IT IS NOT A PHASE TRANSITION, and that is deliberate. `fits` is derived from
    `placement` and is recomputed every render: a child dragging the board out
    and back would drive `ready → interrupted → ready` at drag-sample rate
    through a machine whose whole contract is that nothing advances on a render.
    The lifecycle answers "what is this screen doing"; the composition answers
    "does what it is doing fit here", and only the second one changes while a
    child's hand is moving. So the miss narrows the state the PANEL is given —
    its own union, its own `interrupted` treatment, board stays drawn — and the
    store's phase is left to the four things that actually happen to it.
  */
  const miss: BoardLayoutMiss | null = geometry.fits ? null : geometry.miss;

  /*
    THE RAIL IS AS TALL AS ITS OWN CONTENT, and stopped being as tall as the
    paper when the paper turned landscape. It was `height={boardHeight}`, which
    worked while the board was portrait — 0.77 m held two columns of four
    floor-sized keys with room over. A 6:4 board is 0.4 m, which holds two rows,
    and eight controls in two rows is four columns: a 0.81 m slab beside a 0.6 m
    board, 38° off centre, which is not a rail a child can reach.

    So the rail keeps its two-by-four grid and takes the height that grid needs.
    It is taller than the paper now — a sidebar rather than a margin — and that
    is the trade: the alternative shrinks a six-year-old's keys, which is the
    one thing `railWidthFor` and `layoutBoard` both exist to refuse.
  */
  /*
    Where Natalie stands: the composition's right edge plus a margin, in world
    space — the anchor's local +X turned by its yaw. Her feet are at y = 0
    because the PICO runtime is floor-referenced (native LOCAL_FLOOR); under a
    head-referenced fallback origin this puts her roughly floor-level too,
    which is the degradation a dev phone can live with.
  */
  const natalieYawRad = (placement.rotation[1] * Math.PI) / 180;
  const natalieRight =
    boardWidth / 2 + boardComposition.chatGap + boardComposition.chatWidth + 0.35;
  const nataliePosition: [number, number, number] = [
    placement.position[0] + Math.cos(natalieYawRad) * natalieRight,
    0,
    placement.position[2] - Math.sin(natalieYawRad) * natalieRight,
  ];

  const railHeight = Math.max(
    boardHeight,
    railContentHeight(distanceM, handsPrimary, band) + spatialSpacing.xs * 2,
  );

  /*
    A board that cannot hold a reachable rail is not a ready board. Only `ready`
    is overridden: `checking` and `preparing` still owe the child their wait
    card, `unsupported` and `exiting` are already the stronger statement, and an
    interruption already says something truer about why the board is not taking
    ink.
  */
  const panelState: XrPanelState = panelStateOf(phase);
  const composedState: XrPanelState =
    miss !== null && panelState === 'ready' ? 'interrupted' : panelState;

  /*
    WHETHER INK WOULD LAND WHERE THE CHILD POINTED. The engine measures this
    itself and reports it (`WhiteboardHandle.calibrate`); the screen turns a
    failure into this phase, and this is where that verdict stops being a
    sentence and starts being enforced.
  */
  const inkLands = !(phase.kind === 'interrupted' && phase.reason === 'calibration-failed');

  const chatRows: readonly XrChatRow[] = messages.slice(-CHAT_WINDOW).map((message) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    attachments: message.attachments?.length,
  }));

  /*
    A RAY ON THE PAPER IS A POINTER IN THE ENGINE.

    The panel has already done the only coordinate transform there is — a world
    hit to `(u, v)` on the surface — so this multiplies by the engine's pixel
    size and stops. Transforming again here is the bug the comment exists to
    prevent: ink that trails the ray by a fraction of the paper reads as a
    tracking fault and is actually two matrices.

    Nothing on this path touches React state. A pointer arrives at display rate;
    the document moves at stroke rate, when the engine reports the change.
  */
  const handleSurfaceInput = (sample: XrSurfaceInput) => {
    /*
      A MEASURED-WRONG MAPPING STOPS THE INK AT THE SEAM, and it has to stop
      here rather than in the panel: `XrPanel` draws in `interrupted` on purpose
      — a tracking blink must not take the paper away mid-thought — so the rays
      keep arriving and something has to decline them. Ink under the wrong
      finger is the outcome the whole calibration path exists to prevent, and it
      is worse than a stroke that does not appear while the panel says why.

      A stroke already open is CANCELLED rather than left hanging. The engine
      would otherwise keep a half-line whose end the child never chose, and the
      abort is the one the fork implements for exactly this (`'cancel'` removes
      the record and closes the batch empty). Everything after that is dropped
      until the engine says the mapping is good again.
    */
    if (!inkLands) {
      if (!drawing.current) return;
      drawing.current = false;
      active.engine?.injectPointer({
        phase: 'cancel',
        x: sample.u * boardSurfacePixels.width,
        y: sample.v * boardSurfacePixels.height,
      });
      return;
    }
    if (sample.phase === 'begin') drawing.current = true;
    else if (sample.phase !== 'move') drawing.current = false;
    active.engine?.injectPointer({
      phase: sample.phase,
      x: sample.u * boardSurfacePixels.width,
      y: sample.v * boardSurfacePixels.height,
      pressure: sample.pressure,
    });
  };

  /*
    The scene's contents, held apart from the root that wraps them. The root is
    still an open question — see the return below — and keeping the two
    separate is what makes changing it a one-line move rather than a re-indent
    of the whole tree.
  */
  const content = (
    <>
      {/*
        THE POINTER, WITHOUT WHICH NOTHING IN THIS SCENE CAN BE DRAWN ON.

        `onDrag` and `onClick` on a `ViroNode` never fire on an OpenXR headset
        unless a `ViroController` is mounted in the scene — it is what raycasts
        the controller and delivers the hit. The board rendered, the rail
        rendered, and a child drawing on the paper produced nothing at all: the
        engine had no pointer to hit-test with, so `XrPanel`'s input quad was
        never touched and `injectPointer` was never called.

        This is the same fix, for the same symptom, as the Danger Room scene's
        passthrough toggle that "did nothing" until the controller was added.
      */}
      <ViroController controllerVisibility reticleVisibility />
      <ViroAmbientLight color="#ffffff" intensity={600} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.5]} intensity={800} />
      {/*
        NATALIE, IN THE ROOM — to the child's right of the paper, past her own
        chat panel, standing on the floor and turned toward them. Same voice,
        same A2F face, same idle engine as the 2D pane (`XrNatalie`'s header).

        HER FEET: on a PICO the runtime references the world to the FLOOR, so
        y = 0 is the ground she stands on. Her yaw is the composition's own —
        the board already faces the child, and she stands in its frame.
      */}
      <XrNatalie position={nataliePosition} rotationY={placement.rotation[1]} />
      <XrPanel
        width={boardWidth}
        aspect={BOARD_ASPECT}
        placement={placement}
        onPlacementChange={setPlacement}
        onSurfaceInput={handleSurfaceInput}
        state={composedState}
        moveHandle="frame"
        ornaments={{
          leading: {
            extent: boardComposition.railWidth,
            gap: boardComposition.railGap,
            node: (
              <XrRail
                width={boardComposition.railWidth}
                height={railHeight}
                distanceM={distanceM}
                handsPrimary={handsPrimary}
                band={band}
                tool={tool}
                ink={ink}
                canUndo={session?.doc.canUndo() ?? false}
                canRedo={session?.doc.canRedo() ?? false}
                asking={asking}
                onTool={(next) => {
                  useXrSession.getState().setTool(next);
                  active.engine?.setTool(next);
                }}
                onInk={(next) => {
                  useXrSession.getState().setInk(next);
                  active.engine?.setInk(next);
                }}
                onUndo={() => session?.doc.undo()}
                onRedo={() => session?.doc.redo()}
                /*
                  The same road a photographed worksheet travels: the engine
                  exports a PNG and the tutor screen stages it as an attachment
                  on a turn. Nothing new reaches the model because the board is
                  being looked at in a headset.
                */
                onAsk={() => {
                  useXrSession.getState().setAsking(true);
                  void active.engine?.exportPng().then((png) => {
                    useXrSession.getState().setAsking(false);
                    active.onAsk(png);
                  });
                }}
                onClear={() => active.engine?.clear()}
              />
            ),
          },
          /* The question, and only the question — the one thing the 2D work
             pane puts above the paper. Photographs stay in the thread. */
          top: {
            extent: boardComposition.topOrnamentHeight,
            gap: boardComposition.ornamentGap,
            node: <XrQuestionLine text={problem} width={boardWidth} />,
          },
          bottom: {
            extent: boardComposition.bottomOrnamentHeight,
            gap: boardComposition.ornamentGap,
            node: (
              <XrPlacementControls
                width={boardWidth}
                distanceM={distanceM}
                handsPrimary={handsPrimary}
                band={band}
                /*
                  Recenter reads the head the renderer last reported, so the
                  board comes back to where the CHILD is now — the point of the
                  control. Passing nothing would send it to the pre-pose
                  placement, which is the scene origin and, on a floor-referenced
                  runtime, the floor.
                */
                onRecenter={() => recenter(active.head ? placeInFrontOf(active.head, BOARD_PLACE) : undefined)}
                onExit={() => active.onExit()}
              />
            ),
          },
        }}
        companion={{
          zone: 'peripheralRight',
          width: boardComposition.chatWidth,
          height: boardHeight,
          gap: boardComposition.chatGap,
          yawDeg: boardComposition.chatYawDeg,
          node: (
            <XrChatPanel
              width={boardComposition.chatWidth}
              height={boardHeight}
              distanceM={distanceM}
              handsPrimary={handsPrimary}
              band={band}
              tutorName="Natalie"
              status={statusLabel(stageKind)}
              /*
                WHAT SHE CAN ACTUALLY SEE. The board does not stream to her —
                `onAsk` exports a PNG and the tutor screen stages it as an
                attachment, which is the only moment any of this reaches her.
                The line said she could see the board, which told a child their
                working was being watched and was not true either way.

                AN INTERRUPTION SPEAKS HERE, and this is the only slot in the
                composition that can carry it: the panel's own wait card is for
                `checking` and `preparing`, and an interrupted board stays
                DRAWN — the whole point of the state. So the assurance line is
                what tells a child their homework is safe while the headset
                finds the room again, rather than a card covering the work.

                A CONSTRAINED COMPOSITION SPEAKS HERE TOO, which is where this
                caller parts company with `05-handoff.md` §6's "drop the
                companion", and the reason is arithmetic. That bullet frees
                width for the paper — but the chat is not in this caller's
                budget (`layoutBoard` is given no `C`), so dropping it frees
                nothing, and `rail-below-target` is an angular floor that no
                width anywhere can satisfy. Dropping the panel would only take
                away the one surface in the scene that can tell a child what to
                do about it.
              */
              assurance={assuranceFor(phase, miss)}
              rows={chatRows}
              earlierCount={Math.max(0, messages.length - CHAT_WINDOW)}
              skippedCount={skippedRecords}
              inputLocked={stageKind === 'ended' || stageKind === 'crisis'}
            />
          ),
        }}
      >
        {/*
          TWO PRESENTATIONS OF ONE DOCUMENT, and which one is drawn is not a
          preference — it is whether the renderer is holding the engine's own
          surface. `XrBoardLive` is the page: everything the child made, as they
          make it. The pair below it is what a board looked like before that was
          possible, and it stays because every way the binding can fail has to
          land somewhere that still shows a child their homework.

          NEVER BOTH. They occupy the same layer (`boardLayer.raster`) and would
          z-fight at a distance a headset renders in millimetres.
        */}
        {boardTextureBound ? (
          <XrBoardLive width={boardWidth} height={boardHeight} />
        ) : (
          <>
            <XrBoardRaster uri={raster.uri} width={boardWidth} height={boardHeight} />
            {/*
              The live layer, and only the live layer. `liveStore` is the records
              the picture behind it does not already show, so a settled board
              draws no polylines at all and the count below reports what is
              missing NOW — which is what it always claimed to be.
            */}
            <XrBoardInk
              store={liveStore}
              width={boardWidth}
              height={boardHeight}
              onSkippedCount={setSkipped}
            />
          </>
        )}
      </XrPanel>
    </>
  );

  /*
    THE ROOT STAYS `ViroARScene`, AND THE CASE AGAINST IT WAS NEVER ACTUALLY RUN.

    For a run of builds this scene drew nothing in the headset and the root was
    the leading suspect. `ViroARScene` is the MIXED-REALITY root — anchors,
    `ViroARPlane`, passthrough — and the package's guide does say a
    fully-virtual scene is rooted in `ViroScene` (`QUEST_SETUP` §4, and the
    "pure VR vs mixed-reality root" pitfall in §Common pitfalls).

    None of that is why nothing drew. Every one of those builds threw
    `ReferenceError: Property 'ViroNode' doesn't exist` on the first render of
    this component — a probe block used `ViroNode` without importing it — so
    the tree never mounted and the only thing left drawing was the reticle the
    renderer draws for itself. The root, the backdrop sphere, the floor and the
    material re-registration were all diagnosed against a scene that was
    throwing, so none of them is evidence for anything.

    It stays on the evidence there is: the Danger Room scene renders on this
    renderer, on headset hardware, from a `ViroARScene` root with
    `passthroughEnabled` and hdr/bloom/pbr all off — which is the navigator
    config below. If the board is still absent now the tree mounts, the root is
    the next thing to move: `ViroScene`, passed as `vrInitialScene`. That swap
    takes `onTrackingUpdated` with it, because it reports tracking of a room
    only the AR root is looking at.
  */
  return (
    <ViroARScene
      onTrackingUpdated={handleTrackingUpdated}
      onCameraTransformUpdate={handleCameraTransform}
    >
      {content}
    </ViroARScene>
  );
}

/** Stable, for the same constructor-capture reason. */
const INITIAL_SCENE = { scene: BoardScene };

export function TutorXrScreen({ ageBand, onExit, onAsk, asking = false }: TutorXrScreenProps) {
  const sessionId = useTutorStore((s) => s.sessionId);
  const phase = useXrSession((s) => s.phase);
  const advance = useXrSession((s) => s.advance);
  const bumpRevision = useXrSession((s) => s.bumpRevision);

  const engine = useRef<WhiteboardHandle>(null);

  /*
    THE SAME DOCUMENT THE 2D SCREEN WAS USING. `acquireBoardSession` hands back
    the existing one for this key — the registry outlives both routes, which is
    the whole reason it exists — so there is no restore, no fetch and no empty
    board on the way in.
  */
  const key = boardSessionKey(sessionId);
  const [session, setSession] = useState<BoardSession>(() =>
    acquireBoardSession(key, boardPersistence),
  );

  /*
    A CHANGED KEY IS A DIFFERENT BOARD, AND THIS SCREEN CAN SEE ONE CHANGE.

    The key was read once and the session held forever, which was wrong here in
    a way it is not on a screen that cannot outlive the change: a child can
    press Ask in the headset, which sends a turn, which is the moment the server
    session is created and `sessionId` goes from null to a real id. The 2D
    workbench re-acquires on that (its `heldKey` dance, copied here verbatim
    because two boards must not disagree about which document they are on) —
    while this screen kept drawing into the DRAFT document. The child would have
    come back to a board missing everything they wrote in space.

    The old code also released on every `sessionId` render, because the id was a
    dependency of the effect that owned the hold: the hold count fell on a
    change that was not a departure, and reaching zero writes.
  */
  const [heldKey, setHeldKey] = useState(key);
  if (heldKey !== key) {
    releaseBoardSession(heldKey);
    setHeldKey(key);
    setSession(acquireBoardSession(key, boardPersistence));
  }

  useEffect(() => {
    session.setSessionId(sessionId);
  }, [session, sessionId]);

  /* The hold is released on the way out, and only there. */
  useEffect(() => () => releaseBoardSession(heldKey), [heldKey]);

  /*
    LEAVING IS A STATE BEFORE IT IS A POP. `exiting` stops the panel handing the
    surface any more rays — `XrPanel` only draws in `ready` and `interrupted` —
    so a stroke in flight is abandoned rather than committed at whatever point
    the ray happened to be when the route went away.
  */
  const handleExit = useCallback(() => {
    advance({ kind: 'exiting' });
    onExit();
  }, [advance, onExit]);

  /*
    The scene reads these rather than receiving them — see `active`.

    `engine` IS DELIBERATELY NOT CLEARED HERE, and that is the whole reason this
    effect and the attach effect below are separate. They have different
    dependencies: this one re-runs whenever the callbacks change identity, the
    attach one only when the engine or the session does. Clearing the handle
    from this cleanup therefore nulled it on an ordinary re-render and nothing
    ever put it back — the ray kept hitting the paper and no ink appeared, with
    no error anywhere. Whoever sets a slot clears it.
  */
  useEffect(() => {
    active.session = session;
    active.onExit = handleExit;
    active.onAsk = onAsk;
    return () => {
      active.session = null;
      active.onExit = () => undefined;
      active.onAsk = () => undefined;
    };
  }, [handleExit, onAsk, session]);

  useEffect(() => {
    useXrSession.getState().setAsking(asking);
  }, [asking]);

  /*
    THE BAND REACHES THE SCENE THE ONLY WAY IT CAN. `minHitSize` takes it, the
    rail, the chat panel's action row and the placement keys all size from it,
    and none of them can be handed it as a prop through a scene the navigator
    captured in its constructor.

    SEEDED DURING THIS RENDER RATHER THAN IN AN EFFECT, and the direct entry is
    what forces that. An effect runs after the commit, and the commit now
    CONTAINS the navigator — so the scene's constructor would capture a board
    laid out at the store's conservative start value and the first frame in the
    headset would be an adult's rail for a six-year-old. A `useState`
    initialiser runs once, in the body, before this component returns the tree
    the navigator is built from.

    The effect stays for the other case: `ageBand` changing under a mounted
    screen, which the initialiser cannot see.
  */
  useState(() => {
    useXrSession.getState().setBand(ageBand);
    return null;
  });
  useEffect(() => {
    useXrSession.getState().setBand(ageBand);
  }, [ageBand]);

  /*
    `onRecords` rather than `onRemote`: this renderer must see the child's OWN
    strokes, and the engine subscription is deliberately blind to them (see
    `board-doc`). A counter rather than the records themselves, because a Yjs
    document mutates in place and must never become React state.
  */
  useEffect(() => session.doc.onRecords(() => bumpRevision()), [bumpRevision, session]);

  /*
    STEP ONE: WHY THIS BINARY ON THIS DEVICE COULD NOT OPEN A BOARD IN SPACE.

    The store has already asked WHETHER — `openingPhase` calls the same
    `currentXrEligibility`, synchronously, to decide between opening at
    `preparing` and opening at `checking`. What it deliberately does not do is
    name the reason: `unsupported` is a phase with no way out but `exiting`, and
    a module evaluating at import time should not be able to put a child in one
    before anything has been asked to open. So the verdict is re-read here,
    where there is a screen to render it on, and the two answers cannot disagree
    because they are one function over module-level constants.

    Runs once. `phase` is deliberately NOT a dependency — this is the entry
    check, and re-running it when the phase moves is how a screen ends up asking
    for the camera again after the child has answered.
  */
  useEffect(() => {
    let live = true;
    /*
      Either opening phase is a screen that has not run this yet. `preparing` is
      an eligible headset with the scene already up, `checking` is everything
      else on its way to `unsupported` — and anything further along is a
      lifecycle already in motion, which this must not restart.
    */
    const opening = useXrSession.getState().phase.kind;
    if (opening !== 'checking' && opening !== 'preparing') return;

    const eligibility = currentXrEligibility();
    if (eligibility !== 'eligible') {
      advance({ kind: 'unsupported', reason: eligibility });
      return;
    }

    /*
      STEP TWO: ASK THE RUNTIME WHAT IT ALREADY HAS, WITHOUT PROMPTING.

      `checkPermissions` is the non-prompting half of the pair, which is what
      makes the primer possible at all: a child who has already granted the
      camera on a previous lesson goes straight to their board, and one who has
      not reads why before the system dialog appears in front of them.

      IT NOW RUNS UNDER A SCENE THAT IS ALREADY MOUNTED, and that is the cost of
      opening directly. Granted — the overwhelmingly common case, because the
      camera is granted once and a lesson is not the first thing a headset is
      used for — is a no-op: `preparing → preparing` is not a move and `advance`
      drops it without a render. Not granted pulls the lifecycle back out to the
      primer, which unmounts the navigator; the child sees the scene for the
      fraction of a second the round trip takes, then the question. That is the
      wrong order for an ANSWER but the right one for a WAIT, and it is the only
      shape available: the runtime cannot be asked synchronously.

      A rejected check is treated as "not granted" rather than as an error.
      Fail closed, and the closed direction here is the primer — the one screen
      that explains itself.
    */
    void checkPermissions([...SPATIAL_PERMISSIONS]).then(
      (result) => {
        if (!live) return;
        advance(
          spatialPermissionsGranted(result)
            ? { kind: 'preparing' }
            : { kind: 'permission-required' },
        );
      },
      () => {
        if (live) advance({ kind: 'permission-required' });
      },
    );

    return () => {
      live = false;
    };
  }, [advance]);

  /*
    THE CHILD SAID YES. This is the only line in the feature that can raise a
    system permission dialog, and it is reached only from a press on the primer.
  */
  const handleGrant = useCallback(() => {
    void requestRequiredPermissions([...SPATIAL_PERMISSIONS]).then(
      (result) => {
        advance(
          spatialPermissionsGranted(result)
            ? { kind: 'preparing' }
            : { kind: 'unsupported', reason: 'permission-declined' },
        );
      },
      () => advance({ kind: 'unsupported', reason: 'permission-declined' }),
    );
  }, [advance]);

  /*
    AND "NOT NOW" ASKS THE HEADSET NOTHING AT ALL. It is a pop, not a denial:
    nothing is recorded as refused, no system dialog is raised, and pressing the
    door again later shows the same primer rather than a dead control. A child
    who is not sure is allowed to not be sure.
  */
  const handleDecline = useCallback(() => {
    advance({ kind: 'exiting' });
    onExit();
  }, [advance, onExit]);

  /*
    THE ENGINE IS READY WHEN IT SAYS SO, and only then is it handed the board.
    `attach` does the vendor's late-joiner order; a diff that reaches an engine
    with no editor is dropped with no error on either platform.

    Attaching does NOT depend on the lifecycle. The engine is mounted through
    every phase, including while the primer is up, so it may report `mounted`
    long before there is a scene — and the document should be in it by then
    rather than loaded at the moment the child starts looking.
  */
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);

  /*
    ONE BIND ATTEMPT'S ANSWER, into the one place the scene can read it from.
    A refusal is not an error a child hears about — it selects the raster
    presentation, which is a board — so `reason` goes to the log for the next
    person and nowhere else.
  */
  const handleBound = useCallback((binding: BoardTextureBinding) => {
    useXrSession.getState().setBoardTextureBound(binding.bound);
    if (!binding.bound && __DEV__) {
      console.warn(
        `[tutor-xr] the live board did not bind (${binding.reason ?? 'no reason'}) — drawing the raster instead`,
      );
    }
  }, []);
  useEffect(() => {
    if (!ready) return;
    const handle = engine.current;
    if (handle === null) return;
    active.engine = handle;
    const detach = session.attach({ id: PRESENTATION_ID, board: handle });
    return () => {
      active.engine = null;
      detach();
    };
  }, [ready, session]);

  /*
    THE BOARD BECOMES DRAWABLE WHEN THE ENGINE AND THE SCENE ARE BOTH THERE,
    AND THIS WATCHES FOR EITHER ARRIVING LAST.

    It is a second effect, not a line in the one above, because the two orders
    are both real and only one of them was survivable as a single effect. The
    engine is a WebView that starts loading on mount, and the permission promise
    is a round trip through the runtime — so `mounted` routinely lands while the
    phase is still `checking`, where `ready` is not a legal move and the table
    correctly drops it. With the promotion welded to the attach effect, nothing
    would have re-run when permission finally resolved: the child would have got
    a board stuck on "Bringing your working over", with an engine behind it, for
    the rest of the session.

    Watching the phase as well as the engine is what makes both orders converge
    on the same state.

    This is also the ONLY move to `ready`. The renderer reporting good tracking
    is not readiness — see `handleTrackingUpdated` — because a board is drawable
    when there is an engine behind it, not when the room is in focus.
  */
  useEffect(() => {
    /*
      `readyOrInterrupted`, not a bare `ready`. The engine runs its first
      calibration the moment it reports an editor, which is routinely BEFORE
      the permission promise has resolved — and a failure that lands while the
      phase is still `checking` is dropped by the table, because `checking` has
      no move to `interrupted`. Promoting blind here would then hand the child a
      board the engine has already said it cannot map, with no sentence anywhere
      saying so. The verdict is read at the moment of the promotion instead.
    */
    if (ready && phase.kind === 'preparing') advance(readyOrInterrupted());
  }, [advance, phase.kind, ready]);

  const handleChange = useCallback(
    (diff: WhiteboardDiff, source: WhiteboardDiffSource) => {
      session.change(PRESENTATION_ID, diff, source);
    },
    [session],
  );

  /*
    THE ENGINE'S OWN VERDICT ON WHETHER INK LANDS WHERE THE RAY POINTED.

    `injectPointer`'s whole contract rests on one runtime fact this screen
    cannot see — the engine's camera is at its default, so the client space the
    pointer is written in and the page space the ink is stored in are the same
    space. The board measures it rather than assuming it: it draws a fixture,
    reads back what the engine recorded, and reports the drift. Every failure
    reason means the same thing here — `not-ready`, `no-surface`, `no-record`,
    `timeout` and `drift` all say the mapping is unproven — so they share one
    answer rather than five sentences a child would read the same way.

    A PUSH, NOT A PULL, AND THAT IS WHY THE PROMISE IS NOT AWAITED ANYWHERE.
    The runs that matter have no caller: the board calibrates itself when the
    engine mounts, and again after anything that could have moved the camera.
    A screen that only ever awaited `calibrate()` would learn about a broken
    mapping one stroke too late.

    INTERRUPTED, NEVER `unsupported`. The board is drawn, the document is
    intact, the child's work is where they left it, and the next probe can
    pass — so this is the state that keeps the paper on screen and says why it
    is not taking marks. `active.inkAligned` carries the same verdict to the two
    promotions that would otherwise clear it behind this handler's back.
  */
  const handleCalibration = useCallback(
    (result: WhiteboardCalibration) => {
      active.inkAligned = result.ok;
      if (!result.ok) {
        advance(INK_INTERRUPTED);
        return;
      }
      /* A pass only ends the interruption it caused. Tracking is the renderer's
         to clear: a board waiting for the room to come back does not become
         drawable because the engine measured its own mapping correctly. */
      const current = useXrSession.getState().phase;
      if (current.kind === 'interrupted' && current.reason === 'calibration-failed') {
        advance({ kind: 'ready' });
      }
    },
    [advance],
  );

  /*
    WHAT IS ON SCREEN IS THE PHASE, AND THE RENDERER IS NOT ALWAYS PART OF IT.

    `preparing` onward mounts `ViroXRSceneNavigator`, which is the moment the
    headset goes immersive — and on an eligible headset `preparing` is where
    the store already is, so this branch is taken on the first render and there
    is no "before it" to sit through.

    The flat panel is what the screen falls BACK to rather than what it opens
    with: the primer when the runtime says the camera is not granted, and
    `unsupported` on a device that was never going to manage this. Both are
    questions asked ABOUT immersion and neither can honestly be asked from
    inside it, which is why answering one is worth unmounting a scene for.

    `exiting` keeps the navigator mounted for the frame between the press and
    the pop. Tearing the scene down first would black the headset out while the
    route is still there, which reads as a crash rather than as leaving.
  */
  const immersive =
    phase.kind === 'preparing' ||
    phase.kind === 'ready' ||
    phase.kind === 'interrupted' ||
    phase.kind === 'exiting';

  return (
    <View style={styles.root}>
      {immersive ? (
        <ViroXRSceneNavigator
          initialScene={INITIAL_SCENE}
          /*
            ALL THREE POST-PROCESS PASSES OFF, not just HDR.

            The vendor documents `hdrEnabled={false}` for passthrough because the
            HDR path renders to an intermediate target and forces an opaque final
            composite. Bloom and PBR sit on that same path, and the Danger Room
            scene — the one Quest/PICO scene in these repos that is known to
            composite correctly — turns off all three. Leaving two of them on is
            not a smaller version of the fix; it is the same opaque composite by
            another route.
          */
          hdrEnabled={false}
          bloomEnabled={false}
          pbrEnabled={false}
          /*
            Asked for explicitly rather than relied on. The package auto-enables
            passthrough when an AR scene mounts ON QUEST; that is Meta-path code,
            and this app's headset is a PICO. The Danger Room navigator passes it
            outright for the same reason, and it is a no-op on the immersive
            branch, which has no real room in it to show.
          */
          passthroughEnabled

          onExitViro={handleExit}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <XrGate
          phase={phase}
          ageBand={ageBand}
          onGrant={handleGrant}
          onDecline={handleDecline}
          onExit={handleExit}
        />
      )}
      {/*
        The engine. Off-screen rather than hidden, at the pixel size the ink is
        rendered from — see this file's header.

        IT IS MOUNTED THROUGH EVERY PHASE, INCLUDING THE PRIMER. A WebView takes
        a visible fraction of a second to load its page and report `mounted`,
        and that fraction is free while a child is reading why the camera is
        needed. Started after the answer instead, it would be spent staring at
        blank paper in space.
      */}
      {/*
        THE HOST IS WHERE THE RENDERER REACHES THE ENGINE. It is a plain `View`
        until `MoyoBoardTexture` binds; bound, the same WebView is re-parented
        into the sink `AndroidViewTexture` draws from, without reloading the
        page or dropping the stroke in progress. Unbound — iOS, a binary without
        the module, no renderer in this window — it stays exactly the parked
        box the raster presentation has always used.

        `live` WAITS FOR `ready`, and that is the engine's own event rather than
        a delay: `preparing → ready` is the board reporting it has an editor, so
        the navigator has been mounted for at least that long and the page it
        hands over is a loaded one.

        THE BOARD ONLY, NOT `Whiteboard`. The tray belongs to the 2D pane; in
        here the controls are the rail in the scene. Textured, a tray would be
        drawn ON the child's paper and would push every page coordinate a tray's
        height away from the ray that produced it — the pointer scale is
        `boardSurfacePixels`, and that has to be the page and nothing else.
      */}
      <BoardTextureHost
        style={styles.engine}
        material={XR_MATERIAL.boardLive}
        pageWidth={boardSurfacePixels.width}
        pageHeight={boardSurfacePixels.height}
        live={phase.kind === 'ready'}
        onBound={handleBound}
      >
        <WhiteboardBoard
          ref={engine}
          onChange={handleChange}
          onReady={handleReady}
          onCalibration={handleCalibration}
        />
      </BoardTextureHost>
    </View>
  );
}

/**
 * THE FLAT PANEL THAT COMES BEFORE THE ROOM — the check, the primer, and the
 * three ways this cannot work.
 *
 * ON A HEADSET THIS IS NOT A COMPROMISE. The app runs as a 2D panel until the
 * navigator takes the display, so every one of these renders in the place a
 * child is already reading from, in the medium the headset itself uses for
 * consent.
 */
function XrGate({
  phase,
  ageBand,
  onGrant,
  onDecline,
  onExit,
}: {
  phase: XrPhase;
  ageBand: TutorXrScreenProps['ageBand'];
  onGrant: () => void;
  onDecline: () => void;
  onExit: () => void;
}) {
  const size = buttonSizeForBand(ageBand);

  if (phase.kind === 'permission-required') {
    return (
      <UiView className="flex-1 justify-center bg-surface gap-stack p-inset">
        <Text variant="heading">Your board needs the camera</Text>
        {/* WHY, first and in one sentence. A primer that leads with the
            permission rather than the reason is a dialog with extra steps. */}
        <Text variant="body">
          The headset uses its cameras to see your room, so your paper can stand in front of you
          instead of floating in the dark.
        </Text>
        {/* ON-DEVICE VS OFF-DEVICE, said as two facts rather than as a
            reassurance. A child and a guardian reading over their shoulder need
            to know which of these two things happens to the picture. */}
        <Text variant="body">
          What the cameras see stays on this headset. It is not sent anywhere, and it is not saved
          or recorded.
        </Text>
        <Text variant="body">
          The only thing that leaves is a board you press Ask on. That goes to Natalie as a picture,
          the same as sending a photo of your paper.
        </Text>
        {/*
          TWO DOORS OF THE SAME WEIGHT. Same variant, same size, side by side —
          a primer that styles the yes as the primary action and the no as a
          text link has asked a question it already answered.
        */}
        <UiView className="flex-row flex-wrap gap-group">
          <Button
            title="Turn on the camera"
            variant="outline"
            size={size}
            onPress={onGrant}
            aria-label="Turn on the camera and open the spatial board"
          />
          <Button
            title="Not now"
            variant="outline"
            size={size}
            onPress={onDecline}
            aria-label="Not now — go back to the normal board"
          />
        </UiView>
        <Text variant="caption" tone="muted">
          Not now takes you back to your normal board, with everything you have written.
        </Text>
      </UiView>
    );
  }

  if (phase.kind === 'unsupported') {
    const copy = UNSUPPORTED_COPY[phase.reason];
    return (
      <UiView className="flex-1 justify-center bg-surface gap-stack p-inset">
        <Text variant="heading">{copy.heading}</Text>
        <Text variant="body">{copy.body}</Text>
        <Button
          title="Back to my board"
          variant="outline"
          size={size}
          onPress={onExit}
          aria-label="Back to my board"
        />
      </UiView>
    );
  }

  /*
    `checking`. Words rather than a bare spinner, for the reason the lazy
    loader's fallback already gives: this is the one moment a child is looking
    at nothing and does not know whether their working survived the trip.
  */
  return (
    <UiView className="flex-1 items-center justify-center bg-surface gap-stack p-inset">
      <Text variant="body">Checking what this headset can do…</Text>
      <Text variant="caption" tone="muted">
        Your working is saved. Nothing is lost if you go back.
      </Text>
    </UiView>
  );
}

/**
 * The three ways a spatial board does not open, each with its own answer.
 *
 * Every one of them names where the work IS, because that is the only thing the
 * child actually needs from this screen. None of them asks the child to fix
 * anything they cannot fix: a build without the renderer and a device that is
 * not a headset are both nobody's fault and nothing to act on.
 */
const UNSUPPORTED_COPY: Record<
  Extract<XrPhase, { kind: 'unsupported' }>['reason'],
  { heading: string; body: string }
> = {
  'no-xr-runtime': {
    heading: 'This app cannot open a board in space',
    body: 'This version was not built for a headset. Your board is on the normal tutor screen, with everything you have written.',
  },
  'device-not-eligible': {
    heading: 'The spatial board needs a headset',
    body: 'This device cannot show your paper in the room. Your board is on the normal tutor screen, with everything you have written.',
  },
  'permission-declined': {
    heading: 'The camera stayed off',
    body: 'Without it the headset cannot see your room, so the board has nowhere to stand. You can turn it on in the headset settings whenever you like. Your board is on the normal screen, with everything you have written.',
  },
};

/** Her status, in the same words the 2D presence rail uses. */
function statusLabel(kind: string): string {
  if (kind === 'speaking') return 'Speaking';
  if (kind === 'thinking') return 'Thinking';
  if (kind === 'listening') return 'Listening';
  if (kind === 'paused') return 'Paused';
  if (kind === 'ended') return 'Finished';
  return 'Here';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: XR_COLOR.void },
  engine: {
    position: 'absolute',
    /*
      Parked, not hidden. `display: none` tears the WebView's surface down and
      the engine restarts; moved aside it keeps its editor, its camera and the
      stroke in progress.
    */
    left: -boardSurfacePixels.width - spatialSpacing.md,
    top: 0,
    width: boardSurfacePixels.width,
    height: boardSurfacePixels.height,
    opacity: 0,
  },
});
