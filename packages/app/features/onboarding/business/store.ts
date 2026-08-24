'use client';
// S24 flow state. Zustand, not useState — the roster verdict is produced on the
// import step and counted on the checklist step, and activation is read by both.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding business store zustand org roster invite activation

import { create } from 'zustand';
import { importRoster, type ColumnRole, type RosterImport } from './roster-csv';
import { EMPTY_BUSINESS_DRAFT, toggleService, type BusinessDraft, type BusinessStep } from './steps';

interface BusinessOnboardingState {
  step: BusinessStep;
  draft: BusinessDraft;
  /** Kept so a re-map re-reads the same file without asking for it again. */
  csv: string;
  setStep: (step: BusinessStep) => void;
  patch: (patch: Partial<BusinessDraft>) => void;
  toggleService: (value: string) => void;
  readCsv: (text: string) => void;
  remap: (index: number, role: ColumnRole) => void;
  confirmImport: () => void;
  setInvitees: (emails: string[]) => void;
  sendInvites: () => void;
  completeMerchant: () => void;
  reset: () => void;
}

const withRoster = (draft: BusinessDraft, roster: RosterImport): BusinessDraft => ({
  ...draft,
  roster,
});

export const useBusinessOnboarding = create<BusinessOnboardingState>((set) => ({
  step: 'org',
  draft: EMPTY_BUSINESS_DRAFT,
  csv: '',
  setStep: (step) => set({ step }),
  patch: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  toggleService: (value) =>
    set((s) => ({ draft: { ...s.draft, services: toggleService(s.draft.services, value) } })),
  readCsv: (text) => set((s) => ({ csv: text, draft: withRoster(s.draft, importRoster(text)) })),
  remap: (index, role) =>
    set((s) => {
      if (!s.draft.roster) return s;
      const mapping = s.draft.roster.mapping.map((r, i) => (i === index ? role : r));
      return { draft: withRoster(s.draft, importRoster(s.csv, mapping)) };
    }),
  // Only the clean rows land: a row the mapper could not resolve is a row an
  // operator still has to look at, and importing it half-formed hides that.
  confirmImport: () =>
    set((s) => ({
      draft: {
        ...s.draft,
        activation: { ...s.draft.activation, learnersImported: s.draft.roster?.ready ?? 0 },
      },
    })),
  setInvitees: (tutorEmails) => set((s) => ({ draft: { ...s.draft, tutorEmails } })),
  sendInvites: () =>
    set((s) => ({
      draft: {
        ...s.draft,
        activation: { ...s.draft.activation, tutorsInvited: s.draft.tutorEmails.length },
      },
    })),
  completeMerchant: () =>
    set((s) => ({
      draft: { ...s.draft, activation: { ...s.draft.activation, merchantOnboarded: true } },
    })),
  reset: () => set({ step: 'org', draft: EMPTY_BUSINESS_DRAFT, csv: '' }),
}));
