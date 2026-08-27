'use client';
// S21 flow state. Zustand, not useState — this draft outlives a single screen
// and the child rows are read by more than one step.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding guardian store zustand draft children consent

import { create } from 'zustand';
import { EMPTY_DRAFT, type ChildDraft, type GuardianDraft, type GuardianStep } from './steps';

interface GuardianOnboardingState {
  step: GuardianStep;
  draft: GuardianDraft;
  /** True while the children step is committing rows server-side. */
  committing: boolean;
  commitError: string | null;
  setStep: (step: GuardianStep) => void;
  patch: (patch: Partial<GuardianDraft>) => void;
  addChild: () => void;
  patchChild: (index: number, patch: Partial<ChildDraft>) => void;
  removeChild: (index: number) => void;
  setCommitting: (committing: boolean) => void;
  setCommitError: (commitError: string | null) => void;
  reset: () => void;
}

const BLANK_CHILD: ChildDraft = { displayName: '', username: '', password: '', dob: '' };

export const useGuardianOnboarding = create<GuardianOnboardingState>((set) => ({
  step: 'welcome',
  draft: EMPTY_DRAFT,
  committing: false,
  commitError: null,
  setCommitting: (committing) => set({ committing }),
  setCommitError: (commitError) => set({ commitError }),
  setStep: (step) => set({ step }),
  patch: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  addChild: () => set((s) => ({ draft: { ...s.draft, children: [...s.draft.children, { ...BLANK_CHILD }] } })),
  patchChild: (index, patch) =>
    set((s) => ({
      draft: {
        ...s.draft,
        children: s.draft.children.map((c, i) => (i === index ? { ...c, ...patch } : c)),
      },
    })),
  removeChild: (index) =>
    set((s) => ({ draft: { ...s.draft, children: s.draft.children.filter((_, i) => i !== index) } })),
  reset: () => set({ step: 'welcome', draft: EMPTY_DRAFT, committing: false, commitError: null }),
}));
