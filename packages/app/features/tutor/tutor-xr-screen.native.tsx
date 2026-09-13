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
// ViroReact cannot host a React Native view inside a scene (the installed
// flexbox docs permit only Viro primitives inside `ViroFlexView`), so the board
// cannot be put on the paper. It does not need to be: the engine remains the
// only authority for strokes, tools, the eraser and export, the spatial paper
// renders that engine's document, and a ray on the paper becomes a pointer in
// the engine. One engine, one document, two renderers — which is what keeps a
// stroke drawn in the headset identical to one drawn on a laptop.
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
// NOTHING IMMERSIVE STARTS UNTIL THE ANSWER IS YES. This screen is the driver
// of `xr-session.store`'s lifecycle, and the order is the point: eligibility is
// decided from this binary and this device, then the primer explains the camera
// and is answered, then the renderer is mounted, then the engine says it has an
// editor, and only then is the board drawable. The primer renders as a flat 2D
// panel because it has to — a consent question asked from inside the immersive
// scene it grants consent for is a question already answered. Tracking loss
// after that is an INTERRUPTION, never an ending: the board stays where the
// child put it and the strokes stay in the document.
// SOT: packages/app/features/tutor/board-session.ts · packages/app/features/tutor/xr-capability.ts
//      packages/ui/xr/XrPanel.types.ts · docs/decisions/adr-117-spatial-whiteboard-bridge.md
// SOT-KEYWORDS: tutor xr screen spatial whiteboard viro quest scene rail chat board session native permission primer tracking lifecycle

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ViroAmbientLight,
  ViroARScene,
  ViroDirectionalLight,
  ViroTrackingStateConstants,
  ViroXRSceneNavigator,
  checkPermissions,
  hasOpenXRSupport,
  isQuest,
  requestRequiredPermissions,
  type ViroTrackingState,
} from '@reactvision/react-viro';
import {
  Button,
  Text,
  Whiteboard,
  type WhiteboardDiff,
  type WhiteboardDiffSource,
  type WhiteboardHandle,
} from '@acme/ui';
import { View as UiView } from '@acme/ui/primitives';
import {
  XrBoardInk,
  XrChatPanel,
  XrPanel,
  XrPlacementControls,
  XrQuestionLine,
  XrRail,
  XR_COLOR,
  boardComposition,
  boardSurfacePixels,
  layoutBoard,
  railWidthFor,
  spatialSpacing,
  type XrChatRow,
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
import { useTutorStore } from './tutor.store.ts';
import type { TutorXrScreenProps } from './tutor-xr-screen.types.ts';
import {
  SPATIAL_PERMISSIONS,
  spatialEligibility,
  spatialPermissionsGranted,
} from './xr-capability.ts';
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
} = {
  engine: null,
  session: null,
  onExit: () => undefined,
  onAsk: () => undefined,
};

/** The paper's height, from the one aspect the board is allowed to have. */
const BOARD_HEIGHT = (boardComposition.boardWidth * 7) / 5;

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
    if (phase.kind === 'interrupted') advance({ kind: 'ready' });
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
 * The line under Natalie's name — hers normally, the interruption's while the
 * headset is looking for the room.
 *
 * Both are assurances and that is why they share the slot: neither asks the
 * child to do anything, and the interrupted one exists to stop a board that has
 * stopped taking ink from reading as a board that has lost the work on it.
 */
