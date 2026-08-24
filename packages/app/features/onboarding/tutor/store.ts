'use client';
// S23 flow state. Zustand, not useState — five steps read the same draft, and the
// availability grid is edited on one step and summarised on another.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding tutor store zustand draft subjects credentials slots

import { create } from 'zustand';
import {
  EMPTY_TUTOR_DRAFT,
  toggleSlot,
  toggleSubject,
  type Credential,
  type Slot,
  type TeachableSubject,
  type TutorDraft,
  type TutorStep,
} from './steps';

interface TutorOnboardingState {
  step: TutorStep;
  draft: TutorDraft;
  setStep: (step: TutorStep) => void;
  patch: (patch: Partial<TutorDraft>) => void;
  toggleSubject: (id: TeachableSubject) => void;
  toggleSlot: (value: Slot) => void;
  addCredential: (file: Credential) => void;
  removeCredential: (index: number) => void;
  reset: () => void;
}

export const useTutorOnboarding = create<TutorOnboardingState>((set) => ({
  step: 'account',
  draft: EMPTY_TUTOR_DRAFT,
  setStep: (step) => set({ step }),
  patch: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  toggleSubject: (id) =>
    set((s) => ({ draft: { ...s.draft, subjects: toggleSubject(s.draft.subjects, id) } })),
  toggleSlot: (value) =>
    set((s) => ({ draft: { ...s.draft, slots: toggleSlot(s.draft.slots, value) } })),
  addCredential: (file) =>
    set((s) => ({ draft: { ...s.draft, credentials: [...s.draft.credentials, file] } })),
  removeCredential: (index) =>
    set((s) => ({
      draft: { ...s.draft, credentials: s.draft.credentials.filter((_, i) => i !== index) },
    })),
  reset: () => set({ step: 'account', draft: EMPTY_TUTOR_DRAFT }),
}));
