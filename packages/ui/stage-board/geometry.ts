/**
 * StageBoard drop maths — pure, so the drag can be tested without a gesture
 * (the swipe-actions precedent in adaptive-panes).
 *
 * ReorderRow's `Math.round(offset / rowHeight)` generalized to two axes: the
 * release offset resolves to a column step and an index step in one call, and
 * the caller commits ONCE. Nothing here runs per frame — both forks pass the
 * final translation on release, so these stay plain JS-thread functions and
 * need no 'worklet' directive.
 *
 * SOT: docs/design/overhaul-v2/J-component-plan.md §4 · packages/app/features/editor/reorder-row.native.tsx
 * SOT-KEYWORDS: stage board geometry drop resolve kanban drag column index step
 */

export interface DropTarget {
  /** Column index into the board's `columns` array. */
  column: number;
  /** Final position within that column (see maxIndexFor for the bound). */
  index: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Highest legal index in a column: moving WITHIN the source column re-orders
 * (0..len−1), moving ACROSS inserts (0..len — one past the last card, so a
 * card can land at the end of another column, including an empty one).
 */
export function maxIndexFor(
  column: number,
  fromColumn: number,
  columnLengths: readonly number[],
): number {
  const length = columnLengths[column] ?? 0;
  return column === fromColumn ? Math.max(0, length - 1) : length;
}

export interface ResolveDropArgs {
  fromColumn: number;
  fromIndex: number;
  /** Total drag translation on release, px. */
  dx: number;
  dy: number;
  /**
   * Horizontal distance of one column step: the page width on mobile (one
   * column per page), the measured column pitch on web. `Math.round` makes
   * half a pitch the commit threshold — less travel snaps home, exactly as a
   * half-row does in ReorderRow.
   */
  columnPitch: number;
  /** Vertical distance of one index step — the fixed card pitch. */
  cardPitch: number;
  columnLengths: readonly number[];
}

export function resolveDrop({
  fromColumn,
  fromIndex,
  dx,
  dy,
  columnPitch,
  cardPitch,
  columnLengths,
}: ResolveDropArgs): DropTarget {
  const columnSteps = columnPitch > 0 ? Math.round(dx / columnPitch) : 0;
  const column = clamp(fromColumn + columnSteps, 0, Math.max(0, columnLengths.length - 1));
  const indexSteps = cardPitch > 0 ? Math.round(dy / cardPitch) : 0;
  const index = clamp(fromIndex + indexSteps, 0, maxIndexFor(column, fromColumn, columnLengths));
  return { column, index };
}

export type StepDirection = 'up' | 'down' | 'left' | 'right';

/**
 * One keyboard step of a grabbed card (web fork's Enter/arrows move). Crossing
 * into a shorter column clamps the pending index rather than losing it, so
 * arrowing left and back right returns the card to where it was.
 */
export function stepTarget(
  target: DropTarget,
  direction: StepDirection,
  fromColumn: number,
  columnLengths: readonly number[],
): DropTarget {
  if (direction === 'left' || direction === 'right') {
    const column = clamp(
      target.column + (direction === 'right' ? 1 : -1),
      0,
      Math.max(0, columnLengths.length - 1),
    );
    return {
      column,
      index: clamp(target.index, 0, maxIndexFor(column, fromColumn, columnLengths)),
    };
  }
  return {
    column: target.column,
    index: clamp(
      target.index + (direction === 'down' ? 1 : -1),
      0,
      maxIndexFor(target.column, fromColumn, columnLengths),
    ),
  };
}
