'use client';
import { create } from 'zustand';
import type { RealtimeHintKey } from './age-band';

interface RealtimeHintsState {
  currentHint: RealtimeHintKey | null;
  setHint: (hint: RealtimeHintKey | null) => void;
}

export const useRealtimeHintsStore = create<RealtimeHintsState>((set) => ({
  currentHint: null,
  setHint: (hint) => set({ currentHint: hint }),
}));
