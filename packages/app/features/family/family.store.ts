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
// `setChildren` is the data seam. PR #100 gives it its first caller:
// `GuardianHomeScreen` writes the result of `useGuardianWards` (GET
// /api/guardian/wards, active guardianships only) through it, so `id` is the
// ward's `learnerAuthId` and `name` is the server's `displayName`. The type
// lives here now, not in the parent-home fixture file, because the fixture is
// no longer the thing that defines what a child record is.
// SOT: docs/design/overhaul-v2/J-component-plan.md §2 row 10 · design/screens/guardian/guardian.family/contract.md · docs/pack/36-role-navigation-flows.md §3.2 · docs/work/pr-100/contract.md §Routes
// SOT-KEYWORDS: family store children selected learner active child switcher guardian g-8 zustand wards

import { create } from 'zustand';
import type { AgeBand } from '../capture/age-band';

/** One ward as every guardian surface sees it. `id` is the learner's auth id. */
export interface ChildSummary {
  id: string;
  name: string;
  gradeBand: AgeBand;
}

interface FamilyState {
  children: ChildSummary[];
  /** The child every per-child surface is scoped to; null before a selection. */
  selectedLearnerId: string | null;
  selectLearner: (learnerId: string) => void;
  /** The data seam: the wards query writes here. */
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

/** The active child's record, for surfaces that need the name as well as the id. */
export function useActiveChild(): ChildSummary | undefined {
  return useFamilyStore((s) => {
    const id = s.selectedLearnerId ?? s.children[0]?.id;
    return id === undefined ? undefined : s.children.find((c) => c.id === id);
  });
}
