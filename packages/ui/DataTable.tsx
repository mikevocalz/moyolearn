'use client';
// The Cool-dial data row (doc 08 §4.6) — 44px rows, `inset-tight` cells, numeric
// columns right-aligned in mono, selection as a highlighter underlay with a 3px
// ink left edge.
//
// Presentational ONLY. It takes a TanStack `Table` instance the caller built, so
// sorting, filtering, pagination and selection models stay headless and the
// fetching stays in Query. That split is the whole point: the moment this
// component fetches anything, two systems own the same rows.
//
// Deliberately NOT windowed. Doc 28 §6 draws the line at ~100 rows — below it,
// virtualization costs more than it saves — and every ops page is capped at
// 100 by the service (`listLeads` clamps `limit`), so this body never crosses
// the line. A surface that outgrows the cap windows through `VirtualList`
// (the kit's ONE virtualizer, @tanstack/react-virtual on web) rather than
// growing a second windowing implementation here.
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §4.6
// SOT-KEYWORDS: datatable table row cell cool ops sort selection suppression
// Mobbin: https://mobbin.com/screens/35f5c474-ed6a-4c77-a6cb-f2e1d6b12398 (Twenty —
//   hairline rows, no zebra, and a pinned aggregate footer under the body) ·
//   https://mobbin.com/screens/ec4931ac-c3ca-46cd-8d07-39ffd02e22a9 (Navattic —
//   rows-per-page left, range and prev/next right) ·
//   https://mobbin.com/screens/45d9181e-ad36-4146-91ea-93ce49aef464 (Pipedrive —
//   leading checkbox column, trailing per-row menu) ·
//   https://mobbin.com/screens/e58bb47e-2483-4cf3-9b36-657475bf7b83 (StackAI —
//   sort affordance lives in the header cell, not a separate control) ·
//   https://mobbin.com/screens/8a92c5c4-0cb9-42d2-ac3f-72ed3681489f (QuickBooks —
//   "All / Needs attention" segmented above the table, not a filter dropdown)
import type { ReactNode } from 'react';
import { tv } from './tv';
import { flexRender, type Row, type RowData, type Table } from '@tanstack/react-table';
import {
  Pressable,
  Table as TableEl,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  View,
} from './primitives';

/**
 * Column-level presentation, declared on the column rather than guessed from the
 * value: a postcode is a number and must stay left-aligned, a count is a number
 * and must not.
 */
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- both params are required by the interface being augmented.
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Right-aligned, mono, tabular figures — so the column reads as a column. */
    numeric?: boolean;
    /**
     * Reserve a fixed width for this column, e.g. `w-44`. Omit to share space.
     *
     * The cell slot is `flex-1`, which sets `flex-basis: 0%` — and a basis of 0
     * beats a `width`, so a width class on its own silently does nothing. The
     * table pairs this with `flex-none` for you rather than making every caller
     * remember, which is what the first attempt at a fixed Stage column got
     * wrong: the class was there, the column stayed 114px, and the badge printed
     * over the next column.
     */
    widthClass?: string;
  }
}

/**
 * A value that k-anonymity suppression may have removed (doc 27 §4). Rendering a
 * suppressed aggregate as blank or zero is the failure mode this type exists to
 * make unrepresentable: a zero where a small group was hidden is a lie with an
 * equity consequence, and a school board cannot tell the two apart.
 */
export type Suppressible<T> = { value: T } | { suppressed: true };

/*
  A reserved column width has to switch the cell OUT of `flex-1` to take effect —
  `flex-1` means `flex: 1 1 0%`, and a zero basis wins over any `width`. Kept
  here rather than at the call site so a column only has to say how wide it is.
*/
const fixedWidth = (widthClass?: string) => (widthClass ? `flex-none ${widthClass}` : '');

/**
 * Row density — the two heights the dial already defines, not a new scale.
 * `cool` (44px) is the ops default; `roomy` borrows the hot row (64px) for
 * readers who want air. A caller persists the choice (doc 28 §2: density is a
 * durable view preference and lives in Zustand); this component only draws it.
 */
export type DataTableDensity = 'cool' | 'roomy';

const DENSITY_ROW: Record<DataTableDensity, string> = {
  cool: 'min-h-row-cool',
  roomy: 'min-h-row-hot',
};

export const isSuppressed = <T,>(cell: Suppressible<T>): cell is { suppressed: true } =>
  'suppressed' in cell;

