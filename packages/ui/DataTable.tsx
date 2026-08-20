'use client';
import { tv } from 'tailwind-variants';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { useInstanceStore, useStore } from './use-instance-store';
import {
  Table, TableHeader, TableBody, TableRow, TableCell, TableHeaderCell,
} from './primitives';
import { View, Text, Pressable } from './tw';

const dataTable = tv({
  slots: {
    root: 'w-full overflow-hidden rounded-card border-2 border-border bg-surface-raised shadow-card',
    headRow: 'flex-row border-b-2 border-border-strong bg-surface-sunken',
    headCell: 'flex-1 p-3 text-left text-sm font-semibold text-text',
    headButton: 'flex-row items-center gap-1.5',
    sortGlyph: 'text-xs text-text-muted',
    row: 'flex-row border-b-2 border-border transition-colors duration-fast hover:bg-surface-sunken motion-reduce:transition-none',
    cell: 'flex-1 justify-center p-3 text-sm text-text',
  },
});

export type { ColumnDef };

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Enable click-to-sort headers. */
  sortable?: boolean;
  className?: string;
}

// Headless @tanstack/react-table rendered through the semantic table
// primitives (real <table> on web, role-mapped views on native).
// Sorting state lives in a per-instance zustand store (repo rule).
export function DataTable<T>({ data, columns, sortable = true, className }: DataTableProps<T>) {
  const store = useInstanceStore<{ sorting: SortingState }>(() => ({ sorting: [] }));
  const sorting = useStore(store, (s) => s.sorting);
  const onSortingChange = (updater: Updater<SortingState>) =>
    store.setState((s) => ({
      sorting: typeof updater === 'function' ? updater(s.sorting) : updater,
    }));

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting: sortable,
  });

  const s = dataTable();
  return (
    <View className={s.root({ className })}>
      <Table className="w-full flex-col">
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className={s.headRow()}>
              {hg.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const label = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <TableHeaderCell key={header.id} className={s.headCell()}>
                    {sortable && header.column.getCanSort() ? (
                      <Pressable
                        onPress={() => header.column.toggleSorting()}
                        aria-label={`Sort by ${header.column.id}`}
                        className={s.headButton()}
                      >
                        <Text className="text-sm font-semibold">{label}</Text>
                        <Text className={s.sortGlyph()}>
                          {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}
                        </Text>
                      </Pressable>
                    ) : (
                      label
                    )}
                  </TableHeaderCell>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className={s.row()}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className={s.cell()}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </View>
  );
}
