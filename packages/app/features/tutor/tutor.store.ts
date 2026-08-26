'use client';
import { create } from 'zustand';
import type { TutorStageState } from '@acme/ui';
import { useCaptureStore } from '../capture';

interface TutorState {
  state: TutorStageState;
  start: (problem: string | null) => void;
  send: (message: string) => void;
  respond: () => void;
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
  respond: () => {
    set({
      state: {
        kind: 'diagnosis',
        name: 'Addition before multiplication',
        message: "It looks like the addition got done before the multiplication. That's the most common order-of-operations hiccup. Let's try once more, doing the multiplication first.",
      },
    });
  },
}));
