'use client';
// Plan view state. Zustand, not useState — selection survives a remount when
// the plan is hosted in a split pane rather than its own route.
// SOT: docs/pack/04-screen-briefs.md §S8
// SOT-KEYWORDS: plan store selected day zustand

import { create } from 'zustand';

interface PlanState {
  /** null follows the first day in the strip. */
  selectedDayId: string | null;
  selectDay: (dayId: string) => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  selectedDayId: null,
  selectDay: (selectedDayId) => set({ selectedDayId }),
}));