function assuranceFor(phase: XrPhase): string {
  if (phase.kind !== 'interrupted') return "Press Ask and she'll see your board.";
  if (phase.reason === 'tracking-lost') {
    return 'The headset is finding your room again. Your work is safe — it comes back on its own.';
  }
  return 'The headset is having trouble seeing your room. Move gently; your work is safe.';
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
    The records, re-read when the document moves. Not memoised on `session`
    alone: the whole point of `revision` is that the document mutates in place.
  */
  const store = useMemo(() => {
    void revision;
    if (session === null) return {};
    return (session.doc.snapshot() as { document: { store: Record<string, unknown> } }).document
      .store;
  }, [revision, session]);

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
    active.engine?.injectPointer({
      phase: sample.phase,
      x: sample.u * boardSurfacePixels.width,
      y: sample.v * boardSurfacePixels.height,
      pressure: sample.pressure,
    });
  };

  return (
    /*
      `ViroARScene` inside `ViroXRSceneNavigator` is the passthrough path the
      installed package documents for Quest. `hdrEnabled={false}` is set on the
      navigator, which is the vendor's own requirement there.
    */
    <ViroARScene onTrackingUpdated={handleTrackingUpdated}>
      <ViroAmbientLight color="#ffffff" intensity={600} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.5]} intensity={800} />
      <XrPanel
        width={boardWidth}
        aspect={{ w: 5, h: 7 }}
        placement={placement}
        onPlacementChange={setPlacement}
        onSurfaceInput={handleSurfaceInput}
        state={panelStateOf(phase)}
        moveHandle="frame"
        ornaments={{
          leading: {
            extent: boardComposition.railWidth,
            gap: boardComposition.railGap,
            node: (
              <XrRail
                width={boardComposition.railWidth}
                height={boardHeight}
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
                onRecenter={recenter}
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
              */
              assurance={assuranceFor(phase)}
              rows={chatRows}
              earlierCount={Math.max(0, messages.length - CHAT_WINDOW)}
              skippedCount={skippedRecords}
              inputLocked={stageKind === 'ended' || stageKind === 'crisis'}
            />
          ),
        }}
      >
        <XrBoardInk
          store={store}
          width={boardWidth}
          height={boardHeight}
          onSkippedCount={setSkipped}
        />
      </XrPanel>
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

  /* The scene reads these rather than receiving them — see `active`. */
  useEffect(() => {
    active.session = session;
    active.onExit = handleExit;
    active.onAsk = onAsk;
    return () => {
      active.session = null;
      active.engine = null;
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
    captured in its constructor. Set before the navigator mounts — the lifecycle
    has to leave `checking` first — so no frame is ever drawn at the store's
    conservative start value.
  */
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
    STEP ONE: CAN THIS BINARY, ON THIS DEVICE, OPEN A BOARD IN SPACE.

    Answered before anything immersive is mounted and before any permission is
    asked for, because both of the other two are worse when the answer is no: a
    scene mounted on a runtime that is not there is a black room a child cannot
    get out of, and a camera prompt on a phone that could never have shown a
    spatial board is a request for access the app has no use for.

    Runs once. `phase` is deliberately NOT a dependency — this is the entry
    check, and re-running it when the phase moves is how a screen ends up asking
    for the camera again after the child has answered.
  */
  useEffect(() => {
    let live = true;
    if (useXrSession.getState().phase.kind !== 'checking') return;

    const eligibility = spatialEligibility({
      hasOpenXrModule: hasOpenXRSupport,
      isHeadset: isQuest,
    });
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

    This is also the ONLY move to `ready`. The renderer reporting good tracking
    is not readiness — see `handleTrackingUpdated` — because a board is drawable
    when there is an engine behind it, not when the room is in focus.
  */
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (!ready) return;
    const handle = engine.current;
    if (handle === null) return;
    active.engine = handle;
    advance({ kind: 'ready' });
    return session.attach({ id: PRESENTATION_ID, board: handle });
  }, [advance, ready, session]);

  const handleChange = useCallback(
    (diff: WhiteboardDiff, source: WhiteboardDiffSource) => {
      session.change(PRESENTATION_ID, diff, source);
    },
    [session],
  );

  /*
    WHAT IS ON SCREEN IS THE PHASE, AND THE RENDERER IS NOT ALWAYS PART OF IT.

    `preparing` onward mounts `ViroXRSceneNavigator`, which is the moment the
    headset goes immersive. Everything before it — the availability check and
    the primer — and `unsupported` after it stay on the flat panel, because
    those are all questions asked ABOUT immersion and none of them can honestly
    be asked from inside it.

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
          /* The vendor's requirement for passthrough on Quest, not a preference. */
          hdrEnabled={false}
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
      <View style={styles.engine} pointerEvents="none">
        <Whiteboard
          ref={engine}
          size={buttonSizeForBand(ageBand)}
          onAsk={onAsk}
          asking={asking}
          onChange={handleChange}
          onReady={handleReady}
        />
      </View>
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
