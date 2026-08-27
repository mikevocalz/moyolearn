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
//   with a chevron on the badge to say so. No separate row-action menu.) ·
//   https://mobbin.com/screens/eeea2d53-b9d5-4955-bd28-d6d14b3ad4a0 (Supabase —
//   search field and columns dropdown share the toolbar row above the table) ·
//   https://mobbin.com/screens/8215ed92-68d7-42fb-836b-36b3b7b4e16d (Obvious —
//   row density lives inside the Display dropdown, not as its own control) ·
//   https://mobbin.com/screens/4896dd71-fc2f-4222-b22b-2bab9b3ec225 (Twenty —
//   Options→Fields lists toggleable columns with the identity field pinned)
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type SortingState,
  type Updater,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Badge,
  Button,
  Menu,
  DataTable,
  EmptyState,
  ScheduleCard,
  SearchBar,
  StatCard,
  SuppressibleValue,
  TrendLine,
  useInstanceStore,
  useStore,
  type Suppressible,
} from '@acme/ui';
import { Text, View } from '@acme/ui/primitives';
import { EXAMPLE_LEADS, MIN_COHORT, STAGE_TONE, type Lead, type Session } from './ops.data';
import type { TrendPoint } from '@acme/ui';
import { useLeads } from './use-leads';
import { useViewParams } from './use-view-params';
import type { LeadSortField } from './ops.service';
import { MANUAL_STAGES } from './stage-change';
import { useStageAction } from './use-stage-action';
import { HIDEABLE_COLUMNS, columnVisibilityFor } from './ops.prefs';
import { useOpsTablePrefs } from './ops.prefs.store';

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
    // Never hideable: the family is what a row IS. Twenty pins its Name field
    // for the same reason — a table of values with no identities is unreadable.
    enableHiding: false,
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
    // Never hideable: the badge is the write control, and hiding the one way to
    // act on a row leaves a pipeline you can read but not run.
    enableHiding: false,
    /*
      A RESERVED width, because this column's content is a badge whose width
      follows its label. Sharing space with `flex-1` sizes every column to the
      same fraction, so "Trial scheduled" and "Trial completed" — the two longest
      stages — spilled out of the cell and printed over the owner's name. The
      column is sized for the longest value it can ever hold; the stage list is a
      closed enum, so that width is knowable rather than guessed.
    */
    meta: { widthClass: 'w-48' },
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
          {/* `shrink-0`: the badge is the thing being read, so it keeps its size
              and the cell gives way — not the other way round. */}
          <View className="shrink-0">
            <Badge label={row.original.stage} tone={STAGE_TONE[row.original.stage]} />
          </View>
          <Text aria-hidden className="shrink-0 text-caption text-text-muted">
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

/**
 * The empty-ORG state, not the empty-FILTER state (doc 37 §2): before the
 * first real lead exists, the table's slot shows what rows will look like —
 * three example families, each labelled, none of them data. As cards rather
 * than table rows so the "Example" chip can sit ON the row it describes and
 * the stage badge stays a picture, not a live control that would "move" a
 * family that does not exist.
 */
