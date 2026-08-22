'use client';
// Family calendar state.
//
// Day selection and child filter are local to the feature; children are owned
// by the parent-home fixture so the chip colors are consistent everywhere.
// SOT: docs/pack/04-screen-briefs.md §S13
// SOT-KEYWORDS: family calendar store day filter zustand

import { create } from 'zustand';

interface FamilyCalendarState {
  selectedDayId: string | null;
  selectedChildId: string | null;
  selectDay: (dayId: string) => void;
  selectChild: (childId: string | null) => void;
}

export const useFamilyCalendarStore = create<FamilyCalendarState>((set) => ({
  selectedDayId: null,
  selectedChildId: null,
  selectDay: (selectedDayId) => set({ selectedDayId }),
  selectChild: (selectedChildId) => set({ selectedChildId }),
}));
