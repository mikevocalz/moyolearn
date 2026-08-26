import type { Meta, StoryObj } from '@storybook/react-vite';
import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table';
import { DataTable, SuppressibleValue, type Suppressible } from './DataTable';
import { Badge } from './Badge';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Text, View } from './primitives';

type Lead = {
  id: string;
  family: string;
  stage: 'Trial scheduled' | 'Proposal' | 'Enrolled' | 'At risk';
  nextSession: string;
  sessions: number;
  value: string;
  attendance: Suppressible<string>;
};

const ROWS: Lead[] = [
  { id: '1', family: 'Rodriguez', stage: 'Enrolled', nextSession: '09:00–09:45', sessions: 24, value: '$1,080', attendance: { value: '96%' } },
  { id: '2', family: 'Okafor', stage: 'Trial scheduled', nextSession: '10:00–10:45', sessions: 1, value: '$45', attendance: { suppressed: true } },
  { id: '3', family: 'Raman', stage: 'Proposal', nextSession: '—', sessions: 0, value: '$0', attendance: { suppressed: true } },
  { id: '4', family: 'Bell', stage: 'At risk', nextSession: '14:30–15:15', sessions: 11, value: '$495', attendance: { value: '61%' } },
  { id: '5', family: 'Fischer', stage: 'Enrolled', nextSession: '16:00–16:45', sessions: 38, value: '$1,710', attendance: { value: '99%' } },
];

const STAGE_TONE = {
  'Trial scheduled': 'neutral',
  Proposal: 'primary',
  Enrolled: 'success',
  // At-risk is a RELATIONSHIP signal (doc 28 §6), not a failure and never a
  // learning signal — highlighter, not redpen.
  'At risk': 'attention',
} as const;

const COLUMNS: ColumnDef<Lead>[] = [
  { accessorKey: 'family', header: 'Family' },
  {
    accessorKey: 'stage',
    header: 'Stage',
    cell: ({ getValue }) => {
      const stage = getValue<Lead['stage']>();
      return <Badge label={stage} tone={STAGE_TONE[stage]} />;
    },
  },
  { accessorKey: 'nextSession', header: 'Next session', meta: { numeric: true } },
  { accessorKey: 'sessions', header: 'Sessions', meta: { numeric: true } },
  { accessorKey: 'value', header: 'Value', meta: { numeric: true } },
  {
    accessorKey: 'attendance',
    header: 'Attendance',
    enableSorting: false,
    meta: { numeric: true },
    cell: ({ getValue }) => <SuppressibleValue cell={getValue<Suppressible<string>>()} />,
  },
];

/** The stories build the headless instance the same way a real screen does —
 *  if this got a `data` prop instead, the story would stop proving anything. */
function Demo({ rows, selectedId }: { rows: Lead[]; selectedId?: string }) {
  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    state: selectedId ? { rowSelection: { [selectedId]: true } } : undefined,
    enableRowSelection: true,
  });

  return (
    <DataTable
      table={table}
      onRowPress={() => {}}
      empty={
        <EmptyState
          icon={<Text className="text-title">＋</Text>}
          title="No leads yet"
          description="Leads land here from the enquiry form and from CSV import."
          action={<Button title="Add your first lead" />}
        />
      }
      footer={
        <>
          <Text className="text-caption text-text-muted">
            {rows.length} leads · 2 attendance figures not shown (small group)
          </Text>
          <Text className="font-mono text-data text-text">$3,330</Text>
        </>
      }
    />
  );
}

const meta: Meta = { title: 'UI/DataTable' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <View className="dial-cool bg-surface p-inset">
      <Demo rows={ROWS} />
    </View>
  ),
};

/** Selection is a highlighter underlay plus a 3px ink left edge — the one place
 *  a border edge signals state, because its position separates it from the frame. */
export const RowSelected: Story = {
  render: () => (
    <View className="dial-cool bg-surface p-inset">
      <Demo rows={ROWS} selectedId="4" />
    </View>
  ),
};

/** Empty states get a verb, never "No data". */
export const Empty: Story = {
  render: () => (
    <View className="dial-cool bg-surface p-inset">
      <Demo rows={[]} />
    </View>
  ),
};
