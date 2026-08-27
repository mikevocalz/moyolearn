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
