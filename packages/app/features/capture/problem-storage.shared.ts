// Where the learner's own problem lives across a reload.
//
// The capture store was in-memory, so a refresh discarded whatever the child had
// brought and `tutor-screen` fell through to `/api/tutor/next` — which generates
// a fresh practice problem. From the learner's side the app threw away their
// homework and started quizzing them on something they had never seen. That is
// not a layout bug; it is the tutor answering a question nobody asked.
//
// One key, synchronous, behind MMKV's shape — the same contract
// `preferences.store.shared` uses, for the same reason: an async read would
// paint the generated problem first and swap it a frame later.
// SOT: packages/app/features/editor/preferences.store.shared.ts
// SOT-KEYWORDS: capture problem persist storage refresh session learner homework
export const PROBLEM_KEY = 'capture-problem';

/**
 * Whether the stored problem is a MACHINE READING rather than something served
 * or typed.
 *
 * A second key rather than a JSON blob under the first, because the first key
 * already has readers in the field: a child who upgrades mid-homework must not
 * find their problem gone because it failed to parse as an object. An absent
 * flag reads as `false`, which is the safe default — it costs the model a
 * caveat it would have found useful, where the reverse would tell it to doubt
 * a problem nobody photographed.
 */
export const PROBLEM_READING_KEY = 'capture-problem-is-reading';

export interface ProblemStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

export function readProblem(storage: ProblemStorage): string | null {
  const raw = storage.getString(PROBLEM_KEY);
  return raw === undefined || raw.length === 0 ? null : raw;
}

export function writeProblem(storage: ProblemStorage, problem: string | null): void {
  if (problem === null || problem.length === 0) storage.remove(PROBLEM_KEY);
  else storage.set(PROBLEM_KEY, problem);
}

export function readProblemIsReading(storage: ProblemStorage): boolean {
  return storage.getString(PROBLEM_READING_KEY) === '1';
}

export function writeProblemIsReading(storage: ProblemStorage, isReading: boolean): void {
  if (isReading) storage.set(PROBLEM_READING_KEY, '1');
  else storage.remove(PROBLEM_READING_KEY);
}

/**
 * The learner's whiteboard, across a reload.
 *
 * Same storage as the problem and for the same reason: the working a child did
 * on their own scratch paper is their homework, and losing it to a refresh is
 * the defect this file was written to fix, one artefact over.
 *
 * LOCAL ONLY, and that is a limit rather than an oversight. The conversation
 * resumes from the SERVER (`tutor.store`'s `hydrate`), so it survives a change
 * of device; the board does not, because there is no carrier for it — no route
 * under `/api/tutor/` accepts one and inventing a collection to hold a child's
 * scratch paper is not a call this change gets to make. A learner who moves
 * from the laptop to the phone finds their conversation and an empty board.
 *
 * It is a Quickdraw snapshot serialised as JSON — vector records, no bitmaps.
 * The engine embeds pasted images as data URLs, which is what would make a
 * snapshot large enough to matter against localStorage's ~5 MB, and the tutor's
 * board mounts with `hideUi` and no paste path, so nothing can put one in.
 */
export const BOARD_KEY = 'tutor-board-snapshot';

export function readBoard(storage: ProblemStorage): unknown {
  const raw = storage.getString(BOARD_KEY);
  if (raw === undefined || raw.length === 0) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    /*
      A snapshot written by an older engine that this one cannot parse is not an
      error to report — it is a board that is gone. Returning `undefined` opens
      a blank one, which is what the child would get anyway, instead of throwing
      inside a render.
    */
    return undefined;
  }
}

export function writeBoard(storage: ProblemStorage, snapshot: unknown): void {
  if (snapshot === undefined || snapshot === null) storage.remove(BOARD_KEY);
  else storage.set(BOARD_KEY, JSON.stringify(snapshot));
}
