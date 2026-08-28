'use client';
// SummaryQueueScreen — doc 34 §5's Cool surface on the doc 28 DataTable: the
// draft-review queue (human sessions; the AI drafts, the human owns) plus the
// per-learner report trail practitioner research says drives renewals.
//
// NOT AN OPS/CRM SURFACE. It lives in `features/summary`, which
// `tooling/check-crm-wall.mjs` walls off from the CRM roots — a session report
// in a sales pipeline is doc 34 §1's flattery machine industrialised. The
// boundary here is the staff `write` capability inside the service.
//
// Suppression demands its reason inline, before the request leaves the screen:
// §3's "logged suppression, never silent deletion" starts at the form — there
// is no one-click takedown.
//
// Mobbin: https://mobbin.com/screens/e1a5b7cb-1f3b-4c3b-8930-feee1c348ec5 (Buffer —
//   review list: content text, status column, approve action on the row set) ·
//   https://mobbin.com/screens/cc23ae81-6fb9-4482-9273-74336475ef3e (Toggl Track —
//   pending-review queue as a plain table, reviewer action per row) ·
//   https://mobbin.com/screens/58f534f3-fba7-457e-8277-03fe67a1321a (Customer.io —
//   status-first delivery table, colored status trailing) ·
//   https://mobbin.com/screens/d88fb281-f99f-40b8-af4a-cade39b716c2 (Featurebase —
//   status filter above, status pill on the row). Structure only.
// SOT: docs/pack/34-session-summary-reports.md §5 · docs/pack/08-visual-hierarchy-spacing-spec.md §4.6 · docs/pack/23-crm-spec.md §2
// SOT-KEYWORDS: summary queue screen drafts approve suppress reason cool datatable trail viewed rate
import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Heading,
  Text,
  isCollapsed,
  useAdaptivePaneSelection,
  useWindowSizeClass,
} from '@acme/ui';
import { Pressable, TextInput, View } from '@acme/ui/primitives';
import type { SummaryQueueRow } from './summary.service.ts';
import { useSummaryQueue } from './use-reports.ts';

const STATUS_TONE = {
  generating: 'neutral',
  draft: 'attention',
  published: 'success',
  suppressed: 'neutral',
} as const;

