'use client';
// TutorWorkbench — everything the second pane holds: the question, and the
// board the learner works it out on.
//
// WHAT CHANGED AND WHY. `TutorWorkCanvas` alone earned the pane only when there
// was already work to show, so the column appeared and disappeared under the
// learner as a session moved. A board always has a job — scratch paper is
// useful before you have written anything on it, which is the one thing an
// empty state cannot be said of — so the pane is now stable for the length of
// the session, and doc 23 §5's "equation / whiteboard" is finally both halves
// rather than the first one.
//
// THE ASK IS THE POINT. A board a tutor cannot see is a notepad. Pressing it
// exports the paper as a PNG and hands it to the same road a photographed
// worksheet already travels — on-device OCR for the text, the picture itself
// for the operators the recogniser's charset cannot carry. Nothing new reaches
// the model and nothing new leaves the device that a photo did not.
//
// THIS COMPONENT OWNS THE DOCUMENT. The board draws; `board-doc` remembers.
// Every change goes into the CRDT and the CRDT is what gets written down, so
// one code path serves a reload, a second device, and — once a transport exists
// — a second person. See `docs/design/tutor-board-collaboration.md`.
// Mobbin: https://mobbin.com/screens/abec2826-f574-4cbd-b6d9-a8d5e3210394 (Claude —
// conversation in the leading column, a sketch surface in the trailing one, the
// thing being discussed pinned above it) · https://mobbin.com/screens/76e16697-0e20-4bfc-8162-e93d6f1fc8ff
// (Mistral Le Chat — the artefact pane carries its own title strip and one
// primary action, never a toolbar of them) · https://mobbin.com/screens/13816781-2b2c-48d1-80ce-9b5b8c7c2f92
// (Zoom whiteboard — the board takes the height and the tray keeps to an edge).
// Structure only.
// SOT: docs/pack/23-tutorstage-handoff.md §5 · docs/design/tutor-board-collaboration.md
// SOT-KEYWORDS: tutor workbench second pane whiteboard board work canvas problem ask natalie yjs document

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Whiteboard,
  type TutorMessage,
  type WhiteboardDiff,
  type WhiteboardDiffSource,
  type WhiteboardHandle,
} from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { buttonSizeForBand, type AgeBand } from '../capture';
import {
  acquireBoardSession,
  boardSessionKey,
  releaseBoardSession,
} from './board-session.ts';
import { boardPersistence } from './board-storage.ts';
import { TutorWorkCanvas } from './tutor-work-canvas';

export interface TutorWorkbenchProps {
  problem: string | null;
  messages: readonly TutorMessage[];
  ageBand: AgeBand;
  /** The session this board belongs to. Null until the session exists. */
  sessionId: string | null;
  /** Hands the board's PNG to the tutor. `null` when there is nothing drawn. */
  onAsk: (png: string | null) => void;
  /** True while that turn is in flight, so the control can say so. */
  asking?: boolean;
}

/**
 * Which presentation this is, to the document.
 *
 * The 2D pane and the collapsed sheet share one instance of this component by
 * design, so they share one id; the spatial screen has its own. It is what stops
 * a stroke drawn here being echoed straight back into the engine that drew it.
 */
const PRESENTATION_ID = 'tutor-workbench';

export function TutorWorkbench({
  problem,
  messages,
  ageBand,
  sessionId,
  onAsk,
  asking,
}: TutorWorkbenchProps) {
  const board = useRef<WhiteboardHandle>(null);

  /*
    THE DOCUMENT IS NOT OWNED HERE ANY MORE, and every ordering decision that
    used to live in this file moved to `board-session` with its reasoning
    intact. What is left is the half that is genuinely this component's: which
    engine is on screen, and when it is ready to be handed a board.

    Why it had to move: the spatial whiteboard is a second route. A document
    created by this component is invisible to it, and a document created by both
    is two boards for one piece of homework.
  */
  const key = boardSessionKey(sessionId);
  const [session, setSession] = useState(() => acquireBoardSession(key, boardPersistence));

  /*
    A changed key is a different board — a draft that just became a session.
    Acquire the new one during the render that needs it, so the engine below is
    never handed a snapshot from the board it is no longer showing.
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

  /*
    The hold is released on the way out, which is what writes the last breath of
    working to storage. The SESSION is not disposed here: leaving this screen for
    the spatial one unmounts this tree before that one mounts, and a document
    thrown away in that gap is a child arriving in the headset to blank paper.
  */
  useEffect(() => () => releaseBoardSession(heldKey), [heldKey]);

  /*
    `ready` is the load-bearing half. Both engines mount ASYNCHRONOUSLY — a
    canvas on web, a WebView on native — and a diff that reaches a board with no
    editor yet is dropped with no error anywhere. So the board is handed the
    WHOLE document when it says it is ready, and only the diffs after that
    stream: the vendor's own late-joiner order, which is late-joiner-shaped for
    exactly this reason.
  */
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!ready) return;
    const handle = board.current;
    if (handle === null) return;
    return session.attach({ id: PRESENTATION_ID, board: handle });
  }, [ready, session]);

  const handleChange = useCallback(
    (diff: WhiteboardDiff, source: WhiteboardDiffSource) => {
      session.change(PRESENTATION_ID, diff, source);
    },
    [session],
  );

  return (
    <View className="flex-1 gap-stack">
      {/*
        THE QUESTION, AND ONLY THE QUESTION. It keeps its content height — it is
        the question, the board is the answer, and the answer is what needs the
        room. It changes when the problem does and at no other time, so a
        learner working through a page sees the line above their paper follow
        them rather than flicker on every turn.

        The photographs are deliberately not here. They ride in the thread,
        where they are the turn the child sent; above the board they were a
        picture of the board, sitting directly on top of the board.
      */}
      <TutorWorkCanvas problem={problem} messages={messages} problemOnly />
      <Whiteboard
        ref={board}
        snapshot={session.initialSnapshot}
        size={buttonSizeForBand(ageBand)}
        onAsk={onAsk}
        asking={asking}
        onChange={handleChange}
        onReady={handleReady}
      />
    </View>
  );
}
