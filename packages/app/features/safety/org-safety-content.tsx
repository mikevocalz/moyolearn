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
// WHAT LANDED WITH THE STAFF ROSTER READ (each of these was a recorded
// deferral while no server support existed):
//
//   · ASSIGNMENT — the contract's primary action. `GET /api/safety/staff`
//     returns the org's owner/manager roster (id + name + role + a
//     server-marked `me`), the picker below is fed from it, and the service
//     re-checks any posted `assigneeId` against the same member read before
//     writing — so "assign to me" is picking yourself from server truth, not
//     posting identity from a client (CLAUDE.md §The block holds), and a
//     fabricated id gets the swept-record 404. Unassign posts an explicit
//     `null`, which needs no roster to clear.
//   · TIMELINE + TRIAGE NOTE — the queue projection now carries each row's
//     append-only trail with actors coarsened to ROLES (doc 31 §4.2 scopes
//     what a reader is shown: staff read actor roles, never auth ids), and
//     the route's POST appends a staff note through the same append-only door
//     as the tutor variant. The composer's text survives a failed post.
//   · "ASSIGNED TO ME" — the five-second question, answered in the row:
//     "Yours", the assignee's roster name, or "Nobody yet".
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
// triage verbs on the queue itself; its assignee picker is the roster
// affordance the Owner section below follows) ·
// https://mobbin.com/screens/f2e7d89f-72b1-4da1-8820-fd9bd4df3350 (Zendesk —
// the anti-pattern held onto: a red "Open" pill flooding every row makes the
// severe row invisible; here the redpen stays rationed to S4 and breach).
// Structure only. Tones, type ramp and spacing tiers are docs 02/08.
// SOT: design/screens/org/org.safety/contract.md · docs/pack/31-grade-voice-safety-incidents.md §5.2 §5.3 · docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: org safety content web triage queue lifecycle advance severity regrade resolution filter unassigned s4 interrupt stale denied assign owner roster timeline note

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
  ReadFailure,
  SegmentedControl,
  Text,
  Textarea,
} from '@acme/ui';
import { readFailureCopy } from '../../core/read-failure-copy.ts';
import { Pressable } from '@acme/ui/primitives';
import { ShieldCheck } from '@acme/ui/icons';
import type { StaffTimelineActor, TriageRow } from './incidents.service.ts';
import {
  incidentQueueItemsFrom,
  unassignedS4Line,
  STATUS_LABEL,
  type IncidentQueueItem,
} from './queue-view.ts';
import {
  useAppendStaffNote,
  useIncidentQueue,
  useStaffRoster,
  useTriageIncident,
} from './use-incident-queue.ts';
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

/** "Aug 27, 4:12 PM" — a timeline entry is a moment, not just a day. */
const moment = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * The coarsened actors, printed. Roles rather than names on purpose — the
 * projection resolves what a staff reader may see (doc 31 §4.2), and this map
 * only spells it; an actor this build does not know arrives as `moyo`.
 */
