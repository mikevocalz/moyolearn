'use client';
// org.safety on the web — doc 31 §5.3's triage queue with the triage itself.
// The D-inventory gap ("mobile complete, web MISSING") closed: the mobile
// companion stays read-only by design, and THIS is the surface its own header
// points at — the moves live where the contract puts them.
//
// THE SAME FLAT, DEADLINE-SORTED RUN as the phone. The order arrives decided
// by `triageQueueFrom` and is never regrouped; the filters narrow the run to a
// subset but cannot reorder it, and §5.3's single interrupt — unassigned S4 —
// renders ABOVE the list from the server's count, so no filter can hide it.
//
// WHAT SHIPS: lifecycle advances along the contract's ladder (new → triaged →
// in-review → actioned → resolved → closed) through the route's PATCH, with
// the closing moves recording what was done — `resolution` is what the
// guardian's "What happens next" reads (doc 31 §5.2) — and severity re-grade,
// because §5.1 makes this queue "where severity is decided" (the server
// re-pages on a raise and re-derives the clock; this screen re-decides none
// of it). Filters by severity and lifecycle state are view state only.
//
// WHAT THIS VIEW DELIBERATELY DEFERS (each a gap in server support, not a
// dead button):
//
//   · ASSIGNMENT — the contract's primary action names "assign an owner" and
//     the PATCH accepts `assigneeId`, but no staff-roster read exists under
//     `/api` to pick a person from (the only roster route lists a teacher
//     class's learners), and "assign to me" would post the caller's own
//     identity from a client — banned on web exactly as on mobile (CLAUDE.md
//     §The block). Rows keep their honest "Nobody yet"; assignment lands with
//     an org staff roster read, the same class of schema/service gap the
//     tutor-scope deferral records in `incidents.service.ts`.
//   · TIMELINE + TRIAGE NOTE — the contract's secondary action opens the
//     append-only timeline and adds a note, but the queue GET returns
//     `TriageRow` only (no staff detail projection carries the trail) and the
//     PATCH accepts no bare note — `transitionIncident` writes audit lines
//     for moves alone. Drawing a timeline from a row that does not carry one
//     would mean fabricating the record; it lands with a staff detail read.
//   · "ASSIGNED TO ME" — the five-second question needs identity the row
//     does not carry (`assigned` is a boolean); same roster gap as above.
//
// Mobbin: https://mobbin.com/screens/ac99d0d5-57b7-4640-8ef6-dcf9c0804257
// (Sentry — a flat issue run under a filter bar; the severity marker leads
// the row and the page frame stays quiet) ·
// https://mobbin.com/screens/27de1fa4-2064-41f5-a9ce-79702e76eae9 (Zoho CRM
// workqueue — "Late by 3 days" is the ONLY red in the table; status text
// stays neutral, which is exactly §5.2's rationing) ·
// https://mobbin.com/screens/be812d90-d079-4beb-aa46-dc5237d34da4 (Intercom —
// the SLA as a calm trailing column read right-to-left) ·
// https://mobbin.com/screens/357dd278-8487-4c89-bd05-14d2c3ccc0c5 (Gorgias —
// triage verbs on the queue itself, and its assignee picker is the roster
// affordance the deferral above is waiting on) ·
// https://mobbin.com/screens/f2e7d89f-72b1-4da1-8820-fd9bd4df3350 (Zendesk —
// the anti-pattern held onto: a red "Open" pill flooding every row makes the
// severe row invisible; here the redpen stays rationed to S4 and breach).
// Structure only. Tones, type ramp and spacing tiers are docs 02/08.
// SOT: design/screens/org/org.safety/contract.md · docs/pack/31-grade-voice-safety-incidents.md §5.2 §5.3 · docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: org safety content web triage queue lifecycle advance severity regrade resolution filter unassigned s4 interrupt stale denied

import { useState } from 'react';
import { useRouter } from 'solito/navigation';
import { Section, View } from '@acme/ui/tw';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  FilterBar,
  Heading,
  LoadingSkeleton,
  SegmentedControl,
  Text,
  Textarea,
} from '@acme/ui';
import { Pressable } from '@acme/ui/primitives';
import { ShieldCheck } from '@acme/ui/icons';
import type { TriageRow } from './incidents.service.ts';
import {
  incidentQueueItemsFrom,
  unassignedS4Line,
  STATUS_LABEL,
  type IncidentQueueItem,
} from './queue-view.ts';
import { useIncidentQueue, useTriageIncident } from './use-incident-queue.ts';
import {
  useOrgSafetyStore,
  type QueueSeverityFilter,
  type QueueStatusFilter,
} from './org-safety.store.ts';