function ExampleLeads() {
  return (
    <View className="gap-stack p-inset">
      <Text className="text-body text-text">
        No families yet — here&apos;s what your pipeline will look like. Add a lead or import your
        roster and these examples disappear.
      </Text>
      {EXAMPLE_LEADS.map((lead) => (
        <View key={lead.id} className="gap-element">
          <View className="self-start">
            <Badge label="Example" />
          </View>
          <LeadCard lead={lead} />
        </View>
      ))}
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
  /*
    Sessions and revenue arrive as PROPS rather than as module imports, because
    they are now per-district. Importing a constant would have hard-wired this
    screen to one tenant — the same mistake as the org name that used to be typed
    into the sidebar — and a component that reaches for its own data cannot be
    rendered for a second district, or in a story, or in a test.
  */
  sessions: readonly Session[];
  revenue: readonly TrendPoint[];
}

export function OpsDashboardContent({
  today,
  operatorName,
  sessions,
  revenue,
}: OpsDashboardContentProps) {
  /*
    Reads and writes use different systems (the brief's fourth trap). This is the
    READ model only: Query owns the rows, the URL owns the shareable view, and
    the table below is handed both — it never fetches and never stores.
  */
  const { view, setView } = useViewParams();
  const { rows: serverRows, page, status, queryKey } = useLeads({ ...view, limit: 25 });
  const stats = page?.stats;

  /*
    Greeting by clock, not by hope. It said "Good morning" at every hour, which
    is the kind of small lie that tells someone the screen is not really looking
    at them.
  */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  /*
    The end of the last session, taken from the schedule rather than asserted.
    Times arrive as "09:00–09:45", so the half after the en dash is the end.
  */
  const lastSessionEnds =
    sessions.length > 0
      ? (sessions[sessions.length - 1]!.time.split('\u2013')[1] ?? '').trim() || 'the end of the day'
      : '';

  /*
    The write path. `rows` from here — not from the query — because the
    optimistic layer is seeded FROM the server rows and collapses back onto them
    when the invalidated query settles. Feeding the table the raw query rows
    would show the edit only after the round trip.
  */
  const { rows, moveStage, pending, error: writeError } = useStageAction(serverRows, queryKey);

  /*
    Doc 28 §2's Zustand column, exactly: density and hidden columns are the
    prefs nobody would paste into Slack, so they persist per device rather than
    travel in the URL. The store holds preferences ABOUT the pipeline and never
    a row of it — trap 1 has a shape test in ops.prefs.test.ts.
  */
  const prefs = useOpsTablePrefs((s) => s.prefs);
  const toggleColumn = useOpsTablePrefs((s) => s.toggleColumn);
  const toggleDensity = useOpsTablePrefs((s) => s.toggleDensity);
  const adoptVisibility = useOpsTablePrefs((s) => s.adoptVisibility);

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
    state: { sorting, columnVisibility: columnVisibilityFor(prefs) },
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    /*
      Visibility is CONTROLLED by the prefs store: the table reports what it
      wants and the store — filtering through the hideable registry — decides
      what persists. Letting the table own this state would give the durable
      preference two owners, one of which forgets on unmount.
    */
    onColumnVisibilityChange: (updater: Updater<VisibilityState>) => {
      const current = columnVisibilityFor(prefs);
      adoptVisibility(typeof updater === 'function' ? updater(current) : updater);
    },
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
            {greeting}, {operatorName}
          </Text>
          <View className="flex-row items-center gap-element">
            <Button title="Add lead" size="sm" />
            <Button title="Import" variant="outline" size="sm" />
          </View>
        </View>
        <Text className="text-body-lg text-text-muted">
          {/*
            "before 5pm" was typed, and the last session in the seed starts at
            16:30 — so on any day the schedule ran late the sentence was simply
            wrong. It reads the last session now, and drops the clause entirely
            when there are none rather than claiming a deadline for an empty day.
          */}
          {stats?.needsAttention ?? total} families need a decision today
          {sessions.length > 0 ? `, and ${sessions.length} ${sessions.length === 1 ? 'session runs' : 'sessions run'} before ${lastSessionEnds}.` : '.'}
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
          <SectionHeader title="Today's sessions" count={String(sessions.length)} />
          <View className="gap-stack">
            {sessions.map((session) => (
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
              data={revenue}
              title={`Invoiced · ${revenue.length} months`}
              height={120}
              // 'en-US' pinned, not the ambient locale: the server and the browser can
              // resolve a bare toLocaleString() differently, and a number that
              // formats one way in the HTML and another after hydration is a
              // mismatch React cannot patch.
              format={(v) => `$${v.toLocaleString('en-US')}`}
            />
          </View>
          {/*
            Both were literals — "38" and "61%" with a hand-typed "−4 pts vs
            July" beneath. Nothing computed them, so they said the same thing for
            every district and every month, and the trend arrow pointed down at a
            decline that had never happened. They are counted from the pipeline
            now, org-wide rather than page-wide.

            No trend line on either: a delta needs last month's number, and the
            rollup tables that would hold it (doc 28 §7 → doc 19) do not exist.
            An honest number with no arrow beats an invented arrow.
          */}
          <StatCard
            size="lg"
            value={String(stats?.sessionsDelivered ?? 0)}
            label="Sessions delivered"
          />
          <StatCard
            size="lg"
            value={stats?.trialConversionPct == null ? '—' : `${stats.trialConversionPct}%`}
            label="Trial conversion"
          />
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
            <View className="flex-row items-center gap-element">
              <Button
                title={view.onlyAttention ? 'Show all' : 'Needs attention'}
                variant="outline"
                size="sm"
                onPress={() => setView({ onlyAttention: !view.onlyAttention })}
              />
              {/*
                One Display menu for density and columns together (Obvious puts
                row density in its Display dropdown; Twenty lists toggleable
                fields the same way). Titles are verb-first — "Hide Owner",
                "Roomy rows" — because the kit Menu has no checkmark state, so
                the label must say what pressing it DOES, not what is.
              */}
              <Menu
                title="Display"
                actions={[
                  {
                    id: 'density',
                    title: prefs.density === 'cool' ? 'Roomy rows' : 'Cool rows',
                  },
                  ...HIDEABLE_COLUMNS.map((column) => ({
                    id: column.id,
                    title: `${prefs.hiddenColumns.includes(column.id) ? 'Show' : 'Hide'} ${column.label}`,
                  })),
                ]}
                onAction={(id) => (id === 'density' ? toggleDensity() : toggleColumn(id))}
              >
                {/*
                  A styled View, NOT the kit Button: Menu's web fork is a
                  details/summary, and a real <button> inside <summary> consumes
                  the click so the menu never opens. The stage badge anchors its
                  menu on a plain View for the same reason. Outline-button
                  clothes, summary semantics — the ▾ says it opens something.
                */}
                <View className="min-h-target-adult flex-row items-center gap-element rounded-control border-2 border-border-strong bg-surface-raised px-4 shadow-card">
                  <Text className="text-sm font-semibold text-text">Display</Text>
                  <Text aria-hidden className="text-caption text-text-muted">
                    ▾
                  </Text>
                </View>
              </Menu>
            </View>
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
          {/*
            The search box the debounced key was built for. NO `debounceMs` here,
            deliberately: `useLeads` already debounces the value's arrival at the
            query key (trap 2 — time the keystrokes once, at the key boundary),
            so a second debounce in the field would just add lag on top of lag.
            Every keystroke lands in the URL via `replace`, which is the point —
            the URL is the source of truth the chips and the key both read.
          */}
          <SearchBar
            value={view.q}
            onChangeText={(q) => setView({ q })}
            placeholder="Search families…"
            aria-label="Search the pipeline"
            className="w-64"
          />
          {view.onlyAttention ? (
            <FilterChip label="Needs attention" onRemove={() => setView({ onlyAttention: false })} />
          ) : null}
          {view.stage ? (
            <FilterChip label={`Stage: ${view.stage}`} onRemove={() => setView({ stage: undefined })} />
          ) : null}
          {/*
            No "Search: …" chip any more: the query is visible in the field two
            inches to the left, and a chip restating it gave the same fact two
            removal affordances that could disagree.
          */}
          {!view.onlyAttention && !view.stage && !view.q ? (
            <Text className="text-caption text-text-muted">No filters — showing every family.</Text>
          ) : null}
        </View>

        <DataTable
          table={table}
          density={prefs.density}
          status={status}
          onRowPress={() => {}}
          renderCard={(row) => <LeadCard lead={row.original} />}
          empty={
            /*
              Two different empties (doc 37 §2): a pipeline that is genuinely
              empty — zero rows before ANY filter — seeds labelled example rows,
              while a filter that merely matched nothing keeps the honest "your
              filter did this" state with the way out. `totalUnfiltered` is the
              discriminator because it ignores the view entirely.
            */
            totalUnfiltered === 0 ? (
              <ExampleLeads />
            ) : (
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
            )
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
