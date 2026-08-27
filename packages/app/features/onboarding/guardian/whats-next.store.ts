'use client';
// The one-time "what happens next" card behind doc 37 §2's guardian exit beat:
// onboarding ends on the family feed with a card saying what happens now, shown
// once and dismissible. This store is the seen-once flag — a tri-state, not a
// boolean pair, so an impossible combination (dismissed but never shown) cannot
// be represented. Lives with the guardian flow because completing that flow is
// the only thing that arms it; the home feed only reads and dismisses.
// Persisted through the onboarding storage fork (MMKV native / localStorage
// web) so the card stays dismissed across launches — the pane-overrides.store
// one-time-persistence arrangement, on the universal fork.
// SOT: docs/pack/37-onboarding-dual-pane.md §2 · docs/pack/36-role-navigation-flows.md §2
// SOT-KEYWORDS: guardian whats next card seen once store persist onboarding complete

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { onboardingStateStorage } from '../onboarding-storage';

type WhatsNextPhase =
  /** Guardian onboarding has not finished on this device. */
  | 'unseen'
  /** Onboarding finished; the feed shows the card until it is dismissed. */
  | 'eligible'
  | 'dismissed';

interface GuardianWhatsNextState {
  phase: WhatsNextPhase;
  /** Called once, by the guardian flow's completion — never by the feed. */
  arm: () => void;
  dismiss: () => void;
}

export const useGuardianWhatsNext = create<GuardianWhatsNextState>()(
  persist(
    (set) => ({
      phase: 'unseen',
      // Re-running onboarding after a dismissal does not resurrect the card:
      // the guardian has read it, and a card that keeps coming back is the
      // nagging doc 36's one-time rule exists to prevent.
      arm: () => set((s) => (s.phase === 'unseen' ? { phase: 'eligible' } : s)),
      dismiss: () => set({ phase: 'dismissed' }),
    }),
    {
      name: 'guardian-whats-next',
      storage: createJSONStorage(() => onboardingStateStorage),
    },
  ),
);
