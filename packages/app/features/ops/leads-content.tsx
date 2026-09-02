'use client';
// The lead pipeline — org.crm's Leads surface, the whole Pipeline region lifted
// out of the ops dashboard (doc 36 §3.4 splits the /ops blob into a CRM rail
// group; this is its first item). The table, toolbar, filter chips, cursor
// pager and both empty states moved here as-is; what is new is the door in
// (the identity cell opens the record) and the door on (the Add-a-lead card,
// the classes idiom, so the contract's "Add your first lead" is live copy).
// SOT: design/screens/org/org.crm/contract.md · docs/pack/28-crm-spec.md §3 · docs/pack/08-visual-hierarchy-spacing-spec.md §5
// SOT-KEYWORDS: leads pipeline crm table toolbar filter cursor stage create lead org
// Mobbin: https://mobbin.com/screens/8a92c5c4-0cb9-42d2-ac3f-72ed3681489f (QuickBooks —
//   "All / Needs attention" segmented above the table) ·
//   https://mobbin.com/screens/35f5c474-ed6a-4c77-a6cb-f2e1d6b12398 (Twenty —
//   removable filter chips on their own row under the section header) ·
//   https://mobbin.com/screens/ec4931ac-c3ca-46cd-8d07-39ffd02e22a9 (Navattic —
//   rows-per-page left, range and prev/next right) ·
//   https://mobbin.com/screens/5ee90a6f-5d97-495c-ad2a-d3dd74ab8b7d (Rocket Money
//   — phone card: identity left, headline figure right, labelled facts beneath) ·
//   https://mobbin.com/screens/4370b80b-b6e5-4404-8343-72a57659a9a9 (Juicebox —
//   the status BADGE is the control, opening its options in place) ·
//   https://mobbin.com/screens/eeea2d53-b9d5-4955-bd28-d6d14b3ad4a0 (Supabase —
//   search field and columns dropdown share the toolbar row above the table) ·
//   https://mobbin.com/screens/8215ed92-68d7-42fb-836b-36b3b7b4e16d (Obvious —
//   row density lives inside the Display dropdown, not as its own control) ·
//   https://mobbin.com/screens/4896dd71-fc2f-4222-b22b-2bab9b3ec225 (Twenty —
//   Options→Fields lists toggleable columns with the identity field pinned) ·
//   https://mobbin.com/screens/5488a273-c380-4a73-adbb-d138fd9e64b8 (Instacart —
//   the create affordance rides the list itself, present whether the list is
//   empty or full). Structure only.
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type SortingState,
  type Updater,
  type VisibilityState,
} from '@tanstack/react-table';
import { useRouter } from 'solito/navigation';
import {
  Badge,
  Banner,
  Button,
  Card,
  Heading,
  Menu,
  DataTable,
  EmptyState,
  SearchBar,
  SegmentedControl,
  SuppressibleValue,
  useAppForm,
  type Suppressible,
} from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/primitives';
import { EXAMPLE_LEADS, MIN_COHORT, STAGE_TONE, type Lead } from './ops.data';
import { useCreateLead, useLeads } from './use-leads';
import { useViewParams } from './use-view-params';
import type { LeadSortField } from './ops.service';
import { MANUAL_STAGES } from './stage-change';
import { useStageAction } from './use-stage-action';
import { HIDEABLE_COLUMNS, columnVisibilityFor, type OpsViewMode } from './ops.prefs';
import { useOpsTablePrefs } from './ops.prefs.store';
import { LeadsBoard } from './leads-board';
import { leadDetailPath } from './ops-paths';

/*
  The page gutter. `p-inset` (16 at Cool) is a CARD inset — using it as the page
  gutter on a 1300px canvas was what made the dashboard read as cramped and
  unfinished, with content jammed against the sidebar rule. Regions are separated
  by `gap-section` (32) against `gap-stack` (12) inside them: the ≥2× jump is the
  grouping signal (doc 08 §2.3), and it is the only one, because everything here
  already has a border.
*/
export const GUTTER = 'px-inset-roomy py-inset-roomy lg:px-section lg:py-section';

/**
 * Built per render rather than module-scope, so the Stage cell can reach the
 * write action directly. The alternative — a context or `table.options.meta` —
 * hides the dependency from anyone reading the column definition.
 */
