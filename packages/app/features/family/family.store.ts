'use client';
// Family store — the one seam every per-child guardian surface reads.
//
// G-8 (E §5): child-switch state squatted in `ai-activity.store`, so "which
// child am I looking at" was owned by one consent screen and invisible to
// home, reports, and calendar. This is the `family.store [add]` the
// guardian.home / guardian.family contracts name: one `selectedLearnerId`,
// written by the ChildSwitcher and the Family hub, read everywhere.
//
// The list starts EMPTY, and that is a privacy decision rather than a tidiness
// one. It used to seed from the parent-home `CHILDREN` fixture, and
// `profile-switcher` is a learner-facing surface (FD-24, the family-device
// switcher, mounted on the learner You tab and behind the K–2/3–5 shell header
// avatar). So every child on every device was shown invented sibling names and
// could tap one, which called `setContext({ kind: 'learner', learnerId })` with
// a fixture id — switching into a learner identity that is not theirs. An empty
// list removes that outright.
//
// `setChildren` is the seam the real guardianship query writes through.
// It has no caller yet: `/api/family/learners` exports POST only, so no
// guardian children read exists to wire. Until one does, surfaces render their
// "no children yet" state, which is true, instead of a fabricated family.
// SOT: docs/design/overhaul-v2/J-component-plan.md §2 row 10 · design/screens/guardian/guardian.family/contract.md · docs/pack/36-role-navigation-flows.md §3.2
// SOT-KEYWORDS: family store children selected learner active child switcher guardian g-8 zustand

import { create } from 'zustand';
import type { ChildSummary } from '../home/parent-home.data';

export type { ChildSummary };

interface FamilyState {
  children: ChildSummary[];
  /** The child every per-child surface is scoped to; null before a selection. */
  selectedLearnerId: string | null;
  selectLearner: (learnerId: string) => void;
  /** The data seam: the real children query writes here; the fixture only seeds it. */
  setChildren: (children: ChildSummary[]) => void;
}

export const useFamilyStore = create<FamilyState>((set) => ({
  children: [],
  selectedLearnerId: null,
  selectLearner: (selectedLearnerId) => set({ selectedLearnerId }),
  setChildren: (children) =>
    set((state) => ({
      children,
      // A selection that no longer names a child on the account is stale, not
      // sticky — carrying it forward would scope surfaces to a ghost.
      selectedLearnerId:
        state.selectedLearnerId !== null && children.some((c) => c.id === state.selectedLearnerId)
          ? state.selectedLearnerId
          : null,
    })),
}));

/**
 * `selectedLearnerId ?? first child` — the default consumers previously derived
 * locally (ai-activity did exactly this against its own copy of the state).
 * Centralised so "no selection yet" means the same child on every surface.
 */
export function useActiveLearnerId(): string | undefined {
  return useFamilyStore((s) => s.selectedLearnerId ?? s.children[0]?.id);
}
