'use client';
import { create } from 'zustand';
import type { TutorStageState } from '@acme/ui';
import {
  traceAttempt,
  DEFAULT_TRACING,
  masterySentence,
  inferSkillTitle,
  firstHint,
  secondHint,
} from '@acme/student-model/pure';
import { useCaptureStore } from '../capture';

interface TutorState {
  state: TutorStageState;
  problem: string;
  skillTitle: string;
  mastery: number;
  attempts: number;
  masteryBySkill: Record<string, number>;
  attemptsBySkill: Record<string, number>;
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
  masteryBySkill: {},
  attemptsBySkill: {},
  start: (problem) => {
    const p = problem ?? '';
    const skillTitle = inferSkillTitle(p);
    set((s) => {
      const mastery = s.masteryBySkill[skillTitle] ?? DEFAULT_TRACING.prior;
      const attempts = s.attemptsBySkill[skillTitle] ?? 0;
      return {
        state: {
          kind: 'hint',
          step: {
            index: 1,
            total: 2,
            message: `For ${skillTitle}: ${firstHint(skillTitle)}`,
          },
        },
        problem: p,
        skillTitle,
        mastery,
        attempts,
      };
    });
  },
  nextHint: () => set((s) => ({
    state: {
      kind: 'hint',
      step: {
        index: 2,
        total: 2,
        message: `${secondHint(s.skillTitle)}`,
      }
    },
  })),
  tryIt: () => set((s) => ({ state: askingState(s.problem) })),
  send: (message) => set((s) => ({
    state: { kind: 'thinking' },
    attempts: s.attempts + 1,
  })),
  respond: (isCorrect) => set((s) => {
    const nextMastery = traceAttempt(s.mastery, isCorrect);
    const nextAttempts = s.attempts;
    const state: TutorStageState = isCorrect
      ? {
          kind: 'speaking',
          utterance: { text: `Nice work on ${s.skillTitle}. That's the right idea — keep going.` },
        }
      : {
          kind: 'diagnosis',
          name: s.skillTitle,
          message: `${masterySentence(s.skillTitle, nextMastery, nextAttempts)} Let's try once more.`,
        };
    return {
      mastery: nextMastery,
      attempts: nextAttempts,
      masteryBySkill: { ...s.masteryBySkill, [s.skillTitle]: nextMastery },
      attemptsBySkill: { ...s.attemptsBySkill, [s.skillTitle]: nextAttempts },
      state,
    };
  }),
}));
