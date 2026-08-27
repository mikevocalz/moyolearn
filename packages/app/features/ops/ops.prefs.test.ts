// The durable table prefs are the one slice of ops state that must survive a
// reload WITHOUT ever holding a row — doc 28's first trap is a store that
// mirrors server data, so the test asserts the shape as much as the behaviour.
// Pure in, pure out — no renderer, no storage.
// SOT-KEYWORDS: ops prefs test density column visibility durable zustand
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_TABLE_PREFS,
  HIDEABLE_COLUMNS,
  applyVisibility,
  columnVisibilityFor,
  reconcileTablePrefs,
  toggleColumn,
  toggleDensity,
} from './ops.prefs.ts';

describe('the hideable registry', () => {
  it('never offers the identity or the write control for hiding', () => {
    // `family` is what a row IS and `stage` is where the write path lives —
    // hiding either turns a CRM table into a list of orphaned numbers.
    const ids: readonly string[] = HIDEABLE_COLUMNS.map((c) => c.id);
    assert.ok(!ids.includes('family'));
    assert.ok(!ids.includes('stage'));
  });

  it('labels every hideable column, since the toggle menu prints the label', () => {
    for (const column of HIDEABLE_COLUMNS) assert.ok(column.label.length > 0, column.id);
  });
});

describe('toggleColumn', () => {
  it('hides a visible column and shows a hidden one', () => {
    const hidden = toggleColumn(DEFAULT_TABLE_PREFS, 'owner');
    assert.deepEqual(hidden.hiddenColumns, ['owner']);
    const shown = toggleColumn(hidden, 'owner');
    assert.deepEqual(shown.hiddenColumns, []);
  });

  it('refuses to hide a column the registry does not offer', () => {
    assert.deepEqual(toggleColumn(DEFAULT_TABLE_PREFS, 'family'), DEFAULT_TABLE_PREFS);
  });
});

describe('toggleDensity', () => {
  it('walks cool → roomy → cool', () => {
    const roomy = toggleDensity(DEFAULT_TABLE_PREFS);
    assert.equal(roomy.density, 'roomy');
    assert.equal(toggleDensity(roomy).density, 'cool');
  });
});

describe('columnVisibilityFor', () => {
  it('maps hidden ids to false and says nothing about the rest', () => {
    const prefs = toggleColumn(DEFAULT_TABLE_PREFS, 'sessions');
    assert.deepEqual(columnVisibilityFor(prefs), { sessions: false });
  });
});

describe('applyVisibility', () => {
  it('adopts a visibility record the table produced', () => {
    const next = applyVisibility(DEFAULT_TABLE_PREFS, { owner: false, value: true });
    assert.deepEqual(next.hiddenColumns, ['owner']);
  });

  it('ignores ids outside the registry, so a column rename cannot strand a save', () => {
    const next = applyVisibility(DEFAULT_TABLE_PREFS, { tutorRating: false, owner: false });
    assert.deepEqual(next.hiddenColumns, ['owner']);
  });
});

describe('reconcileTablePrefs', () => {
  it('returns the defaults for a first run', () => {
    assert.deepEqual(reconcileTablePrefs(null), DEFAULT_TABLE_PREFS);
  });

  it('drops hidden ids the registry no longer knows', () => {
    const result = reconcileTablePrefs({ density: 'roomy', hiddenColumns: ['owner', 'gone'] });
    assert.deepEqual(result.hiddenColumns, ['owner']);
    assert.equal(result.density, 'roomy');
  });

  it('rejects a density outside the pair rather than rendering an unknown row height', () => {
    assert.equal(reconcileTablePrefs({ density: 'cozy', hiddenColumns: [] }).density, 'cool');
  });

  it('holds NO server data by construction — the trap-1 shape check', () => {
    // If someone adds `rows`, `leads` or any server-owned field to the prefs,
    // this enumeration of keys is the test that names the day it happened.
    assert.deepEqual(Object.keys(DEFAULT_TABLE_PREFS).sort(), ['density', 'hiddenColumns']);
  });
});