export function SummaryQueueScreen() {
  const { rows, loading, error, act } = useSummaryQueue();
  /*
    Ephemeral form state for the one suppression in flight — which row, and the
    reason being typed. Screen-local by design: nothing outside this form ever
    reads it, and it must not survive navigation.
  */
  const [suppressing, setSuppressing] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  /*
    Pane-aware, route-safe (doc 37 §3.2/§3.3): inside an AdaptivePanes host at
    an expanded width, the headline SELECTS the draft into the detail pane
    beside this queue (the host's scoped store — selection survives the fold).
    On compact, and anywhere with no host (the ops web surface), the table is
    byte-for-byte today's behaviour: no press affordance, actions on the row.
  */
  const { selectedId, select } = useAdaptivePaneSelection();
  const sizeClass = useWindowSizeClass();
  const paneOpen = select !== null && !isCollapsed(sizeClass);

  const columns: ColumnDef<SummaryQueueRow>[] = [
    {
      id: 'createdAt',
      header: 'Created',
      accessorKey: 'createdAt',
      cell: ({ row }) => (
        <Text variant="data" className="font-mono text-text">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </Text>
      ),
      meta: { widthClass: 'w-28' },
    },
    {
      id: 'headline',
      header: 'Report',
      accessorKey: 'headline',
      // The headline is the press target for pane selection — a real control,
      // not a row-level hit area, so the Approve/Suppress buttons in the
      // trailing cell never fight it for the tap.
      cell: ({ row }) =>
        paneOpen ? (
          <Pressable
            onPress={() => {
              select(row.original.sessionId);
            }}
            aria-label={`Open draft: ${row.original.headline}`}
          >
            <Text variant="body" className="text-text underline" numberOfLines={2}>
              {row.original.headline}
            </Text>
          </Pressable>
        ) : (
          <Text variant="body" className="text-text" numberOfLines={2}>
            {row.original.headline}
          </Text>
        ),
    },
    {
      id: 'attempted',
      header: 'Attempted',
      accessorKey: 'attempted',
      meta: { numeric: true, widthClass: 'w-24' },
      cell: ({ row }) => (
        <Text variant="data" className="font-mono text-text">{row.original.attempted}</Text>
      ),
    },
    {
      id: 'independent',
      header: 'On own',
      accessorKey: 'solvedIndependently',
      meta: { numeric: true, widthClass: 'w-24' },
      cell: ({ row }) => (
        <Text variant="data" className="font-mono text-text">
          {row.original.solvedIndependently}
        </Text>
      ),
    },
    {
      id: 'viewed',
      header: 'Viewed',
      accessorKey: 'guardianViewedAt',
      meta: { widthClass: 'w-24' },
      // §5's honest metric, per row: viewed or not yet — never open counts.
      cell: ({ row }) => (
        <Text variant="data" className="font-mono text-text-muted">
          {row.original.guardianViewedAt !== null ? 'viewed' : '—'}
        </Text>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      meta: { widthClass: 'w-32' },
      cell: ({ row }) => (
        <Badge label={row.original.status} tone={STATUS_TONE[row.original.status]} />
      ),
    },
    {
      id: 'actions',
      header: '',
      meta: { widthClass: 'w-44' },
      cell: ({ row }) => (
        <View className="flex-row gap-element">
          {row.original.status === 'draft' ? (
            <Button
              title="Approve"
              size="sm"
              variant="primary"
              loading={act.isPending}
              onPress={() => {
                act.mutate({ action: 'approve', sessionId: row.original.sessionId });
              }}
            />
          ) : null}
          {row.original.status !== 'suppressed' ? (
            <Button
              title="Suppress"
              size="sm"
              variant="ghost"
              onPress={() => {
                setSuppressing(row.original.sessionId);
                setReason('');
              }}
            />
          ) : null}
        </View>
      ),
    },
  ];

  const table = useReactTable({
    data: rows as SummaryQueueRow[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.sessionId,
    // Controlled, display-only selection: the pane's selectedId drives the
    // DataTable's selected-row treatment (doc 08 §4.6 underlay + edge), so the
    // queue shows which draft the detail pane holds. Row ids are sessionIds.
    enableRowSelection: paneOpen,
    state: {
      rowSelection: paneOpen && selectedId !== null ? { [selectedId]: true } : {},
    },
  });

  return (
    <View className="mx-auto w-full max-w-5xl gap-section px-inset py-section">
      <View className="gap-element">
        <Heading level={1} size="display-sm" className="text-text">
          Session reports
        </Heading>
        <Text variant="body" tone="muted">
          Drafts wait for a human; the trail below them is what families were shown.
        </Text>
      </View>

      {suppressing !== null ? (
        <View className="gap-group rounded-card border-2 border-border bg-surface-raised p-inset">
          <Text variant="label" className="text-text-muted">
            Why is this report being pulled? The reason is kept with the record.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Generation error, safety miss…"
            className="min-h-row-cool rounded-input border-2 border-border bg-surface px-inset-tight text-body text-text"
            aria-label="Suppression reason"
          />
          <View className="flex-row gap-group">
            <Button
              title="Suppress report"
              size="sm"
              variant="danger"
              disabled={reason.trim() === ''}
              loading={act.isPending}
              onPress={() => {
                act.mutate(
                  { action: 'suppress', sessionId: suppressing, reason },
                  { onSuccess: () => { setSuppressing(null); } },
                );
              }}
            />
            <Button
              title="Cancel"
              size="sm"
              variant="ghost"
              onPress={() => { setSuppressing(null); }}
            />
          </View>
        </View>
      ) : null}

      <DataTable
        table={table}
        density="cool"
        status={error ? 'error' : loading ? 'pending' : 'success'}
        empty={
          <EmptyState
            icon={<Text className="text-title">✎</Text>}
            title="No reports yet"
            description="Reports appear here as sessions close."
          />
        }
        error={
          <Text variant="body" tone="muted">
            The queue could not load. Refresh the page; if it persists, check the API.
          </Text>
        }
      />
    </View>
  );
}
