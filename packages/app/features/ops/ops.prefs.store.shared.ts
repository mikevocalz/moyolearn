import { createStore } from 'zustand';
import {
  DEFAULT_TABLE_PREFS,
  applyVisibility,
  reconcileTablePrefs,
  setViewMode,
  toggleColumn,
  toggleDensity,
  type OpsTablePrefs,
  type OpsViewMode,
  type SavedTablePrefs,
} from './ops.prefs.ts';

/**
 * WHERE THE OPS TABLE PREFS LIVE: one key, as JSON, in whatever synchronous
 * key-value store the platform fork hands over — the editor toolbar's exact
 * arrangement (`preferences.store.shared.ts`), reused rather than re-invented.
 *
 * Synchronous is the requirement: an async read means the table paints every
 * column at cool density and then rearranges itself in front of the user.
 *
 * Doc 28 §2's Zustand column, and ONLY that column: this store may never grow a
 * `rows` field. The trap-1 shape test in ops.prefs.test.ts enumerates the keys.
 * SOT: docs/pack/28-ops-dashboard-spec.md §2 §5
 * SOT-KEYWORDS: ops prefs store durable density columns zustand persistence
 */
export const OPS_PREFS_KEY = 'ops-table-prefs';

/** The three operations prefs need. MMKV already has exactly this shape. */
export interface OpsPrefsStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

export interface OpsPrefsState {
  prefs: OpsTablePrefs;
  toggleColumn: (id: string) => void;
  toggleDensity: () => void;
  adoptVisibility: (visibility: Record<string, boolean>) => void;
  setViewMode: (viewMode: OpsViewMode) => void;
}

export function readTablePrefs(storage: OpsPrefsStorage): OpsTablePrefs {
  const raw = storage.getString(OPS_PREFS_KEY);
  if (raw === undefined) return DEFAULT_TABLE_PREFS;
  try {
    // Reconciled on the way IN, never trusted as-is: the save may predate a
    // column rename or carry a density this version never shipped.
    return reconcileTablePrefs(JSON.parse(raw) as SavedTablePrefs);
  } catch {
    storage.remove(OPS_PREFS_KEY);
    return DEFAULT_TABLE_PREFS;
  }
}

/**
 * `initial` is a parameter rather than always `readTablePrefs(storage)` because
 * the two platforms disagree on when the saved value may first be observed —
 * see ops.prefs.store.web.ts.
 */
export function createOpsPrefsStore(storage: OpsPrefsStorage, initial: OpsTablePrefs) {
  return createStore<OpsPrefsState>((set, get) => {
    const persist = (prefs: OpsTablePrefs) => {
      storage.set(OPS_PREFS_KEY, JSON.stringify(prefs));
      set({ prefs });
    };

    return {
      prefs: initial,
      toggleColumn: (id) => persist(toggleColumn(get().prefs, id)),
      toggleDensity: () => persist(toggleDensity(get().prefs)),
      adoptVisibility: (visibility) => persist(applyVisibility(get().prefs, visibility)),
      setViewMode: (viewMode) => persist(setViewMode(get().prefs, viewMode)),
    };
  });
}
