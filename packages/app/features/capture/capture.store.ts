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
import { readProblem, writeProblem } from './problem-storage.shared.ts';

interface CaptureState {
  problem: string | null;
  setProblem: (problem: string | null) => void;
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

  setProblem: (problem) => {
    writeProblem(problemStorage, problem);
    set({ problem });
  },

  clearProblem: () => {
    writeProblem(problemStorage, null);
    set({ problem: null });
  },
}));
