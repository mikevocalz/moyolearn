'use client';
import { create } from 'zustand';
import type { TutorStageState } from '@acme/ui';
import { traceAttempt, DEFAULT_TRACING } from '@acme/student-model/pure';
import { useCaptureStore } from '../capture';

interface TutorState {
  state: TutorStageState;
  skillTitle: string;
  mastery: number;
  attempts: number;
  start: (problem: string | null) => void;
  send: (message: string) => void;
  respond: (isCorrect: boolean) => void;
}

function openingUterance(problem: string | null): TutorStageState {
  return {
    kind: 'speaking',
    utterance: { text: problem ? `Let's work on: ${problem}` : "What would you like to work on?" },
  };
}

export const useTutorStore = create<TutorState>((set) => ({
  state: openingUterance(null),
  skillTitle: '',
  mastery: DEFAULT_TRACING.prior,
  attempts: 0,
  start: (problem) => set({
    state: openingUterance(problem),
    skillTitle: problem ?? 'this problem',
    mastery: DEFAULT_TRACING.prior,
    attempts: 0,
  }),
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
          message: `It looks like ${s.skillTitle} is still tricky. Let's try once more, one step at a time.`,
        };
    return { mastery: nextMastery, state };
  }),
}));
