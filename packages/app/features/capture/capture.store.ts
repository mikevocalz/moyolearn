'use client';
import { create } from 'zustand';
/*
  Two imports, not one. A bundler resolves `./problem-storage` to the `.web`/
  `.native` FORK, never to the `.ts` anchor, so anything the anchor alone
  re-exported is invisible at runtime — the build failed with "Export
  readProblem doesn't exist in target module". The forks carry only the
  storage; the pure helpers come from the shared file directly.
*/
import { problemStorage } from './problem-storage';
import {
  readProblem,
  readProblemEvidence,
  readProblemIsReading,
  writeProblem,
  writeProblemEvidence,
  writeProblemIsReading,
  type ProblemEvidence,
} from './problem-storage.shared.ts';

interface CaptureState {
  problem: string | null;
  /**
   * `problem` came out of a recogniser, not out of a person.
   *
   * It travels with the text because the coaching turn needs it and nothing
   * downstream can infer it: by the time the tutor has the string, a photograph
   * and a served practice problem look identical. See `CoachTurnInput
   * .problemIsReading` for what the model does with it.
   */
  problemIsReading: boolean;
  /**
   * The server's handle on this problem, when the server issued it.
   *
   * Null for a photographed page: nothing has recorded a question for it yet,
   * and the grader refuses a turn it cannot bind to a revision it owns. That is
   * the honest state rather than a gap — a source nobody has confirmed is not
   * something to grade a child against.
   */
  problemEvidence: ProblemEvidence | null;
  /**
   * `isReading` defaults to false so the two SERVED call sites — the next-problem
   * fetch and the progress screen's re-open — keep reading as what they are
   * without naming it. Only the two capture paths pass true.
   */
  setProblem: (problem: string | null, isReading?: boolean, evidence?: ProblemEvidence | null) => void;
  clearProblem: () => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  /*
    Rehydrated, not null.

    In-memory, a refresh discarded the child's problem and `tutor-screen` fell
    through to `/api/tutor/next` — which GENERATES one. The learner uploaded
    their homework, reloaded, and was asked something they had never seen. The
    read is synchronous so the first render already knows, and no generated
    problem is ever painted over theirs.
  */
  problem: readProblem(problemStorage),
  problemIsReading: readProblemIsReading(problemStorage),
  problemEvidence: readProblemEvidence(problemStorage),

  /*
    The evidence defaults to NULL rather than to whatever was there, so a call
    site that sets a new problem without one cannot leave the previous
    question's handle attached to it. That is the only default that is safe:
    the stale pair would name a real, owned, current row, so the grade would
    pass every check and be a grade of the wrong question.
  */
  setProblem: (problem, isReading = false, evidence = null) => {
    writeProblem(problemStorage, problem);
    writeProblemIsReading(problemStorage, isReading);
    writeProblemEvidence(problemStorage, problem === null ? null : evidence);
    set({ problem, problemIsReading: isReading, problemEvidence: problem === null ? null : evidence });
  },

  clearProblem: () => {
    writeProblem(problemStorage, null);
    writeProblemIsReading(problemStorage, false);
    writeProblemEvidence(problemStorage, null);
    set({ problem: null, problemIsReading: false, problemEvidence: null });
  },
}));
