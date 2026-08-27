'use client';
// S21 flow state. Zustand, not useState — this draft outlives a single screen
// and the child rows are read by more than one step.
//
// Persisted (doc 37 / pane-audit-37 §A.3): a guardian who backgrounds the app
// or reloads the tab mid-flow resumes on the step they left with the children
// and consent they already entered. Child PASSWORDS are excluded from the
// persisted partial — a credential in plaintext MMKV/localStorage outlives the
// flow, and a committed row no longer needs one (steps.ts, isChildComplete).
// The in-flight flags (`committing`, `commitError`) stay session-only for the
// same reason a resumed flow must never open on a spinner nothing is spinning.
// SOT: docs/pack/06-auth-onboarding-spec.md §5 · docs/pack/37-onboarding-dual-pane.md §2
// SOT-KEYWORDS: onboarding guardian store zustand draft children consent persist family

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { onboardingStateStorage } from '../onboarding-storage';
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

export const useGuardianOnboarding = create<GuardianOnboardingState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'guardian-onboarding',
      storage: createJSONStorage(() => onboardingStateStorage),
      partialize: (s) => ({
        step: s.step,
        draft: {
          ...s.draft,
          // Never persist a child's password — see the header. An uncommitted
          // row rehydrates with the field blank and its live validation asks
          // again; a committed row never needs it again.
          children: s.draft.children.map((child) => ({ ...child, password: '' })),
        },
      }),
    },
  ),
);
