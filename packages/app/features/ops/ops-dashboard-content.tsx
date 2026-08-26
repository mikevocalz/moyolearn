'use client';
// The ops dashboard — Cool dial, doc 02 archetype D (Feed) at ops density.
//
// This is a FIRST-PARTY surface, deliberately not the Payload admin. Payload's
// panel is a CMS shell: its templates, list views and login are fixed, so
// theming it yields "Payload in Moyo colours" and never a product screen. The
// CMS stays for content editors; the business runs here.
// SOT: docs/pack/28-crm-spec.md · docs/pack/08-visual-hierarchy-spacing-spec.md §5
// SOT-KEYWORDS: ops dashboard crm leads today sessions pipeline hero attention
// Mobbin: https://mobbin.com/screens/7edb1dcf-9015-471a-8625-11a0f51767d7 (Uxcel —
//   page header with a greeting line above the controls, not beside them) ·
//   https://mobbin.com/screens/f703018d-c080-4aca-acdc-b555ed2e5f97 (Hootsuite —
//   one dominant panel, supporting stats demoted underneath it) ·
//   https://mobbin.com/screens/8a92c5c4-0cb9-42d2-ac3f-72ed3681489f (QuickBooks —
//   "All / Needs attention" segmented above the table) ·
//   https://mobbin.com/screens/35f5c474-ed6a-4c77-a6cb-f2e1d6b12398 (Twenty —
//   removable filter chips on their own row under the section header) ·
//   https://mobbin.com/screens/ec4931ac-c3ca-46cd-8d07-39ffd02e22a9 (Navattic —
//   rows-per-page left, range and prev/next right) ·
//   https://mobbin.com/screens/5ee90a6f-5d97-495c-ad2a-d3dd74ab8b7d (Rocket Money
//   — phone card: identity left, headline figure right, labelled facts beneath) ·
//   https://mobbin.com/screens/3420554f-b00c-433b-a634-d7f847c8c870 (Airwallex —
//   status badge sits on the identity's baseline, not below it) ·
//   https://mobbin.com/screens/32bb3267-0b4e-48d0-967c-a3096df9747d (GitHub —
//   every value on a card carries its own label once the header row is gone) ·
//   https://mobbin.com/screens/fc08be2d-1e4a-41ca-a37d-0011c99345b8 (folk) ·
//   https://mobbin.com/screens/d085bc38-7a20-4dfd-b3e1-0e853c8fbe75 (Coda) ·
//   https://mobbin.com/screens/4370b80b-b6e5-4404-8343-72a57659a9a9 (Juicebox —
//   all three: the status BADGE is the control, opening its options in place,
//   with a chevron on the badge to say so. No separate row-action menu.)
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import {
  Badge,
  Button,
  Menu,
  DataTable,
  EmptyState,
  ScheduleCard,
  StatCard,
  SuppressibleValue,
  TrendLine,
  useInstanceStore,
  useStore,
  type Suppressible,
} from '@acme/ui';
import { Text, View } from '@acme/ui/primitives';
import { MIN_COHORT, REVENUE_BY_MONTH, STAGE_TONE, TODAY_SESSIONS, type Lead } from './ops.data';
import { useLeads } from './use-leads';
import { useViewParams } from './use-view-params';
import type { LeadSortField } from './ops.service';
import { MANUAL_STAGES } from './stage-change';
import { useStageAction } from './use-stage-action';

/*
  The page gutter. `p-inset` (16 at Cool) is a CARD inset — using it as the page
  gutter on a 1300px canvas was what made the dashboard read as cramped and
  unfinished, with content jammed against the sidebar rule. Regions are separated
  by `gap-section` (32) against `gap-stack` (12) inside them: the ≥2× jump is the
  grouping signal (doc 08 §2.3), and it is the only one, because everything here
  already has a border.
*/
const GUTTER = 'px-inset-roomy py-inset-roomy lg:px-section lg:py-section';

/**
 * Built per render rather than module-scope, so the Stage cell can reach the
 * write action directly. The alternative — a context or `table.options.meta` —
 * hides the dependency from anyone reading the column definition.
 */
