// The ops table's durable view preferences — the Zustand column of doc 28 §2.
//
// This module is the shape check for the doc's FIRST trap: everything here is a
// preference ABOUT the pipeline (which columns show, how tall a row is) and
// nothing here is the pipeline. Rows never enter this file; Query owns them.
// Pure and without `'use client'` for the same reason `stage-change.ts` is —
// the logic with judgement calls in it is the part that earns a test.
// SOT: docs/pack/28-ops-dashboard-spec.md §2 §5 (Zustand: visible columns,
//   density, across sessions) · CLAUDE.md (UI · state)
// SOT-KEYWORDS: ops prefs density column visibility durable view zustand pure

/** The two row heights the dial already defines — cool 44px, hot/roomy 64px.
 *  A pair, not a scale: a third density would need a third token first. */
export type OpsDensity = 'cool' | 'roomy';

export interface OpsTablePrefs {
  density: OpsDensity;
  /** Column ids the user has hidden. Only ids from `HIDEABLE_COLUMNS` may appear. */
  hiddenColumns: readonly string[];
}

/**
 * What MAY be hidden, with the label the toggle menu prints. `family` and
 * `stage` are deliberately absent: the family is what a row IS, and the stage
 * badge is the write control — hiding either leaves a CRM table of orphaned
 * numbers with no way to act on them (Twenty pins its Name field the same way).
 */
export const HIDEABLE_COLUMNS = [
  { id: 'owner', label: 'Owner' },
  { id: 'nextSession', label: 'Next' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'value', label: 'Value' },
  { id: 'attendance', label: 'Attendance' },
] as const satisfies readonly { id: string; label: string }[];

const HIDEABLE_IDS: readonly string[] = HIDEABLE_COLUMNS.map((c) => c.id);

export const DEFAULT_TABLE_PREFS: OpsTablePrefs = { density: 'cool', hiddenColumns: [] };

export function toggleColumn(prefs: OpsTablePrefs, id: string): OpsTablePrefs {
  if (!HIDEABLE_IDS.includes(id)) return prefs;
  return {
    ...prefs,
    hiddenColumns: prefs.hiddenColumns.includes(id)
      ? prefs.hiddenColumns.filter((c) => c !== id)
      : [...prefs.hiddenColumns, id],
  };
}

export function toggleDensity(prefs: OpsTablePrefs): OpsTablePrefs {
  return { ...prefs, density: prefs.density === 'cool' ? 'roomy' : 'cool' };
}

/**
 * The record TanStack Table's `state.columnVisibility` wants. Hidden ids map to
 * `false` and everything else is simply absent — Table treats absence as
 * visible, so enumerating the visible columns here would just create a second
 * list that has to be kept in step with the column defs.
 */
export function columnVisibilityFor(prefs: OpsTablePrefs): Record<string, false> {
  return Object.fromEntries(prefs.hiddenColumns.map((id) => [id, false as const]));
}

/**
 * Adopts a visibility record the table produced (`onColumnVisibilityChange`),
 * filtered through the registry so Table can never persist a column this module
 * would refuse to toggle.
 */
export function applyVisibility(
  prefs: OpsTablePrefs,
  visibility: Record<string, boolean>,
): OpsTablePrefs {
  return {
    ...prefs,
    hiddenColumns: HIDEABLE_IDS.filter((id) => visibility[id] === false),
  };
}

/**
 * Reconciled on the way IN, never trusted as-is (the editor toolbar's rule):
 * the saved value may predate a column rename or carry a density this version
 * never shipped, and a preference must degrade to the default, not to a crash.
 */
/** What a save might look like: written by ANY past version, so every field is
 *  loose — a density string this build never shipped, ids for renamed columns. */
export type SavedTablePrefs = Partial<{ density: string; hiddenColumns: readonly string[] }>;

export function reconcileTablePrefs(saved: SavedTablePrefs | null): OpsTablePrefs {
  return {
    density: saved?.density === 'roomy' ? 'roomy' : 'cool',
    hiddenColumns: Array.isArray(saved?.hiddenColumns)
      ? saved.hiddenColumns.filter(
          (id): id is string => typeof id === 'string' && HIDEABLE_IDS.includes(id),
        )
      : [],
  };
}
