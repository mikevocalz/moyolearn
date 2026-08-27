'use client';
// S22 flow state. Zustand, not useState — the subject picks survive the step
// change and the win screen reads them to choose its question.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding learner store zustand first-run subjects win

import { create } from 'zustand';
import {
  EMPTY_LEARNER_DRAFT,
  toggleSubject,
  winItem,
  type LearnerDraft,
  type LearnerStep,
  type SubjectId,
} from './steps';

interface LearnerFirstRunState {
  step: LearnerStep;
  draft: LearnerDraft;
  setStep: (step: LearnerStep) => void;
  start: (firstName: string) => void;
  pickAvatar: (id: string) => void;
  toggle: (id: SubjectId) => void;
  answer: (choiceIndex: number) => void;
  reset: () => void;
}

export const useLearnerFirstRun = create<LearnerFirstRunState>((set) => ({
  step: 'avatar',
  draft: EMPTY_LEARNER_DRAFT,
  setStep: (step) => set({ step }),
  start: (firstName) => set({ step: 'avatar', draft: { ...EMPTY_LEARNER_DRAFT, firstName } }),
  pickAvatar: (id) => set((s) => ({ draft: { ...s.draft, avatar: id } })),
  toggle: (id) =>
    set((s) => ({ draft: { ...s.draft, subjects: toggleSubject(s.draft.subjects, id) } })),
  answer: (choiceIndex) =>
    set((s) => ({
      draft: {
        ...s.draft,
        // A wrong tap is answerable again — the ladder, not a lockout (R4).
        result: choiceIndex === winItem(s.draft).answerIndex ? 'correct' : 'not-yet',
      },
    })),
  reset: () => set({ step: 'avatar', draft: EMPTY_LEARNER_DRAFT }),
}));
