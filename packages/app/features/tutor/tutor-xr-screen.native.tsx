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
// SOT: packages/app/features/tutor/board-session.ts · packages/ui/xr/XrPanel.types.ts
// SOT-KEYWORDS: tutor xr screen spatial whiteboard viro quest scene rail chat board session native

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ViroAmbientLight,
  ViroARScene,
  ViroDirectionalLight,
  ViroXRSceneNavigator,
} from '@reactvision/react-viro';
import {
  Whiteboard,
  type WhiteboardDiff,
  type WhiteboardDiffSource,
  type WhiteboardHandle,
  type WhiteboardInk,
  type WhiteboardTool,
} from '@acme/ui';
import {
  XrBoardInk,
  XrChatPanel,
  XrPanel,
  XrPlacementControls,
  XrQuestionLine,
  XrRail,
  boardComposition,
  boardSurfacePixels,
  layoutBoard,
  minHitSize,
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
import { useXrSession } from './xr-session.store.ts';

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
 * THE SCENE, as a stable component type.
 *
 * It reads its state rather than receiving it, for the constructor-capture
 * reason above. Every hook here is a narrow selector: a scene that re-rendered
 * on every message of a streaming tutor turn would rebuild the board's polyline
 * set at token rate.
 */
function BoardScene() {
  const xrState = useXrSession((s) => s.state);
  const placement = useXrSession((s) => s.placement);
  const setPlacement = useXrSession((s) => s.setPlacement);
  const recenter = useXrSession((s) => s.recenter);
  const tool = useXrSession((s) => s.tool);
  const ink = useXrSession((s) => s.ink);
  const asking = useXrSession((s) => s.asking);
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
    minRail: Math.min(boardComposition.railWidth, minHitSize(distanceM, handsPrimary)),
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
    <ViroARScene>
      <ViroAmbientLight color="#ffffff" intensity={600} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.5]} intensity={800} />
      <XrPanel
        width={boardWidth}
        aspect={{ w: 5, h: 7 }}
        placement={placement}
        onPlacementChange={setPlacement}
        onSurfaceInput={handleSurfaceInput}
        state={xrState}
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
              tutorName="Natalie"
              status={statusLabel(stageKind)}
              assurance="She can see what you write on the board."
              rows={chatRows}
              earlierCount={Math.max(0, messages.length - CHAT_WINDOW)}
              inputLocked={stageKind === 'ended' || stageKind === 'crisis'}
            />
          ),
        }}
      >
        <XrBoardInk store={store} width={boardWidth} height={boardHeight} />
      </XrPanel>
    </ViroARScene>
  );
}

/** Stable, for the same constructor-capture reason. */
const INITIAL_SCENE = { scene: BoardScene };

export function TutorXrScreen({ ageBand, onExit, onAsk, asking = false }: TutorXrScreenProps) {
  const sessionId = useTutorStore((s) => s.sessionId);
  const setXrState = useXrSession((s) => s.setState);
  const bumpRevision = useXrSession((s) => s.bumpRevision);

  const engine = useRef<WhiteboardHandle>(null);

  /*
    THE SAME DOCUMENT THE 2D SCREEN WAS USING. `acquireBoardSession` hands back
    the existing one for this key — the registry outlives both routes, which is
    the whole reason it exists — so there is no restore, no fetch and no empty
    board on the way in.
  */
  const key = boardSessionKey(sessionId);
  const [session] = useState<BoardSession>(() => acquireBoardSession(key, boardPersistence));

  useEffect(() => {
    session.setSessionId(sessionId);
    return () => releaseBoardSession(key);
  }, [key, session, sessionId]);

  /* The scene reads these rather than receiving them — see `active`. */
  useEffect(() => {
    active.session = session;
    active.onExit = onExit;
    active.onAsk = onAsk;
    return () => {
      active.session = null;
      active.engine = null;
      active.onExit = () => undefined;
      active.onAsk = () => undefined;
    };
  }, [onAsk, onExit, session]);

  useEffect(() => {
    useXrSession.getState().setAsking(asking);
  }, [asking]);

  /*
    `onRecords` rather than `onRemote`: this renderer must see the child's OWN
    strokes, and the engine subscription is deliberately blind to them (see
    `board-doc`). A counter rather than the records themselves, because a Yjs
    document mutates in place and must never become React state.
  */
  useEffect(() => session.doc.onRecords(() => bumpRevision()), [bumpRevision, session]);

  /*
    THE ENGINE IS READY WHEN IT SAYS SO, and only then is it handed the board.
    `attach` does the vendor's late-joiner order; a diff that reaches an engine
    with no editor is dropped with no error on either platform.
  */
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (!ready) return;
    const handle = engine.current;
    if (handle === null) return;
    active.engine = handle;
    setXrState('ready');
    return session.attach({ id: PRESENTATION_ID, board: handle });
  }, [ready, session, setXrState]);

  const handleChange = useCallback(
    (diff: WhiteboardDiff, source: WhiteboardDiffSource) => {
      session.change(PRESENTATION_ID, diff, source);
    },
    [session],
  );

  return (
    <View style={styles.root}>
      <ViroXRSceneNavigator
        initialScene={INITIAL_SCENE}
        /* The vendor's requirement for passthrough on Quest, not a preference. */
        hdrEnabled={false}
        onExitViro={onExit}
        style={StyleSheet.absoluteFill}
      />
      {/*
        The engine. Off-screen rather than hidden, at the pixel size the ink is
        rendered from — see this file's header.
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
  root: { flex: 1, backgroundColor: '#000000' },
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