type SafetyTier = TriageRow['severity'];
type IncidentStatus = TriageRow['status'];

/** "Aug 27" — the register the mobile queue's rows already use. */
const day = (iso: string): string =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

/**
 * The contract's ladder, one honest step at a time. Free-jumping the lifecycle
 * (a `Select` of all six states) would let "new" become "closed" in one click
 * with no record of what was done in between — the ladder is the reason the
 * middle states exist. The two moves a guardian will read (`actioned`,
 * `resolved`) require the words: `resolution` feeds "What happens next".
 */
const NEXT_MOVE = {
  new: { status: 'triaged', title: 'Mark triaged', needsNote: false },
  triaged: { status: 'in-review', title: 'Start review', needsNote: false },
  'in-review': { status: 'actioned', title: 'Record action', needsNote: true },
  actioned: { status: 'resolved', title: 'Resolve', needsNote: true },
  resolved: { status: 'closed', title: 'Close', needsNote: false },
  closed: null,
} as const satisfies Record<
  IncidentStatus,
  { status: IncidentStatus; title: string; needsNote: boolean } | null
>;

const SEVERITY_OPTIONS: readonly { value: SafetyTier; label: string }[] = [
  { value: 'S1', label: 'S1' },
  { value: 'S2', label: 'S2' },
  { value: 'S3', label: 'S3' },
  { value: 'S4', label: 'S4' },
];

const SEVERITY_FILTER_OPTIONS: readonly { value: QueueSeverityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...SEVERITY_OPTIONS,
];

/** The contract's filter, in lifecycle order (new→…→closed). */
const STATUS_FILTER_OPTIONS: readonly { value: QueueStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: STATUS_LABEL.new },
  { value: 'triaged', label: STATUS_LABEL.triaged },
  { value: 'in-review', label: STATUS_LABEL['in-review'] },
  { value: 'actioned', label: STATUS_LABEL.actioned },
  { value: 'resolved', label: STATUS_LABEL.resolved },
  { value: 'closed', label: STATUS_LABEL.closed },
];

/**
 * The triage controls for one open row. Keyed by incidentId at the call site
 * so opening a different case clears the composer; the note itself SURVIVES a
 * failed post — the error renders beside the button and the same words are
 * what retries (the intake "never silently lost" rule, applied to the write
 * a guardian will read).
 */