const dataTable = tv({
  slots: {
    root: 'w-full overflow-hidden rounded-card border-2 border-border bg-surface-raised',
    /*
      In card mode the CARDS are the surface, so the table's own frame is dropped
      below md — otherwise every row sits in a bordered box inside a bordered
      box, which in a language where everything has a border reads as an error
      rather than as nesting (doc 08 §2.2).
    */
    rootCards: 'max-md:overflow-visible max-md:rounded-none max-md:border-0 max-md:bg-transparent',
    headRow: 'flex-row border-b-2 border-border-strong bg-surface-sunken',
    /*
      Headers are `label` in graphite, not mono uppercase. Mono is reserved for
      cell VALUES — times, counts, prices — so the eye learns that a monospaced
      run of characters is always data and never chrome.
    */
    headCell: 'flex-1 flex-row items-center gap-element p-inset-tight',
    headLabel: 'text-label font-semibold text-text-muted',
    /*
      `border-l-transparent` on every row, not just the selected one: the 3px
      edge has to occupy its space always, or selecting a row shifts every cell
      in it three pixels to the right.
    */
    /*
      `[&:has(details[open])]:z-50` — the row lifts itself while a menu inside it
      is open.

      Every row and cell computes `position: relative; z-index: 0` from React
      Native Web's base View style, and `z-index: 0` CREATES A STACKING CONTEXT.
      So a popover inside a cell could ask for `z-50` and still be painted over
      by the next row: its z-index only ever competed inside its own cell, while
      the rows themselves were all tied at 0 and settled by DOM order. The stage
      menu rendered under the four rows beneath it and read as transparent.

      The lift therefore has to happen on the element that is a sibling of the
      other rows, and `:has()` lets CSS do it with no state and no JS.
    */
    row: 'flex-row items-center border-b border-border-faint border-l-3 border-l-transparent [&:has(details[open])]:z-50',
    rowInteractive: 'transition-colors duration-fast hover:bg-surface-sunken motion-reduce:transition-none',
    rowSelected: 'border-l-border-strong bg-highlighter-underlay',
    cell: 'flex-1 justify-center p-inset-tight',
    cellText: 'text-body text-text',
    cellNumeric: 'text-right font-mono text-data text-text',
    suppressed: 'text-right font-mono text-data text-text-muted',
    state: 'items-center justify-center gap-stack p-section',
  },
});

export interface DataTableProps<T> {
  /** A headless instance the caller owns — see the hook that builds it. */
  table: Table<T>;
  /** Column count for the state rows to span; derived if omitted. */
  status?: 'pending' | 'error' | 'success';
  /** Shown when a successful query returns nothing. Give it a verb. */
  empty?: ReactNode;
  /** Shown when the query failed. Must say what to do next. */
  error?: ReactNode;
  /** Row press. Selection is handled by the table's own selection model. */
  onRowPress?: (row: Row<T>) => void;
  /**
   * Row renderer for narrow viewports. A seven-column grid cannot shrink — it
   * can only scroll sideways, which is how a phone user misses the column that
   * mattered. Supply this and the table swaps to a card list below `md`.
   *
   * The card MUST label its own figures: without the header row a bare "11" or
   * "$495" has nothing to attach to.
   */
  renderCard?: (row: Row<T>) => ReactNode;
  /** A pinned summary strip under the body — counts, totals, suppression notes. */
  footer?: ReactNode;
  /** Row height. A durable preference the caller owns — see `DataTableDensity`. */
  density?: DataTableDensity;
  className?: string;
}

/** `aria-sort` takes the sort DIRECTION, and `none` when the column is sortable
 *  but unsorted — omitting it entirely tells a screen reader the column cannot
 *  be sorted at all. */
const ariaSort = (dir: false | 'asc' | 'desc') =>
  dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none';

