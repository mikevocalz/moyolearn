'use client';
// Coach-mark persistence — which one-time tips this device has already been
// taught, plus the one-at-a-time rule that keeps them from stacking.
//
// WHY THIS LIVES IN THE KIT AND NOT IN `packages/app`. Three seams already
// persist a small synchronous preference, and all three are the SAME
// arrangement: a `.shared` factory over a three-method storage port, an MMKV
// `.native` fork, a localStorage `.web` fork, and a `.ts` resolution anchor —
// `providers/session/last-shell.*` (app-level), `features/onboarding/
// onboarding-storage.*` (feature-level) and `adaptive-panes/
// pane-overrides.store.*` (kit-level). A coach mark is a kit component, so it
// takes the kit-level one: `pane-overrides` is the precedent that already
// proved a `packages/ui` component can own persisted state without dragging
// `packages/app` in behind it. This is that arrangement a third time, not a
// fourth seam.
//
// Synchronous is the requirement, same as pane-overrides: an async read would
// let the tip paint and then vanish on a device that had already dismissed it.
// SOT: packages/ui/adaptive-panes/pane-overrides.store.shared.ts · docs/pack/37-onboarding-dual-pane.md §4 (PR-147)
// SOT-KEYWORDS: coach mark store shared seen once persistence zustand factory tip contextual
import { create } from 'zustand';

export const STORAGE_KEY = 'coach-marks-seen';

/**
 * Every one-time tip in the product, as a closed union.
 *
 * A free-form string id would make the persistence namespace unbounded: two
 * call sites could collide on `'camera'`, and a renamed tip would silently
 * re-teach itself to everyone. Doc 37 §4 names the two — the Snap taught at the
 * capture surface, and "how session notes work" at the tutor's first Notes
 * visit.
 */
export const COACH_MARK_IDS = ['capture-snap', 'tutor-notes'] as const;
export type CoachMarkId = (typeof COACH_MARK_IDS)[number];

export type SeenCoachMarks = Partial<Record<CoachMarkId, true>>;

/** The three operations this needs. MMKV has this shape; web adapts localStorage. */
export interface CoachMarkStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

/**
 * Reads the blob and keeps only ids that still exist.
 *
 * Filtering through `COACH_MARK_IDS` rather than casting the parsed object is
 * what makes a RETIRED id stay retired: if `'capture-snap'` is ever replaced by
 * a differently-scoped tip, the old flag in a million devices' storage does not
 * come back to life and suppress the new one.
 */
export function readSeen(storage: CoachMarkStorage): SeenCoachMarks {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return {};
  const seen: SeenCoachMarks = {};
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    for (const id of COACH_MARK_IDS) if (parsed[id] === true) seen[id] = true;
  } catch {
    // A malformed blob is a partial write. Dropping it re-teaches a tip at
    // worst, which is the harmless direction to fail in.
    storage.remove(STORAGE_KEY);
  }
  return seen;
}

export interface CoachMarkState {
  seen: SeenCoachMarks;
  /**
   * The tip currently holding the screen, or `null`.
   *
   * Doc 37 §4's "never modal-stacked" is enforced here rather than trusted to
   * call sites: the first tip to mount claims the slot and any other mounted at
   * the same moment renders nothing. The loser is NOT marked seen, so it teaches
   * itself on the next visit instead of being silently spent.
   */
  showing: CoachMarkId | null;
  /** Take the slot if it is free. Idempotent — Strict Mode mounts twice. */
  claim: (id: CoachMarkId) => void;
  /** Give the slot back on unmount, without marking anything taught. */
  release: (id: CoachMarkId) => void;
  /** The tip was read and dismissed. This is the only thing that persists. */
  dismiss: (id: CoachMarkId) => void;
  /** Return one tip to un-taught — the way back every persisted preference here has. */
  forget: (id: CoachMarkId) => void;
}

/**
 * Module-level, like the pane overrides and unlike the per-surface layout store:
 * "this device has been shown the Snap tip" is a fact about the device, and a
 * per-instance store would re-teach it on every remount.
 */
export function createCoachMarkStore(storage: CoachMarkStorage) {
  const persist = (seen: SeenCoachMarks) => storage.set(STORAGE_KEY, JSON.stringify(seen));

  return create<CoachMarkState>((set, get) => ({
    seen: readSeen(storage),
    showing: null,

    claim: (id) => {
      const { showing, seen } = get();
      if (seen[id] === true) return;
      if (showing !== null && showing !== id) return;
      if (showing === id) return;
      set({ showing: id });
    },

    release: (id) => {
      if (get().showing !== id) return;
      set({ showing: null });
    },

    dismiss: (id) => {
      const seen: SeenCoachMarks = { ...get().seen, [id]: true };
      persist(seen);
      set({ seen, showing: get().showing === id ? null : get().showing });
    },

    forget: (id) => {
      const seen: SeenCoachMarks = { ...get().seen };
      delete seen[id];
      persist(seen);
      set({ seen });
    },
  }));
}