const buildColumns = (
  moveStage: (change: { leadId: string; to: Lead['stage'] }) => void,
  pending: boolean,
  openLead: (id: string) => void,
): ColumnDef<Lead>[] => [
  {
    accessorKey: 'family',
    header: 'Family',
    // Never hideable: the family is what a row IS. Twenty pins its Name field
    // for the same reason — a table of values with no identities is unreadable.
    enableHiding: false,
    /*
      The identity cell is the door to the record (Twenty and folk both open the
      row from its name). DataTable's `onRowPress` never fires — the prop only
      styles — and a whole-row press would fight the Stage cell's menu anyway,
      so the name is the one deliberate target.
    */
    cell: ({ row }) => (
      <Pressable
        onPress={() => openLead(row.original.id)}
        aria-label={`Open lead: ${row.original.family}`}
        className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
      >
        <View className="gap-0">
          <Text className="text-body font-semibold text-text underline decoration-border-strong underline-offset-2">
            {row.original.family}
          </Text>
          <Text className="text-caption text-text-muted">
            {row.original.learner} · {row.original.subject}
          </Text>
        </View>
      </Pressable>
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
export function LeadCard({ lead }: { lead: Lead }) {
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
        No families yet — here&apos;s what your pipeline will look like. Add your first lead below
        and these examples disappear.
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
        /*
          The × is the chip's one job — it was an aria-hidden glyph with the
          handler never wired, a control that could be seen but not pressed.
          A real Pressable now, full-height so the target matches the adult
          floor the chip's own min-h sets.
        */
        <Pressable
          onPress={onRemove}
          aria-label={`Remove filter: ${label}`}
          className="min-h-target-adult items-center justify-center px-element rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
        >
          <Text className="text-caption text-text-muted">×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A section rule that is a LABEL, not a divider — doc 08 §2.3 bans the divider. */
export function SectionHeader({
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

/**
 * The Add-a-lead card — the classes CreateClassCard idiom (Instacart: the
 * create affordance rides the list, present whether the list is empty or
 * full), so the contract's no_data "Add your first lead" and the steady-state
 * secondary action are the same live surface and nothing is a dead button.
 * The old header's "Import" button is GONE rather than disabled: no import
 * backend exists in any doc-28 slice, and a control that can never work is a
 * lie however it is styled — it returns with the pipeline it can feed.
 */
function AddLeadCard() {
  const createLead = useCreateLead();
  const form = useAppForm({
    defaultValues: { family: '', learner: '', subject: '', value: '' },
    onSubmit: async ({ value }) => {
      const dollars = value.value.trim() === '' ? 0 : Number(value.value.replace(/[$,\s]/g, ''));
      try {
        await createLead.mutateAsync({
          family: value.family.trim(),
          learner: value.learner.trim() === '' ? undefined : value.learner.trim(),
          subject: value.subject.trim() === '' ? undefined : value.subject.trim(),
          // Dollars at the field, CENTS on the wire — the collection stores
          // integer cents and the repository owns the display string.
          valueCents: Math.round(dollars * 100),
        });
        form.reset();
      } catch {
        // Failure stays visible through the mutation's error state (the Banner
        // below) — swallowed here only so the form doesn't double-report it.
      }
    },
  });

  return (
    <Card className="gap-group">
      <Heading level={2} size="title" className="text-text">
        Add a lead
      </Heading>

      {createLead.isError ? (
        <Banner
          tone="warning"
          title="Couldn't add the lead"
          description="Nothing was saved. Check your connection and try again."
        />
      ) : null}

      <form.AppField
        name="family"
        validators={{
          onChange: ({ value }) =>
            value.trim().length === 0 ? 'A lead needs a family name' : undefined,
        }}
      >
        {(field) => (
          <field.TextField label="Family" hint="The household this lead is about." />
        )}
      </form.AppField>

      <form.AppField name="learner">
        {(field) => <field.TextField label="Learner" hint="Optional." />}
      </form.AppField>

      <form.AppField name="subject">
        {(field) => <field.TextField label="Subject" hint="Optional." />}
      </form.AppField>

      <form.AppField
        name="value"
        validators={{
          onChange: ({ value }) => {
            if (value.trim() === '') return undefined;
            const dollars = Number(value.replace(/[$,\s]/g, ''));
            return Number.isFinite(dollars) && dollars >= 0
              ? undefined
              : 'Enter a dollar amount, like 495';
          },
        }}
      >
        {(field) => (
          <field.TextField label="Value" hint="Optional — expected monthly value in dollars." />
        )}
      </form.AppField>

      <form.AppForm>
        <form.SubmitButton title="Add lead" variant="primary" />
      </form.AppForm>
    </Card>
  );
}

export function LeadsScreen() {
  const router = useRouter();
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
    Doc 28 §2's Zustand column, exactly: density and hidden columns are the
    prefs nobody would paste into Slack, so they persist per device rather than
    travel in the URL. The store holds preferences ABOUT the pipeline and never
    a row of it — trap 1 has a shape test in ops.prefs.test.ts.
  */
  const prefs = useOpsTablePrefs((s) => s.prefs);
  const toggleColumn = useOpsTablePrefs((s) => s.toggleColumn);
  const toggleDensity = useOpsTablePrefs((s) => s.toggleDensity);
  const adoptVisibility = useOpsTablePrefs((s) => s.adoptVisibility);
  const setViewMode = useOpsTablePrefs((s) => s.setViewMode);

  /*
    `manualSorting` + `manualPagination`: the server already sorted and paged, so
    letting the table re-sort would reorder ONE page and present it as the whole
    ordering. Never pull a CRM table client-side to sort it.
  */
  const sorting: SortingState = view.sortField
    ? [{ id: view.sortField, desc: view.sortDesc }]
    : [];

  const openLead = (id: string) => router.push(leadDetailPath(id));

  const table = useReactTable({
    data: rows,
    columns: buildColumns(moveStage, pending, openLead),
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
    /*
      DECISION — no `enableRowSelection`: it was switched on with no selection
      column, no bulk action, and state that silently died on a Table⇄Board
      switch. Selection isn't a feature yet; a half-open door to one is worse
      than none. It returns with the first bulk action, alongside a checkbox
      column and a selection model that survives the view toggle.
    */
  });

  const total = page?.total ?? 0;
  const totalUnfiltered = page?.totalUnfiltered ?? 0;

  /*
    The six states are built ONCE and handed to whichever face is showing —
    the org.crm law is two views over one store, and that includes the empty,
    error and paging states reading word-for-word the same. `totalUnfiltered`
    discriminates the two empties exactly as before (doc 37 §2): a genuinely
    empty pipeline seeds the labelled examples, a filter that matched nothing
    keeps the way out.
  */
  const emptyNode =
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
    );

  const errorNode = (
    <EmptyState
      icon={<Text className="text-title">!</Text>}
      title="Could not load the pipeline"
      description="The list is stale, not gone. Try again in a moment."
      action={<Button title="Try again" variant="outline" onPress={() => setView({})} />}
    />
  );

  /*
    Navattic's arrangement: range and totals on the left, the pager on the
    right. Cursor pagination is forward-only by nature, so there is no
    "page 4 of 9" to offer — "First" is the honest way back, and pretending to
    random-access pages you have not fetched is how an offset bug gets
    reintroduced. The BOARD pages with this same pager: it is a view over the
    current cursor page, never a fetch-all (the decision is stated in
    leads-board.tsx where the lanes render).
  */
  const pagerFooter = (
    <>
      <Text className="text-caption text-text-muted">
        {/*
          The threshold is INTERPOLATED, not typed. This line read
          "under 5" while the rule was 10, so the interface was
          publishing a privacy promise the code did not keep — and the
          number a reader trusts is the one on screen.
        */}
        {rows.length} of {total} shown · {totalUnfiltered} families total · attendance hidden for
        groups under {MIN_COHORT}
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
  );

  return (
    <View className={`gap-section ${GUTTER}`}>
      <View className="gap-element">
        <Heading level={1} size="display-sm" className="text-text">
          Leads
        </Heading>
        <Text className="text-body-lg text-text-muted">
          Every family in the funnel, from first inquiry to enrolled.
        </Text>
      </View>

      <View className="gap-stack">
        <SectionHeader
          title="Pipeline"
          /*
            `stats.needsAttention`, never `total`: total is the FILTERED count,
            so with a stage filter on, the chip claimed a number that was
            really "rows matching this view". The stats block is computed over
            the whole org regardless of the page (statsFor's contract), which
            is the only honest source for an org-wide claim.
          */
          count={`${page?.stats.needsAttention ?? 0} need attention`}
          accent={view.onlyAttention}
          action={
            <View className="flex-row items-center gap-element">
              {/*
                The view switcher (Lightfield/Outseta put Table⇄Board with the
                toolbar, never on the board). A durable per-device pref beside
                density — it patches the ops prefs store, so the URL's filters
                and the table's selection are untouched by a switch.
              */}
              <SegmentedControl<OpsViewMode>
                options={[
                  { value: 'table', label: 'Table' },
                  { value: 'board', label: 'Board' },
                ]}
                value={prefs.viewMode}
                onChange={setViewMode}
              />
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

        {/*
          The pipeline's two faces (contract: the board is a VIEW, not a
          screen). Both branches read `rows` — the optimistic layer over the
          same URL-filtered query — and both write through `moveStage`, so a
          move made on either face is the same reducer, the same rollback and
          the same error strip above. Offline follows the existing pattern on
          both: `keepPreviousData` keeps the last-synced page on screen and a
          failed write states itself in the strip (no offline queue for CRM
          writes, per contract).
        */}
        {prefs.viewMode === 'board' ? (
          <LeadsBoard
            rows={rows}
            status={status}
            density={prefs.density}
            pending={pending}
            moveStage={moveStage}
            openLead={openLead}
            empty={emptyNode}
            error={errorNode}
            footer={pagerFooter}
          />
        ) : (
          <DataTable
            table={table}
            density={prefs.density}
            status={status}
            renderCard={(row) => (
              <Pressable
                onPress={() => openLead(row.original.id)}
                aria-label={`Open lead: ${row.original.family}`}
              >
                <LeadCard lead={row.original} />
              </Pressable>
            )}
            empty={emptyNode}
            error={errorNode}
            footer={pagerFooter}
          />
        )}
      </View>

      <AddLeadCard />
    </View>
  );
}
