'use client';
// Consent state, and the safety status beside it.
//
// Locked records are rejected at the store, not merely disabled in the view:
// a consent we never request must be unreachable regardless of which surface
// calls the setter (R9).
//
// The safety half is doc 12 §5's "guardian-visible status". It lives here rather
// than in component state because it is shared, asynchronous, and has three
// distinct resting positions — not-yet-asked, could-not-ask, and an answer — and
// a boolean pair in a component is how "could not ask" ends up drawn as "all
// clear". `kind` makes the third one unrepresentable as the second.
// SOT: docs/pack/04-screen-briefs.md §S12 · docs/pack/12-systems-design-prompt.md §5
// SOT-KEYWORDS: ai activity consent store toggle locked zustand safety status paused alerts guardian

import { create } from 'zustand';
// Type-only, so `server-only` never reaches a bundle — the same seam
// `tutor.store.ts` uses to name `CoachEvent` (CLAUDE.md §The block).
import type { GuardianSafetyStatus } from './safety-status.service';
import { CONSENTS } from './ai-activity.data';

const LOCKED = new Set(CONSENTS.filter((c) => c.locked).map((c) => c.id));

/**
 * The same three-way env read every client module in the tree does. Copied
 * rather than imported from `../tutor/tutor.store`, because a guardian screen
 * pulling in the tutor's zustand store to read a base URL would mount the
 * child's conversation state on a parent's screen.
 */
const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_APP_URL ??
  'http://localhost:3001';

/**
 * Never-asked, asked-and-failed, and answered — three states, not two flags.
 *
 * `unreachable` exists so the surface can say so. A safety status that silently
 * falls back to "nothing to report" tells a parent the one thing it does not
 * know, on the one screen where being wrong about that matters.
 */
export type SafetyStatusState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'unreachable' }
  | { kind: 'ready'; status: GuardianSafetyStatus };

interface AiActivityState {
  values: Record<string, boolean>;
  /** The child whose activity is on screen; null before a selection. */
  selectedChildId: string | null;
  safety: SafetyStatusState;

  setConsent: (id: string, value: boolean) => void;
  selectChild: (childId: string) => void;
  /** Reads doc 12 §5's status. Idempotent; the screen calls it on mount. */
  loadSafety: () => Promise<void>;
}

export const useAiActivityStore = create<AiActivityState>((set) => ({
  values: Object.fromEntries(CONSENTS.map((c) => [c.id, c.value])),
  selectedChildId: null,
  safety: { kind: 'idle' },

  setConsent: (id, value) =>
    set((state) => (LOCKED.has(id) ? state : { values: { ...state.values, [id]: value } })),

  selectChild: (selectedChildId) => set({ selectedChildId }),

  loadSafety: async () => {
    set({ safety: { kind: 'loading' } });
    try {
      const response = await fetch(`${API_URL}/api/guardian/safety-status`, {
        credentials: 'include',
      });
      if (!response.ok) {
        set({ safety: { kind: 'unreachable' } });
        return;
      }
      const body = (await response.json()) as { ok: true; status: GuardianSafetyStatus };
      set({ safety: { kind: 'ready', status: body.status } });
    } catch {
      // Offline, or the route is down. Both are "we could not check", and both
      // must read as that rather than as a clean bill of health.
      set({ safety: { kind: 'unreachable' } });
    }
  },
}));
