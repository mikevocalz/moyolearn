'use client';
import { create } from 'zustand';
import type { TutorStageState } from '@acme/ui';
import {
  traceAttempt,
  DEFAULT_TRACING,
  masterySentence,
  inferSkillTitle,
} from '@acme/student-model/pure';
import { useCaptureStore } from '../capture';

interface TutorState {
  state: TutorStageState;
  problem: string;
  skillTitle: string;
  mastery: number;
  attempts: number;
  start: (problem: string | null) => void;
  tryIt: () => void;
  nextHint: () => void;
  send: (message: string) => void;
  respond: (isCorrect: boolean) => void;
}

function askingState(problem: string): TutorStageState {
  return {
    kind: 'speaking',
    utterance: { text: `Now you try: ${problem}` },
  };
}

export const useTutorStore = create<TutorState>((set) => ({
  state: { kind: 'presence' },
  problem: '',
  skillTitle: '',
  mastery: DEFAULT_TRACING.prior,
  attempts: 0,
  start: (problem) => {
    const p = problem ?? '';
    const skillTitle = inferSkillTitle(p);
    set({
      state: {
        kind: 'hint',
        step: {
          index: 1,
          total: 2,
          message: `For ${skillTitle}, start by identifying the most important operation in the problem.`,
        },
      },
      problem: p,
      skillTitle,
      mastery: DEFAULT_TRACING.prior,
      attempts: 0,
    });
  },
  nextHint: () => set((s) => ({
    state: {
      kind: 'hint',
      step: {
        index: 2,
        total: 2,
        message: `Then work through ${s.skillTitle} one step at a time.`,
      },
    },
  })),
  tryIt: () => set((s) => ({ state: askingState(s.problem) })),
  send: (message) => set((s) => ({
    state: { kind: 'thinking' },
    attempts: s.attempts + 1,
  })),
  respond: (isCorrect) => set((s) => {
    const nextMastery = traceAttempt(s.mastery, isCorrect);
    const state: TutorStageState = isCorrect
      ? {
          kind: 'speaking',
          utterance: { text: `Nice work on ${s.skillTitle}. That's the right idea — keep going.` },
        }
      : {
          kind: 'diagnosis',
          name: s.skillTitle,
          message: `${masterySentence(s.skillTitle, nextMastery, s.attempts)} Let's try once more.`,
        };
    return { mastery: nextMastery, state };
  }),
}));
