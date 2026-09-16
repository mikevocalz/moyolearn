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

/** Explicit origin marker. Missing provenance on a legacy problem is unresolved. */
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

/**
 * The server's handle on the problem, when it issued one.
 *
 * Stored beside the text and for the same reason the text is stored: a reload
 * that kept the question but dropped the handle would leave a child answering
 * a problem the grader can no longer prove it asked, so the answer would come
 * back ungraded with nothing on screen to explain why.
 *
 * Two ids in one key, separated by a space — which no id may contain, because
 * both are validated against the same character class the database's
 * `edu.opaque_id` domain uses. Anything that does not read back as exactly two
 * valid ids is treated as absent: the cost is one ungraded turn, and the
 * alternative is sending a malformed pair to a write path.
 */
export const PROBLEM_EVIDENCE_KEY = 'capture-problem-evidence';

export interface ProblemEvidence {
  questionId: string;
  revision: string;
}

const OPAQUE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function readProblemEvidence(storage: ProblemStorage): ProblemEvidence | null {
  const raw = storage.getString(PROBLEM_EVIDENCE_KEY);
  if (raw === undefined) return null;
  const [questionId, revision, ...rest] = raw.split(' ');
  if (rest.length > 0 || questionId === undefined || revision === undefined) return null;
  if (!OPAQUE_ID.test(questionId) || !OPAQUE_ID.test(revision)) return null;
  return { questionId, revision };
}

export function writeProblemEvidence(
  storage: ProblemStorage,
  evidence: ProblemEvidence | null,
): void {
  if (evidence === null || !OPAQUE_ID.test(evidence.questionId) || !OPAQUE_ID.test(evidence.revision)) {
    storage.remove(PROBLEM_EVIDENCE_KEY);
    return;
  }
  storage.set(PROBLEM_EVIDENCE_KEY, `${evidence.questionId} ${evidence.revision}`);
}

export function readProblemIsReading(storage: ProblemStorage): boolean {
  // Legacy/corrupt records have no explicit verification marker.
  return readProblem(storage) !== null && storage.getString(PROBLEM_READING_KEY) !== '0';
}

export function writeProblemIsReading(storage: ProblemStorage, isReading: boolean): void {
  storage.set(PROBLEM_READING_KEY, isReading ? '1' : '0');
}

/**
 * The learner's whiteboard, across a reload.
 *
 * Same storage as the problem and for the same reason: the working a child did
 * on their own scratch paper is their homework, and losing it to a refresh is
 * the defect this file was written to fix, one artefact over.
 *
 * THIS IS THE DEVICE'S COPY, not the only one. `PUT /api/tutor/session/board`
 * holds the same document for the learner's other devices; this key is what
 * makes a RELOAD instant, because `problemStorage` is synchronous and a network
 * read would paint blank paper first.
 *
 * The value is a base64 Yjs update, not a Quickdraw snapshot — the document is
 * a CRDT so that the server copy can MERGE rather than overwrite, and so that a
 * second author is a transport away rather than a rewrite
 * (`packages/app/features/tutor/board-doc.ts`). Vector records only: the engine
 * embeds pasted images as data URLs, which is what would make this large enough
 * to matter against localStorage's ~5 MB, and the tutor's board mounts with
 * `hideUi` and no paste path, so nothing can put one in.
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