function TriagePanel({ row }: { row: TriageRow }) {
  const [note, setNote] = useState('');
  const [severity, setSeverity] = useState<SafetyTier>(row.severity);
  const triage = useTriageIncident();
  const move = NEXT_MOVE[row.status];

  return (
    <View className="gap-group border-b-2 border-border bg-surface-sunken px-4 py-4">
      {move !== null ? (
        <View className="gap-element">
          <Heading level={2} size="title">
            Move to {STATUS_LABEL[move.status]}
          </Heading>
          {move.needsNote ? (
            <Textarea
              label="What was done"
              hint="A parent reads this — it becomes “What happens next” on their incident view. Plain words."
              value={note}
              onChangeText={setNote}
              containerClassName="min-h-24"
            />
          ) : null}
          {triage.error !== null ? (
            <ErrorMessage message="That move didn’t land — nothing changed on the record. Try again." />
          ) : null}
          <Button
            title={move.title}
            variant="outline"
            className="self-start"
            loading={triage.isPending}
            disabled={move.needsNote && note.trim().length === 0}
            onPress={() => {
              triage.mutate(
                move.needsNote
                  ? { incidentId: row.incidentId, status: move.status, resolution: note }
                  : { incidentId: row.incidentId, status: move.status },
                {
                  onSuccess: () => {
                    setNote('');
                  },
                },
              );
            }}
          />
        </View>
      ) : (
        <Text variant="caption" tone="muted">
          Closed. The record is kept — nothing further is owed on it.
        </Text>
      )}

      {move !== null ? (
        <View className="gap-element">
          <Heading level={2} size="title">
            Severity
          </Heading>
          <Text variant="caption" tone="muted">
            Decided here, at triage. Raising it notifies again and re-derives the response
            deadline; lowering it does not.
          </Text>
          <SegmentedControl options={SEVERITY_OPTIONS} value={severity} onChange={setSeverity} />
          {severity !== row.severity ? (
            <Button
              title={`Set severity to ${severity}`}
              variant="outline"
              className="self-start"
              loading={triage.isPending}
              onPress={() => {
                triage.mutate({ incidentId: row.incidentId, severity });
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function QueueRow({
  row,
  item,
  open,
  readOnly,
  onToggle,
}: {
  row: TriageRow;
  item: IncidentQueueItem;
  open: boolean;
  readOnly: boolean;
  onToggle: () => void;
}) {
  return (
    <View>
      <Pressable
        onPress={onToggle}
        aria-expanded={open}
        aria-label={`${item.severity}, ${item.category}, ${item.status}`}
        className="min-h-14 flex-row items-center gap-stack border-b-2 border-border px-4 py-3 hover:bg-surface-raised"
      >
        <Badge label={item.severity} tone={item.tone} />
        <View className="flex-1 gap-0.5">
          <Text>{item.category}</Text>
          <Text variant="caption" tone="muted">
            {item.status} · {item.assignment}
          </Text>
        </View>
        <View className="items-end gap-0.5">
          {/* The clock carries the row's only colour after the rung badge —
              and only when it is bad news (the Zoho rule, and §5.2's). */}
          <Text variant="caption" tone={item.breached ? 'danger' : 'muted'}>
            {item.clock}
          </Text>
          <Text variant="caption" tone="muted">
            {day(item.occurredAt)}
          </Text>
        </View>
      </Pressable>
      {open ? (
        readOnly ? (
          <View className="border-b-2 border-border bg-surface-sunken px-4 py-4">
            <Text variant="caption" tone="muted">
              Triage is paused while the connection is down — this row is its last loaded state.
            </Text>
          </View>
        ) : (
          <TriagePanel key={row.incidentId} row={row} />
        )
      ) : null}
    </View>
  );
}

export function OrgSafetyContent() {
  const { queue, loading, error, denied } = useIncidentQueue();
  const severityFilter = useOrgSafetyStore((s) => s.severityFilter);
  const statusFilter = useOrgSafetyStore((s) => s.statusFilter);
  const openIncidentId = useOrgSafetyStore((s) => s.openIncidentId);
  const setSeverityFilter = useOrgSafetyStore((s) => s.setSeverityFilter);
  const setStatusFilter = useOrgSafetyStore((s) => s.setStatusFilter);
  const toggleIncident = useOrgSafetyStore((s) => s.toggleIncident);
  const clearFilters = useOrgSafetyStore((s) => s.clearFilters);

  /*
    The contract's offline path: when a refetch fails but a synced queue is in
    the cache, the queue renders READ-ONLY behind a prominent staleness
    warning — stale safety data is dangerous data, and triage writes require
    connectivity the read just proved absent.
  */
  const stale = error !== null && queue.rows.length > 0;

  const visible = queue.rows.filter(
    (row) =>
      (severityFilter === 'all' || row.severity === severityFilter) &&
      (statusFilter === 'all' || row.status === statusFilter),
  );

  /*
    The clock is read at render rather than ticked — the mobile queue's rule.
    Items pair 1:1 with `visible` (a map, never a re-sort), so the raw row
    rides alongside its presentation for the panel's sake.
  */
  const now = new Date();
  const items = incidentQueueItemsFrom(visible, now);
  const interrupt = unassignedS4Line(queue.unassignedS4);
  const activeFilters = (severityFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  return (
    <View className="flex-1 gap-group">
      <Section className="gap-stack px-4 pt-4">
        <View className="gap-0.5">
          <Heading level={1} size="display-sm">
            Safety
          </Heading>
          <Text variant="caption" tone="muted">
            {queue.rows.length === 1 ? '1 incident' : `${queue.rows.length} incidents`} · soonest
            deadline first
          </Text>
        </View>

        {/* §5.3's single interrupt, from the server's count — no filter hides it. */}
        {interrupt !== null ? (
          <Card className="gap-element">
            <Badge label="Needs a person now" tone="danger" />
            <Text>{interrupt}</Text>
            <Text variant="caption" tone="muted">
              An S4 stops the child’s session until a person clears it. It sorts to the top of this
              queue — triage it now; this banner leaves when it’s taken care of.
            </Text>
          </Card>
        ) : null}

        {stale ? (
          <Card className="gap-element">
            <Badge label="Showing last-synced queue" tone="attention" />
            <Text>We can’t reach the server — deadlines and new incidents may have moved.</Text>
            <Text variant="caption" tone="muted">
              Triage is paused until the connection returns. Nothing shown here is live.
            </Text>
          </Card>
        ) : null}

        {!denied && (queue.rows.length > 0 || activeFilters > 0) ? (
          <FilterBar activeCount={activeFilters} onClearAll={clearFilters}>
            <SegmentedControl
              options={SEVERITY_FILTER_OPTIONS}
              value={severityFilter}
              onChange={setSeverityFilter}
            />
            <SegmentedControl
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </FilterBar>
        ) : null}
      </Section>

      <Body
        loading={loading}
        denied={denied}
        error={error}
        stale={stale}
        anyRows={queue.rows.length > 0}
        visible={visible}
        items={items}
        openIncidentId={openIncidentId}
        toggleIncident={toggleIncident}
      />
    </View>
  );
}

interface BodyProps {
  loading: boolean;
  denied: boolean;
  error: Error | null;
  stale: boolean;
  anyRows: boolean;
  visible: readonly TriageRow[];
  items: readonly IncidentQueueItem[];
  openIncidentId: string | null;
  toggleIncident: (incidentId: string) => void;
}

function Body({
  loading,
  denied,
  error,
  stale,
  anyRows,
  visible,
  items,
  openIncidentId,
  toggleIncident,
}: BodyProps) {
  const router = useRouter();

  /*
    The contract's permission path, with mobile as the stated model: denied
    users see the role wall as a correct answer, never a broken screen — and
    never an upsell (the route flattens the plan gate to 403 on purpose).
  */
  if (denied) {
    return (
      <Card className="mx-4 gap-element">
        <Badge label="Owners and managers" tone="neutral" />
        <Text>This queue isn’t yours to read.</Text>
        <Text variant="caption" tone="muted">
          Incident triage is owner and manager work. Nothing is wrong with your account.
        </Text>
      </Card>
    );
  }

  if (loading) {
    return (
      <View className="gap-element px-4">
        <LoadingSkeleton variant="card" count={3} />
      </View>
    );
  }

  /*
    A failed read with NOTHING cached gets its own answer rather than an empty
    list — "no incidents" and "we could not check" are different sentences,
    and printing the calm one when we do not know is the failure mode this
    domain is written against. With a cache, the stale banner above already
    said it, and the last-synced rows render read-only below.
  */
  if (error !== null && !stale) {
    return (
      <Card className="mx-4 gap-element">
        <Badge label="Not loaded" tone="attention" />
        <Text>We couldn’t reach the queue.</Text>
        <Text variant="caption" tone="muted">
          This needs a connection. Nothing has changed — open Safety again in a moment.
        </Text>
      </Card>
    );
  }

  if (!anyRows) {
    /* The contract's no_data path: calm, with the exit to org.overview. */
    return (
      <EmptyState
        className="flex-1"
        icon={<ShieldCheck size={28} className="text-text-muted" />}
        title="No open incidents"
        description="No incident in this org owes anybody an answer. New reports land here as they are filed."
        action={
          <Button
            title="Back to Overview"
            variant="outline"
            onPress={() => {
              router.push('/ops');
            }}
          />
        }
      />
    );
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={<ShieldCheck size={28} className="text-text-muted" />}
        title="Nothing in this slice"
        description="Clear the filters to see the whole queue."
      />
    );
  }

  return (
    <View className="flex-1">
      {visible.map((row, index) => {
        const item = items[index];
        if (item === undefined) return null;
        return (
          <QueueRow
            key={row.incidentId}
            row={row}
            item={item}
            open={openIncidentId === row.incidentId}
            readOnly={stale}
            onToggle={() => {
              toggleIncident(row.incidentId);
            }}
          />
        );
      })}
    </View>
  );
}
