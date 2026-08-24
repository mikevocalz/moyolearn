'use client';
// S25 flow state. Zustand, not useState — the class code is minted on one step
// and shown on another, and the grade band chosen on the class step decides what
// the roster step is allowed to offer.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding teacher store zustand class code band roster assignment

import { create } from 'zustand';
import {
  classCode,
  EMPTY_TEACHER_DRAFT,
  type GradeBand,
  type TeacherDraft,
  type TeacherStep,
} from './steps.ts';

interface TeacherOnboardingState {
  step: TeacherStep;
  draft: TeacherDraft;
  setStep: (step: TeacherStep) => void;
  patch: (patch: Partial<TeacherDraft>) => void;
  chooseBand: (gradeBand: GradeBand) => void;
  setGuardianEmails: (emails: string[]) => void;
  chooseTemplate: (templateId: string) => void;
  sendAssignment: () => void;
  reset: () => void;
}

export const useTeacherOnboarding = create<TeacherOnboardingState>((set) => ({
  step: 'account',
  draft: EMPTY_TEACHER_DRAFT,
  setStep: (step) => set({ step }),
  patch: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  // The code is minted with the band, so the roster step always has one to show
  // — including for a K–5 class, where it is only ever used by the guardian link.
  chooseBand: (gradeBand) =>
    set((s) => ({ draft: { ...s.draft, gradeBand, code: s.draft.code || classCode() } })),
  setGuardianEmails: (guardianEmails) => set((s) => ({ draft: { ...s.draft, guardianEmails } })),
  chooseTemplate: (templateId) => set((s) => ({ draft: { ...s.draft, templateId } })),
  sendAssignment: () => set((s) => ({ draft: { ...s.draft, assignmentSent: true } })),
  reset: () => set({ step: 'account', draft: EMPTY_TEACHER_DRAFT }),
}));