const buildColumns = (
  moveStage: (change: { leadId: string; to: Lead['stage'] }) => void,
  pending: boolean,
): ColumnDef<Lead>[] => [
  {
    accessorKey: 'family',
    header: 'Family',
    // The identity column carries two facts, so it is the one cell allowed to
    // stack: the family is what you scan, the learner is what disambiguates.
    cell: ({ row }) => (
      <View className="gap-0">
        <Text className="text-body font-semibold text-text">{row.original.family}</Text>
        <Text className="text-caption text-text-muted">
          {row.original.learner} · {row.original.subject}
        </Text>
      </View>
    ),
  },
  {
    accessorKey: 'stage',
    header: 'Stage',
    /*
      The badge IS the control (folk / Coda / Juicebox all do this). A separate
      row-action menu would put the most common edit in this table two clicks
      away behind a "…" that says nothing about what it opens.
    */
    cell: ({ row }) => (
      <Menu
        title="Move to"
        actions={MANUAL_STAGES.map((stage) => ({
          id: stage,
          title: stage,
          // The current stage stays listed but inert: removing it would shuffle
          // the list under the cursor every time the value changed.
          disabled: pending || stage === row.original.stage,
        }))}
        onAction={(id) => moveStage({ leadId: row.original.id, to: id as Lead['stage'] })}
      >
        <View className="min-h-target-adult flex-row items-center gap-element">
          <Badge label={row.original.stage} tone={STAGE_TONE[row.original.stage]} />
          <Text aria-hidden className="text-caption text-text-muted">
            ▾
          </Text>
        </View>
      </Menu>
    ),
  },
  { accessorKey: 'owner', header: 'Owner' },
  { accessorKey: 'nextSession', header: 'Next', meta: { numeric: true } },
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

/**
 * One lead as a card, for phones. Every figure carries its own label, because
 * the column header that explained it is gone — an unlabelled "11" next to
 * "$495" is two numbers with no meaning.
 */
function LeadCard({ lead }: { lead: Lead }) {
  const facts: [string, React.ReactNode][] = [
    ['Next', lead.nextSession],
    ['Sessions', String(lead.sessions)],
    ['Value', lead.value],
    ['Attendance', <SuppressibleValue key="att" cell={lead.attendance} />],
  ];
  return (
    <View className="gap-stack rounded-card border-2 border-border bg-surface-raised p-inset shadow-card">
      <View className="flex-row items-start justify-between gap-element">
        <View className="min-w-0 flex-1 gap-0">
          <Text className="text-body font-semibold text-text">{lead.family}</Text>
          <Text className="text-caption text-text-muted">
            {lead.learner} · {lead.subject}
          </Text>
        </View>
        <Badge label={lead.stage} tone={STAGE_TONE[lead.stage]} />
      </View>
      <View className="flex-row flex-wrap gap-group">
        {facts.map(([label, value]) => (
          <View key={label} className="gap-0">
            <Text className="text-caption text-text-muted">{label}</Text>
            <Text className="font-mono text-data text-text">{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A removable filter, the shape Twenty and Navattic both use. */
function FilterChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <View className="min-h-target-adult flex-row items-center gap-element self-start rounded-control border-2 border-border bg-surface-raised px-inset-tight">
      <Text className="text-caption text-text">{label}</Text>
      {onRemove ? (
        <Text aria-hidden className="text-caption text-text-muted">
          ×
        </Text>
      ) : null}
    </View>
  );
}

/** A section rule that is a LABEL, not a divider — doc 08 §2.3 bans the divider. */
function SectionHeader({
  title,
  count,
  accent,
  action,
}: {
  title: string;
  count?: string;
  /** The screen's single highlighter moment, reserved for Action-Needed (§5). */
  accent?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-stack">
      <View className="flex-row items-center gap-element">
        <Text className="text-title text-text">{title}</Text>
        {count ? (
          <View
            /* rounded-control, never a pill — the kit has no circular chrome,
               and Avatar/Badge/nav counts all already follow that. */
            className={`rounded-control border-2 border-border px-element py-0.5 ${accent ? 'bg-highlighter' : 'bg-surface-sunken'}`}
          >
            <Text
              className={`font-mono text-caption font-semibold ${accent ? 'text-on-highlighter' : 'text-text-muted'}`}
            >
              {count}
            </Text>
          </View>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export interface OpsDashboardContentProps {
  /** "Tuesday, 26 August" — computed by the caller so this stays pure. */
  today: string;
  operatorName: string;
}

export function OpsDashboardContent({ today, operatorName }: OpsDashboardContentProps) {
  /*
    Reads and writes use different systems (the brief's fourth trap). This is the
    READ model only: Query owns the rows, the URL owns the shareable view, and
    the table below is handed both — it never fetches and never stores.
  */
  const { view, setView } = useViewParams();
  const { rows: serverRows, page, status, queryKey } = useLeads({ ...view, limit: 25 });

  /*
    The write path. `rows` from here — not from the query — because the
    optimistic layer is seeded FROM the server rows and collapses back onto them
    when the invalidated query settles. Feeding the table the raw query rows
    would show the edit only after the round trip.
  */
  const { rows, moveStage, pending, error: writeError } = useStageAction(serverRows, queryKey);

  /*
    `manualSorting` + `manualPagination`: the server already sorted and paged, so
    letting the table re-sort would reorder ONE page and present it as the whole
    ordering. Never pull a CRM table client-side to sort it.
  */
  const sorting: SortingState = view.sortField
    ? [{ id: view.sortField, desc: view.sortDesc }]
    : [];

  const table = useReactTable({
    data: rows,
    columns: buildColumns(moveStage, pending),
    // Stable identity, or selection re-binds to whatever now sits at that index
    // after a refetch — and someone acts on the wrong family.
    getRowId: (row) => row.id,
    state: { sorting },
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    onSortingChange: (updater: Updater<SortingState>) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      setView({
        sortField: first ? (first.id as LeadSortField) : undefined,
        sortDesc: first?.desc ?? false,
      });
    },
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  });

  const total = page?.total ?? 0;
  const totalUnfiltered = page?.totalUnfiltered ?? 0;

  return (
    <View className={`gap-section ${GUTTER}`}>
      {/*
        PAGE HEADER. The old screen opened on a bare 20px "Today" and three
        identical cards, which is why it read as boring: nothing on the page was
        allowed to be big, so nothing was first. The greeting is this screen's
        one display moment, the eyebrow dates it, and the line underneath says
        what to do — three type tiers before any data appears.
      */}
      <View className="gap-stack">
        <Text className="font-mono text-caption uppercase tracking-wide text-text-muted">
          {today}
        </Text>
        <View className="flex-row flex-wrap items-end justify-between gap-stack">
          <Text className="font-display text-display-sm text-text">
            Good morning, {operatorName}
          </Text>
          <View className="flex-row items-center gap-element">
            <Button title="Add lead" size="sm" />
            <Button title="Import" variant="outline" size="sm" />
          </View>
        </View>
        <Text className="text-body-lg text-text-muted">
          {total} families need a decision today, and {TODAY_SESSIONS.length} sessions run
          before 5pm.
        </Text>
      </View>

      {/*
        HERO. Two-thirds / one-third, NOT a row of equal cards — a strip of
        identical tiles is what "no hierarchy" looks like, and the schedule is
        the thing an ops lead actually opens this screen for at 9am. The numbers
        support it from the side rather than competing across the top.
      */}
      <View className="flex-col gap-stack xl:flex-row xl:items-start">
        <View className="min-w-0 flex-1 gap-stack xl:flex-[2]">
          <SectionHeader title="Today's sessions" count={String(TODAY_SESSIONS.length)} />
          <View className="gap-stack">
            {TODAY_SESSIONS.map((session) => (
              <ScheduleCard
                key={session.id}
                time={session.time}
                title={session.learner}
                meta={[`${session.subject} · ${session.tutor}`]}
                mode={session.mode}
                status={session.needsAttention ? 'attention' : 'default'}
                /*
                  `secondaryAction`, so the card's button renders outline. A
                  primary here would put three yellow buttons down the hero and
                  spend the screen's single accent (§3.2) three times over —
                  the accent belongs to the one thing that needs a decision.
                */
                secondaryAction={{ label: 'Open session', onPress: () => {} }}
              />
            ))}
          </View>
        </View>

        <View className="gap-stack xl:flex-1">
          <SectionHeader title="This month" />
          {/*
            The chart panel carries the headline number in its own header, so the
            plot needs no value labels — Whop's arrangement. It sits with the
            stats rather than beside the schedule because revenue is context for
            the month, not a thing to act on before 5pm.
          */}
          <View className="gap-stack rounded-card border-2 border-border bg-surface-raised p-inset shadow-card">
            <TrendLine
              data={REVENUE_BY_MONTH}
              title="Invoiced · 7 months"
              height={120}
              // 'en-US' pinned, not the ambient locale: the server and the browser can
              // resolve a bare toLocaleString() differently, and a number that
              // formats one way in the HTML and another after hydration is a
              // mismatch React cannot patch.
              format={(v) => `$${v.toLocaleString('en-US')}`}
            />
          </View>
          <StatCard size="lg" value="38" label="Sessions delivered" />
          <StatCard size="lg" value="61%" label="Trial conversion" trend="−4 pts vs July" trendDirection="down" />
        </View>
      </View>

      {/* PIPELINE. The table is the mass of the page, so it gets the last and
          largest region and nothing sits beside it competing for width. */}
      <View className="gap-stack">
        <SectionHeader
          title="Pipeline"
          count={`${total} need attention`}
          accent={view.onlyAttention}
          action={
            <Button
              title={view.onlyAttention ? 'Show all' : 'Needs attention'}
              variant="outline"
              size="sm"
              onPress={() => setView({ onlyAttention: !view.onlyAttention })}
            />
          }
        />

        {/*
          A write failure is stated where the write happened, not in a toast that
          has already gone by the time the user looks up.
        */}
        {writeError ? (
          <View className="flex-row items-center gap-element rounded-control border-2 border-redpen px-inset-tight py-element">
            <Text className="text-body text-redpen">{writeError}</Text>
          </View>
        ) : null}

        <View className="flex-row flex-wrap items-center gap-element">
          {view.onlyAttention ? (
            <FilterChip label="Needs attention" onRemove={() => setView({ onlyAttention: false })} />
          ) : null}
          {view.stage ? (
            <FilterChip label={`Stage: ${view.stage}`} onRemove={() => setView({ stage: undefined })} />
          ) : null}
          {view.q ? (
            <FilterChip label={`Search: ${view.q}`} onRemove={() => setView({ q: '' })} />
          ) : null}
          {!view.onlyAttention && !view.stage && !view.q ? (
            <Text className="text-caption text-text-muted">No filters — showing every family.</Text>
          ) : null}
        </View>

        <DataTable
          table={table}
          status={status}
          onRowPress={() => {}}
          renderCard={(row) => <LeadCard lead={row.original} />}
          empty={
            <EmptyState
              icon={<Text className="text-title">＋</Text>}
              title="Nothing needs attention"
              description="Every family in the pipeline has a next step booked."
              action={
                <Button
                  title="Show all leads"
                  variant="outline"
                  onPress={() => setView({ onlyAttention: false })}
                />
              }
            />
          }
          error={
            <EmptyState
              icon={<Text className="text-title">!</Text>}
              title="Could not load the pipeline"
              description="The list is stale, not gone. Try again in a moment."
              action={<Button title="Try again" variant="outline" onPress={() => setView({})} />}
            />
          }
          footer={
            /*
              Navattic's arrangement: range and totals on the left, the pager on
              the right. Cursor pagination is forward-only by nature, so there is
              no "page 4 of 9" to offer — "First" is the honest way back, and
              pretending to random-access pages you have not fetched is how an
              offset bug gets reintroduced.
            */
            <>
              <Text className="text-caption text-text-muted">
                {/*
                  The threshold is INTERPOLATED, not typed. This line read
                  "under 5" while the rule was 10, so the interface was
                  publishing a privacy promise the code did not keep — and the
                  number a reader trusts is the one on screen.
                */}
                {rows.length} of {total} shown · {totalUnfiltered} families total · attendance
                hidden for groups under {MIN_COHORT}
              </Text>
              <View className="flex-row items-center gap-element">
                <Button
                  title="First"
                  variant="outline"
                  size="sm"
                  disabled={!view.cursor}
                  onPress={() => setView({ cursor: undefined })}
                />
                <Button
                  title="Next"
                  variant="outline"
                  size="sm"
                  disabled={!page?.nextCursor}
                  onPress={() => setView({ cursor: page?.nextCursor })}
                />
              </View>
            </>
          }
        />
      </View>
    </View>
  );
}
