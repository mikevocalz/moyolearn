'use client';
import { create } from 'zustand';
import type { TutorStageState } from '@acme/ui';
import { useCaptureStore } from '../capture';

interface TutorState {
  state: TutorStageState;
  start: (problem: string | null) => void;
  send: (message: string) => void;
  respond: (message: string) => void;
}

function openingUterance(problem: string | null): TutorStageState {
  return {
    kind: 'speaking',
    utterance: { text: problem ? `Let's work on: ${problem}` : "What would you like to work on?" },
  };
}

export const useTutorStore = create<TutorState>((set) => ({
  state: openingUterance(null),
  start: (problem) => set({ state: openingUterance(problem) }),
  send: (message) => set({ state: { kind: 'thinking' } }),
  respond: (message) => {
    const problem = useCaptureStore.getState().problem;
    set({
      state: {
        kind: 'speaking',
        utterance: { text: `${problem ? `Working on ${problem}. ` : ''}You said: ${message}. What do you think the next step is?` },
      },
    });
  },
}));
