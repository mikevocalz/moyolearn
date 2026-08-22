'use client';
// Consent state.
//
// Locked records are rejected at the store, not merely disabled in the view:
// a consent we never request must be unreachable regardless of which surface
// calls the setter (R9).
// SOT: docs/pack/04-screen-briefs.md §S12
// SOT-KEYWORDS: ai activity consent store toggle locked zustand

import { create } from 'zustand';
import { CONSENTS } from './ai-activity.data';

const LOCKED = new Set(CONSENTS.filter((c) => c.locked).map((c) => c.id));

interface AiActivityState {
  values: Record<string, boolean>;
  /** The child whose activity is on screen; null before a selection. */
  selectedChildId: string | null;

  setConsent: (id: string, value: boolean) => void;
  selectChild: (childId: string) => void;
}

export const useAiActivityStore = create<AiActivityState>((set) => ({
  values: Object.fromEntries(CONSENTS.map((c) => [c.id, c.value])),
  selectedChildId: null,

  setConsent: (id, value) =>
    set((state) => (LOCKED.has(id) ? state : { values: { ...state.values, [id]: value } })),

  selectChild: (selectedChildId) => set({ selectedChildId }),
}));