const TIMELINE_ACTOR_LABEL = {
  you: 'You',
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
  tutor: 'Tutor',
  guardian: 'Guardian',
  learner: 'Learner',
  moyo: 'MoyoLearn',
} as const satisfies Record<StaffTimelineActor, string>;

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
 * The contract's primary action — assign an owner, off the server's roster.
 *
 * The chips are ACTIONS, not state: the current owner is stated as text
 * (here and in the row's caption), and each chip posts the roster id it was
 * built from. That keeps auth ids where the control needs them — in the
 * fetched roster — and nowhere else: the row itself carries only a name and
 * `assignedToMe`, so no id-to-person mapping happens outside this picker.
 * "Take it" leads because the person reading the queue is the likeliest
 * owner (the contract's one-interaction primary path).
 */
function AssigneePanel({ row }: { row: TriageRow }) {
  const roster = useStaffRoster();
  const assign = useTriageIncident();

  const owner = row.assignedToMe ? 'you' : (row.assigneeName ?? (row.assigned ? 'assigned' : null));

  return (
    <View className="gap-element">
      <Heading level={2} size="title">
        Owner
      </Heading>
      <Text variant="caption" tone="muted">
        {owner === null ? 'Nobody yet — an incident needs a person.' : `Assigned to ${owner}.`}
      </Text>
      {roster.error !== null ? (
        <Text variant="caption" tone="muted">
          The staff roster didn’t load, and assignment needs it. Reopen this incident in a moment.
        </Text>
      ) : roster.loading ? (
        <LoadingSkeleton variant="card" count={1} />
      ) : (
        <View className="flex-row flex-wrap gap-element">
          {[...roster.staff]
            .sort((left, right) => Number(right.me) - Number(left.me))
            .map((member) => (
              <Button
                key={member.id}
                title={member.me ? 'Take it' : member.name}
                variant="outline"
                loading={assign.isPending}
                onPress={() => {
                  assign.mutate({ incidentId: row.incidentId, assigneeId: member.id });
                }}
              />
            ))}
          {row.assigned ? (
            <Button
              title="Unassign"
              variant="outline"
              loading={assign.isPending}
              onPress={() => {
                assign.mutate({ incidentId: row.incidentId, assigneeId: null });
              }}
            />
          ) : null}
        </View>
      )}
      {assign.error !== null ? (
        <ErrorMessage message="That assignment didn’t land — nothing changed on the record. Try again." />
      ) : null}
    </View>
  );
}

/**
 * The append-only trail, read straight off the row — the projection already
 * decided the actors, so this draws the record and fabricates nothing.
 */
function Timeline({ row }: { row: TriageRow }) {
  return (
    <View className="gap-element">
      <Heading level={2} size="title">
        Timeline
      </Heading>
      {row.timeline.map((line) => (
        <View key={`${line.at}-${line.action}`} className="gap-0.5 border-l-2 border-border pl-3">
          <Text variant="caption" tone="muted">
            {moment(line.at)} · {TIMELINE_ACTOR_LABEL[line.actor]} · {line.action}
          </Text>
          {line.note !== null ? <Text variant="caption">{line.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * The staff note composer — the tutor screen's, behind the staff wall. The
 * text is screen-local state that SURVIVES a failed post: the error renders
 * beside the button and the same words are what retries.
 */
function StaffNoteComposer({ incidentId }: { incidentId: string }) {
  const [note, setNote] = useState('');
  const append = useAppendStaffNote();

  return (
    <View className="gap-element">
      <Textarea
        label="Add a triage note"
        hint="Appends to the record — notes can’t be edited or removed later."
        value={note}
        onChangeText={setNote}
        containerClassName="min-h-24"
      />
      {append.error !== null ? (
        <ErrorMessage message="Your note wasn’t saved — it’s still here. Try again in a moment." />
      ) : null}
      <Button
        title="Append note"
        variant="outline"
        className="self-start"
        loading={append.isPending}
        disabled={note.trim().length === 0}
        onPress={() => {
          append.mutate(
            { incidentId, note },
            {
              onSuccess: () => {
                setNote('');
              },
            },
          );
        }}
      />
    </View>
  );
}

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

      {/* Assignment is a live-case move; the record sections below outlive it,
          because a closed case is still a record somebody reads and annotates. */}
      {move !== null ? <AssigneePanel row={row} /> : null}

      <Timeline row={row} />
      <StaffNoteComposer incidentId={row.incidentId} />
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
  const { queue, loading, error, denied, retry } = useIncidentQueue();
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
          {/*
            The count is a CLAIM about the org, so it speaks only for a queue
            that arrived. It used to read straight off `queue.rows.length`,
            which is `EMPTY` until the fetch resolves and stays `EMPTY` when
            the fetch fails — so a 401 and a genuinely quiet org both printed
            "0 incidents", the calmest possible sentence, directly above a card
            saying we could not reach the queue. On this domain that is not a
            cosmetic mismatch: an unread S4 reported as zero is the failure
            this whole surface exists to prevent.
          */}
          <Text variant="caption" tone="muted">
            {denied
              ? 'Incident triage is owner and manager work'
              : loading
                ? 'Loading the queue'
                : error !== null && queue.rows.length === 0
                  ? 'Queue unread — this is not a count'
                  : `${queue.rows.length === 1 ? '1 incident' : `${queue.rows.length} incidents`} · soonest deadline first`}
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
        onRetry={retry}
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
  /** Re-runs the queue read — the failed-read card's one action. */
  onRetry: () => void;
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
  onRetry,
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
        {/* The wall carries a way out — the no_data state's exact exit below —
            because a correct refusal with no door is still a dead end. */}
        <View className="self-start">
          <Button
            title="Back to Overview"
            variant="outline"
            onPress={() => {
              router.push('/ops');
            }}
          />
        </View>
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
    /*
      `ReadFailure`, not a hand-rolled card: the kit component IS the split
      between "answered zero" and "could not check", and this surface owned a
      private fourth copy of it. `readFailureCopy` also settles the sentence
      from the CAUSE — a 401 gets "you've been signed out" and a sign-in exit,
      because the old card's "open Safety again in a moment" was advice that
      fails identically forever when the session is what expired.
    */
    const copy = readFailureCopy(
      error,
      'the incident queue',
      'Nothing on this queue changed and no incident was cleared — this is the screen, not the record.',
    );
    return (
      <ReadFailure
        className="mx-4"
        title={copy.title}
        description={copy.description}
        onRetry={onRetry}
        action={
          copy.signedOut ? (
            <Button
              title="Sign in"
              onPress={() => {
                router.push('/login');
              }}
            />
          ) : (
            <Button
              title="Back to Overview"
              variant="ghost"
              onPress={() => {
                router.push('/ops');
              }}
            />
          )
        }
      />
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
