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
import { createBoardDoc, type BoardDoc } from './board-doc.ts';
import {
  fetchRemoteBoard,
  pushRemoteBoard,
  readLocalBoard,
  writeLocalBoard,
} from './board-storage.ts';
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
 * How long after the last stroke the board is written to the device.
 *
 * The vendor's guidance for snapshots: cheap but not free, so one per stroke is
 * waste and one per session is a lost afternoon. 400ms is their example and is
 * also about the length of a pause between two digits, so a child writing a
 * column of working writes once at the end of it.
 */
const LOCAL_SAVE_MS = 400;

/**
 * And how long before it goes to the server, which is a different question.
 *
 * The local write is a memory copy; this one is a request over a child's home
 * connection and it exists for a minute-scale event — picking the session up on
 * another device. Two seconds keeps a whole column of working to one round trip
 * without letting a closed lid lose more than the last breath of it.
 */
const REMOTE_SAVE_MS = 2000;

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
    ONE DOCUMENT FOR THE LIFE OF THE COMPONENT, created lazily so the
    constructor does not run on every render. Not state: nothing about it
    re-renders this component, and holding it in state would hand React a
    mutable object to diff.
  */
  const docRef = useRef<BoardDoc | null>(null);
  docRef.current ??= createBoardDoc();
  const doc = docRef.current;

  /*
    THE LOCAL COPY IS READ BEFORE THE FIRST PAINT, synchronously, which is what
    `problemStorage` is synchronous FOR (see its header). An async read would
    paint blank paper and swap the child's working in a frame later — the app
    losing their work and then finding it.

    A lazy `useState` initialiser rather than a ref read: the value has to be
    available to the first render, and a ref's `current` may not be touched
    during one. State also keeps the object identity stable, so a re-render
    cannot hand the board a different `snapshot` and remount the engine
    mid-stroke.

    `restore`, not `remote`: a document being loaded is nobody's edit. It must
    not enter an undo stack and must not make an untouched board count as work.
  */
  const [initialSnapshot] = useState(() => {
    const local = readLocalBoard();
    if (local) doc.merge(local, 'restore');
    return doc.snapshot();
  });

  /*
    THE SERVER COPY ARRIVES LATE AND MERGES, which is the whole reason the
    document is a CRDT. A snapshot would have had to CHOOSE between the bytes on
    this device and the bytes on the server; an update folds both in, so a child
    who drew offline on the phone and then opened the laptop gets one board with
    everything on it rather than whichever write landed second.
  */
  useEffect(() => {
    if (sessionId === null) return;
    let cancelled = false;
    void fetchRemoteBoard(sessionId).then((update) => {
      if (cancelled || update === null) return;
      doc.merge(update, 'remote');
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, doc]);

  /*
    THE DOCUMENT DRIVES THE CANVAS, one way, for everything this device did not
    draw. A restore, a server merge, and one day a peer's stroke all arrive here
    and all look the same to the engine — which is what "ready for
    collaboration" means concretely rather than as a claim.

    `ready` is the load-bearing half and it was missing. Both engines mount
    ASYNCHRONOUSLY — a canvas on web, a WebView on native — and a diff that
    reaches a board with no editor yet is dropped with no error anywhere.
    Measured before this: a second device fetched a 1224-byte board, merged it,
    emitted the diff into a board that was still starting, and rendered blank
    paper while the server row plainly held the strokes.

    So the document does not push at the board. When the board says it is ready
    it is handed the WHOLE document, and only the diffs after that stream — the
    vendor's own late-joiner order, which is late-joiner-shaped for exactly this
    reason: a document that arrives before its reader is the normal case, not
    the edge one.
  */
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!ready) return;
    board.current?.loadSnapshot(doc.snapshot());
    return doc.onRemote((diff) => board.current?.applyDiff(diff));
  }, [ready, doc]);

  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
    The session id as a ref as well as a prop: the debounced writes below fire
    after their closure was created, and a board started before the session
    existed must still reach the server once it does.
  */
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;

  useEffect(
    () => () => {
      if (localTimer.current !== null) clearTimeout(localTimer.current);
      if (remoteTimer.current !== null) clearTimeout(remoteTimer.current);
      /*
        A last write on the way out, not a cancelled one. Unmounting is a child
        navigating away mid-problem, which is exactly when the working matters;
        the timers are debounces, and dropping a pending one would lose whatever
        they wrote in the last breath before they left.
      */
      writeLocalBoard(doc);
      if (sessionRef.current !== null) void pushRemoteBoard(sessionRef.current, doc);
      /*
        THE DOCUMENT IS NOT DESTROYED HERE, and that omission is the fix for a
        bug this cleanup caused.

        `destroy()` unobserves the map. React's development double-mount runs
        this cleanup between the two mounts, and the doc lives in a REF — which
        survives it — so the remount got a document whose observer was gone.
        Merges still landed (the map filled), `snapshot()` still read them, and
        `onRemote` never fired again: a second device fetched its board, folded
        3613 bytes in, held nine records, and drew blank paper.

        Nothing leaks by leaving it. A `Y.Doc` holds no socket, no timer and no
        native handle; it is reclaimed with the component that referenced it.
        The writes above are the part that had to happen on the way out.
      */
    },
    [doc],
  );

  const handleChange = useCallback(
    (diff: WhiteboardDiff, source: WhiteboardDiffSource) => {
      /*
        Only this hand's strokes go INTO the document as local edits. A change
        the engine reports as `remote` is one the document just gave it, and
        writing it back would be the echo loop Quickdraw's sync page names
        first.
      */
      if (source !== 'user') return;
      doc.applyDiff(diff, 'local');

      if (localTimer.current !== null) clearTimeout(localTimer.current);
      localTimer.current = setTimeout(() => writeLocalBoard(doc), LOCAL_SAVE_MS);

      if (remoteTimer.current !== null) clearTimeout(remoteTimer.current);
      remoteTimer.current = setTimeout(() => {
        const id = sessionRef.current;
        if (id !== null) void pushRemoteBoard(id, doc);
      }, REMOTE_SAVE_MS);
    },
    [doc],
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
        snapshot={initialSnapshot}
        size={buttonSizeForBand(ageBand)}
        onAsk={onAsk}
        asking={asking}
        onChange={handleChange}
        onReady={handleReady}
      />
    </View>
  );
}
