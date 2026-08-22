'use client';
import { create } from 'zustand';

interface CaptureState {
  problem: string | null;
  setProblem: (problem: string | null) => void;
  clearProblem: () => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  problem: null,
  setProblem: (problem) => set({ problem }),
  clearProblem: () => set({ problem: null }),
}));