export function DataTable<T>({
  table,
  status = 'success',
  empty,
  error,
  onRowPress,
  renderCard,
  footer,
  density = 'cool',
  className,
}: DataTableProps<T>) {
  const s = dataTable();
  const rows = table.getRowModel().rows;
  const canSelect = table.options.enableRowSelection !== false;

  return (
    <View className={s.root({ className: `${renderCard ? s.rootCards() : ''} ${className ?? ''}` })}>
      {/*
        Both layouts render and CSS picks one. A JS breakpoint would need the
        window width during SSR, which it does not have — the server would guess
        and hydration would mismatch on every phone.
      */}
      <TableEl className={`w-full flex-col ${renderCard ? 'hidden md:flex' : ''}`}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className={s.headRow()}>
              {group.headers.map((header) => {
                const column = header.column;
                const sorted = column.getIsSorted();
                const sortable = column.getCanSort();
                const numeric = column.columnDef.meta?.numeric ?? false;
                const label = header.isPlaceholder
                  ? null
                  : flexRender(column.columnDef.header, header.getContext());

                return (
                  <TableHeaderCell
                    key={header.id}
                    aria-sort={sortable ? ariaSort(sorted) : undefined}
                    className={s.headCell({
                      className: `${numeric ? 'justify-end' : ''} ${fixedWidth(column.columnDef.meta?.widthClass)}`,
                    })}
                  >
                    {sortable ? (
                      /*
                        The whole header cell is the target, and it is a real
                        button, so the column is reachable and operable from the
                        keyboard with the ink focus ring the rest of the kit uses.
                      */
                      <Pressable
                        onPress={() => column.toggleSorting()}
                        aria-label={`Sort by ${column.id}`}
                        /* The header must carry the column's alignment too —
                           a right-aligned number column under a left-aligned
                           label is the tell that the two were styled apart. */
                        className={`min-h-target-adult flex-1 flex-row items-center gap-element rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${numeric ? 'justify-end' : ''}`}
                      >
                        <Text className={s.headLabel()}>{label}</Text>
                        {/* Only the ACTIVE direction shows a glyph. A permanent
                            ↕ on every column is noise on a wide table, and the
                            aria-sort above already tells assistive tech the
                            column is sortable. */}
                        {sorted ? (
                          <Text aria-hidden className="text-caption text-text">
                            {sorted === 'asc' ? '↑' : '↓'}
                          </Text>
                        ) : null}
                      </Pressable>
                    ) : (
                      <Text className={s.headLabel()}>{label}</Text>
                    )}
                  </TableHeaderCell>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {status === 'success'
            ? rows.map((row) => {
                const selected = canSelect && row.getIsSelected();
                const interactive = Boolean(onRowPress);
                return (
                  <TableRow
                    key={row.id}
                    aria-selected={canSelect ? selected : undefined}
                    className={s.row({
                      className: `${DENSITY_ROW[density]} ${interactive ? s.rowInteractive() : ''} ${selected ? s.rowSelected() : ''}`,
                    })}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const numeric = cell.column.columnDef.meta?.numeric ?? false;
                      return (
                        <TableCell
                          key={cell.id}
                          className={s.cell({
                            className: fixedWidth(cell.column.columnDef.meta?.widthClass),
                          })}
                        >
                          <Text className={numeric ? s.cellNumeric() : s.cellText()}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </Text>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            : null}
        </TableBody>
      </TableEl>

      {renderCard && status === 'success' && rows.length > 0 ? (
        <View className="gap-stack md:hidden">
          {rows.map((row) => (
            <View key={row.id}>{renderCard(row)}</View>
          ))}
        </View>
      ) : null}

      {/*
        The pending / error / empty blocks live OUTSIDE the table, not inside
        <tbody>. A <div> is not a legal child of <tbody>, and React repaired the
        nesting on the client but not on the server — so every load of this
        screen threw a hydration mismatch and re-rendered the whole tree. The
        header stays above them, which is what keeps the column context while a
        state is showing.
      */}
      {status === 'pending' ? (
        <View className={s.state()}>
          <Text className="text-body text-text-muted">Loading…</Text>
        </View>
      ) : null}
      {status === 'error' ? <View className={s.state()}>{error}</View> : null}
      {status === 'success' && rows.length === 0 ? (
        <View className={s.state()}>{empty}</View>
      ) : null}

      {footer ? (
        <View className="flex-row items-center justify-between gap-group border-t-2 border-border-strong bg-surface-sunken p-inset-tight max-md:mt-stack max-md:rounded-card max-md:border-2 max-md:border-border">
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The only correct way to render a value that suppression may have removed.
 * "Not shown" is a state a reader can act on; blank is a rendering bug and zero
 * is wrong.
 */
export function SuppressibleValue<T>({
  cell,
  format,
}: {
  cell: Suppressible<T>;
  format?: (value: T) => string;
}) {
  if (isSuppressed(cell)) {
    return (
      <Text className="font-mono text-data text-text-muted" aria-label="Not shown — small group">
        Not shown
      </Text>
    );
  }
  return <>{format ? format(cell.value) : String(cell.value)}</>;
}

export type { ColumnDef, Row, Table } from '@tanstack/react-table';
