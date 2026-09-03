'use client';
// Practice state — which set is open, and where the learner is inside it.
//
// `ladderDepth` is instrumented state, not a UI detail: R3 measures how deep a
// learner had to climb before solving, and doc 04 §S10's metric is the depth
// distribution. Resetting it per item is what makes that number meaningful.
//
// `setId` is what turned this screen from a player into `learner.stuff`. The
// contract's `completion_returns_to` is "self (practice hub — finished items
// return here)", so the hub is the resting state and a session is a mode inside
// it; `null` IS the hub, which makes "in a session with no set" unrepresentable.
//
// `finishedSetIds` answers the contract's second 5-second question — "What did I
// do before?" — from real state rather than a fixture. It is a completion mark,
// never a count aimed at the child: no streak, no total, no pressure to keep it
// (children's-surfaces law, PRD non-goal 7).
// SOT: docs/pack/04-screen-briefs.md §S10 · design/screens/learner/learner.stuff/contract.md
// SOT-KEYWORDS: practice store set hub item index ladder depth checked correct zustand finished

import { create } from 'zustand';
import { practiceSetById, type PracticeItem } from './practice.data';

export type CheckResult = 'unchecked' | 'correct' | 'retry';

interface PracticeState {
  /** `null` is the hub. A non-null id is a session on that set. */
  setId: string | null;
  itemIndex: number;
  selectedChoice: number | null;
  result: CheckResult;
  /** How many rungs of the ladder are visible for the current item. */
  ladderDepth: number;
  /** Item ids solved with ladderDepth 0 — the unaided-solve rate. */
  unaidedSolves: string[];
  /** Sets played all the way through, in finish order. */
  finishedSetIds: string[];

  openSet: (setId: string) => void;
  leaveSet: () => void;
  select: (choiceIndex: number) => void;
  check: () => void;
  nextRung: () => void;
  next: () => void;
  /** Replays the open set from its first item. */
  restart: () => void;
}

const SESSION_START = {
  itemIndex: 0,
  selectedChoice: null,
  result: 'unchecked',
  ladderDepth: 0,
  unaidedSolves: [],
} as const satisfies Omit<
  PracticeState,
  'setId' | 'finishedSetIds' | 'openSet' | 'leaveSet' | 'select' | 'check' | 'nextRung' | 'next' | 'restart'
>;

function itemsFor(setId: string | null): PracticeItem[] {
  return setId === null ? [] : (practiceSetById(setId)?.items ?? []);
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  setId: null,
  ...SESSION_START,
  finishedSetIds: [],

  openSet: (setId) => set({ setId, ...SESSION_START }),

  leaveSet: () => set({ setId: null, ...SESSION_START }),

  select: (selectedChoice) => set({ selectedChoice, result: 'unchecked' }),

  check: () => {
    const { setId, itemIndex, selectedChoice, ladderDepth, unaidedSolves, finishedSetIds } = get();
    const items = itemsFor(setId);
    const item = items[itemIndex];
    if (!item || selectedChoice === null || setId === null) return;
    const correct = selectedChoice === item.answerIndex;
    // The set is finished the moment its last item lands, so the mark is
    // written here rather than when the end card renders — a learner who walks
    // away from the celebration still finished the work.
    const finishesSet = correct && itemIndex === items.length - 1;
    set({
      result: correct ? 'correct' : 'retry',
      unaidedSolves: correct && ladderDepth === 0 ? [...unaidedSolves, item.id] : unaidedSolves,
      finishedSetIds:
        finishesSet && !finishedSetIds.includes(setId) ? [...finishedSetIds, setId] : finishedSetIds,
    });
  },

  nextRung: () =>
    set((state) => {
      const max = itemsFor(state.setId)[state.itemIndex]?.ladder.length ?? 0;
      return { ladderDepth: Math.min(state.ladderDepth + 1, max) };
    }),

  next: () =>
    set((state) => ({
      itemIndex: Math.min(state.itemIndex + 1, Math.max(itemsFor(state.setId).length - 1, 0)),
      selectedChoice: null,
      result: 'unchecked',
      ladderDepth: 0,
    })),

  restart: () => set(SESSION_START),
}));
