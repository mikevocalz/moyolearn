import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { maxIndexFor, resolveDrop, stepTarget } from './geometry.ts';

// A five-stage pipeline: 3, 2, 0, 4, 1 cards.
const LENGTHS = [3, 2, 0, 4, 1] as const;
const COLUMN_PITCH = 390;
const CARD_PITCH = 88;

const drop = (overrides: Partial<Parameters<typeof resolveDrop>[0]>) =>
  resolveDrop({
    fromColumn: 1,
    fromIndex: 1,
    dx: 0,
    dy: 0,
    columnPitch: COLUMN_PITCH,
    cardPitch: CARD_PITCH,
    columnLengths: LENGTHS,
    ...overrides,
  });

describe('maxIndexFor', () => {
  it('re-orders within the source column (0..len-1)', () => {
    assert.equal(maxIndexFor(0, 0, LENGTHS), 2);
  });

  it('inserts across columns (0..len, one past the last card)', () => {
    assert.equal(maxIndexFor(3, 0, LENGTHS), 4);
  });

  it('an empty column accepts exactly index 0', () => {
    assert.equal(maxIndexFor(2, 0, LENGTHS), 0);
    assert.equal(maxIndexFor(2, 2, LENGTHS), 0);
  });
});

describe('resolveDrop', () => {
  it('travel under half a pitch on both axes stays home', () => {
    assert.deepEqual(drop({ dx: COLUMN_PITCH * 0.4, dy: -CARD_PITCH * 0.4 }), {
      column: 1,
      index: 1,
    });
  });

  it('half a column pitch commits one column over — the ReorderRow threshold, sideways', () => {
    assert.deepEqual(drop({ dx: COLUMN_PITCH * 0.6 }).column, 2);
    assert.deepEqual(drop({ dx: -COLUMN_PITCH * 0.6 }).column, 0);
  });

  it('resolves both axes in one release', () => {
    const target = drop({ fromColumn: 0, fromIndex: 0, dx: COLUMN_PITCH, dy: CARD_PITCH * 2 });
    assert.deepEqual(target, { column: 1, index: 2 });
  });

  it('clamps the column to the board', () => {
    assert.equal(drop({ dx: COLUMN_PITCH * 40 }).column, LENGTHS.length - 1);
    assert.equal(drop({ dx: -COLUMN_PITCH * 40 }).column, 0);
  });

  it('clamps a cross-column index to the insertion bound', () => {
    const target = drop({ fromColumn: 0, fromIndex: 2, dx: COLUMN_PITCH * 3, dy: CARD_PITCH * 50 });
    assert.deepEqual(target, { column: 3, index: 4 });
  });

  it('drops into an empty column at index 0', () => {
    assert.deepEqual(drop({ dx: COLUMN_PITCH, dy: CARD_PITCH * 10 }), { column: 2, index: 0 });
  });

  it('a zero pitch never divides — the unmeasured first frame cannot move a card', () => {
    assert.deepEqual(drop({ dx: 500, dy: 500, columnPitch: 0, cardPitch: 0 }), {
      column: 1,
      index: 1,
    });
  });
});

describe('stepTarget', () => {
  it('walks columns left and right with clamps', () => {
    assert.equal(stepTarget({ column: 0, index: 0 }, 'left', 0, LENGTHS).column, 0);
    assert.equal(stepTarget({ column: 0, index: 0 }, 'right', 0, LENGTHS).column, 1);
    assert.equal(stepTarget({ column: 4, index: 0 }, 'right', 0, LENGTHS).column, 4);
  });

  it('crossing into a shorter column clamps the pending index instead of losing it', () => {
    const next = stepTarget({ column: 3, index: 4 }, 'left', 0, LENGTHS);
    assert.deepEqual(next, { column: 2, index: 0 });
  });

  it('walks positions up and down within the target bound', () => {
    assert.equal(stepTarget({ column: 1, index: 0 }, 'down', 1, LENGTHS).index, 1);
    assert.equal(stepTarget({ column: 1, index: 1 }, 'down', 1, LENGTHS).index, 1);
    assert.equal(stepTarget({ column: 1, index: 0 }, 'up', 1, LENGTHS).index, 0);
  });
});
