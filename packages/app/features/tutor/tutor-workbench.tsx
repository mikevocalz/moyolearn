'use client';
// TutorWorkbench — everything the second pane holds: the problem, the photos of
// it, and the board the learner works it out on.
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
// Mobbin: https://mobbin.com/screens/abec2826-f574-4cbd-b6d9-a8d5e3210394 (Claude —
// conversation in the leading column, a sketch surface in the trailing one, the
// thing being discussed pinned above it) · https://mobbin.com/screens/76e16697-0e20-4bfc-8162-e93d6f1fc8ff
// (Mistral Le Chat — the artefact pane carries its own title strip and one
// primary action, never a toolbar of them) · https://mobbin.com/screens/13816781-2b2c-48d1-80ce-9b5b8c7c2f92
// (Zoom whiteboard — the board takes the height and the tray keeps to an edge).
// Structure only.
// SOT: docs/pack/23-tutorstage-handoff.md §5 · docs/design/reset/00-repo-baseline.md:34
// SOT-KEYWORDS: tutor workbench second pane whiteboard board work canvas problem ask natalie

import { useCallback, useEffect, useRef, useState } from 'react';
import { Whiteboard, type TutorMessage, type WhiteboardHandle } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { buttonSizeForBand, problemStorage, readBoard, writeBoard, type AgeBand } from '../capture';
import { TutorWorkCanvas } from './tutor-work-canvas';

export interface TutorWorkbenchProps {
  problem: string | null;
  messages: readonly TutorMessage[];
  ageBand: AgeBand;
  /** Hands the board's PNG to the tutor. `null` when there is nothing drawn. */
  onAsk: (png: string | null) => void;
  /** True while that turn is in flight, so the control can say so. */
  asking?: boolean;
}

/**
 * How long after the last stroke the board is written down.
 *
 * The vendor's own guidance: snapshots are cheap but not free, so one per
 * stroke is waste and one per session is a lost afternoon. 400ms is their
 * example and it is also about the length of a pause between two digits, so a
 * child writing a column of working writes the file once at the end of it
 * rather than once per figure.
 */
const AUTOSAVE_MS = 400;

export function TutorWorkbench({
  problem,
  messages,
  ageBand,
  onAsk,
  asking,
}: TutorWorkbenchProps) {
  const board = useRef<WhiteboardHandle>(null);
  /*
    Read ONCE, before the first paint, and never again. `problemStorage` is
    synchronous for exactly this reason (see its header): an async read would
    paint a blank board and swap the child's working in a frame later, which
    reads as the app having lost it and then found it.

    A lazy `useState` initialiser rather than a `useRef` read: the value has to
    be available to the first render, and a ref's `current` may not be touched
    during one. State also keeps the object identity stable, which matters here
    — re-reading storage on a re-render would hand the board a different
    `snapshot` and remount the engine mid-stroke.
  */
  const [restored] = useState<unknown>(() => readBoard(problemStorage));

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
  }, []);

  const handleEdit = useCallback(() => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void board.current?.getSnapshot().then((snapshot) => {
        if (snapshot !== null) writeBoard(problemStorage, snapshot);
      });
    }, AUTOSAVE_MS);
  }, []);

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

        It draws nothing while there is no problem — `TutorWorkCanvas` returns
        null — which is right: an empty caption over an empty line is the
        empty-box problem doc 23 §5 already ruled on, and the board below it is
        usable with or without a question.
      */}
      <TutorWorkCanvas problem={problem} messages={messages} problemOnly />
      <Whiteboard
        ref={board}
        snapshot={restored}
        size={buttonSizeForBand(ageBand)}
        onAsk={onAsk}
        asking={asking}
        onLearnerEdit={handleEdit}
      />
    </View>
  );
}
