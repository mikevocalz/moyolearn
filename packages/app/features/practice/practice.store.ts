'use client';
// Practice player state.
//
// `ladderDepth` is instrumented state, not a UI detail: R3 measures how deep a
// learner had to climb before solving, and doc 04 §S10's metric is the depth
// distribution. Resetting it per item is what makes that number meaningful.
// SOT: docs/pack/04-screen-briefs.md §S10
// SOT-KEYWORDS: practice store item index ladder depth checked correct zustand

import { create } from 'zustand';
import { PRACTICE_ITEMS } from './practice.data';

export type CheckResult = 'unchecked' | 'correct' | 'retry';

interface PracticeState {
  itemIndex: number;
  selectedChoice: number | null;
  result: CheckResult;
  /** How many rungs of the ladder are visible for the current item. */
  ladderDepth: number;
  /** Item ids solved with ladderDepth 0 — the unaided-solve rate. */
  unaidedSolves: string[];

  select: (choiceIndex: number) => void;
  check: () => void;
  nextRung: () => void;
  next: () => void;
  restart: () => void;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  itemIndex: 0,
  selectedChoice: null,
  result: 'unchecked',
  ladderDepth: 0,
  unaidedSolves: [],

  select: (selectedChoice) => set({ selectedChoice, result: 'unchecked' }),

  check: () => {
    const { itemIndex, selectedChoice, ladderDepth, unaidedSolves } = get();
    const item = PRACTICE_ITEMS[itemIndex];
    if (!item || selectedChoice === null) return;
    const correct = selectedChoice === item.answerIndex;
    set({
      result: correct ? 'correct' : 'retry',
      unaidedSolves:
        correct && ladderDepth === 0 ? [...unaidedSolves, item.id] : unaidedSolves,
    });
  },

  nextRung: () =>
    set((state) => {
      const item = PRACTICE_ITEMS[state.itemIndex];
      const max = item?.ladder.length ?? 0;
      return { ladderDepth: Math.min(state.ladderDepth + 1, max) };
    }),

  next: () =>
    set((state) => ({
      itemIndex: Math.min(state.itemIndex + 1, PRACTICE_ITEMS.length - 1),
      selectedChoice: null,
      result: 'unchecked',
      ladderDepth: 0,
    })),

  restart: () =>
    set({ itemIndex: 0, selectedChoice: null, result: 'unchecked', ladderDepth: 0, unaidedSolves: [] }),
}));
