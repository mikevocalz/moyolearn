'use client';
// Doc 31 §5.3's triage queue, on a phone. The surface route-audit-36.md records
// as missing: "no mobile incident-queue screen exists (`features/safety` is
// service-only) … the tab slot is reserved in the org layout and points at Inbox
// until then." This is the thing that closes it.
//
// A FLAT, DEADLINE-SORTED RUN — not grouped by severity or status, however much
// a queue screen wants sections. The order arrives already decided by
// `triageQueueFrom`: soonest deadline first, no-clock rows last, and grouping
// would silently reorder it so an S4 due in two hours sat below a heading full
// of week-old fence-tests. The one thing lifted OUT of the run is §5.3's single
// interrupt — unassigned S4 — which is a count, not a filter.
//
// NOTHING HERE IS ACTIONABLE, and that is a decision rather than an omission.
// The route's PATCH assigns a named person; picking one needs a roster the web
// ops surface has and a phone does not, and "assign to me" would mean posting
// the caller's own identity from a client. So this is the day's exceptions,
// legible at arm's length, and triage stays where the roster is.
//
// Mobbin: https://mobbin.com/screens/cf05d193-c232-4bd5-87f6-3f1d21db6603 (Matter
// "Queue" — one flat sorted run under a title and a single summary chip; no
// sections, which is exactly the constraint the server-side sort imposes here) ·
// https://mobbin.com/screens/193d80f2-c33b-46f3-8833-0b58ee8bf0f6 (Quo "Call
// flows" — the row shape: leading marker, one title, one secondary metadata
// line, trailing state, read right-to-left in a glance) ·
// https://mobbin.com/screens/e048afb1-3148-4d6f-acb7-c61385e7971b (Alta — the
// batch that needs attention gets a labelled band ABOVE the list rather than a
// badge inside it) · https://mobbin.com/screens/e5cb4b36-329d-45ba-ac2d-4fa92bb0cb34
// (GitHub — status carried as a chip that is read before the prose beside it) ·
// https://mobbin.com/screens/88318e4e-2cbc-4704-bd42-01bcf53bd8b7 (Yubo — a
// severity-led report surface, and the reminder that the severest option must
// not be the loudest thing on a screen full of ordinary ones)
// Structure only. The slab borders, the badge tones, the type ramp and the
// spacing tiers are docs 02/08.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §5.3 · docs/design/route-audit-36.md §1 · docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: safety incident queue content org mobile triage sla breach unassigned s4 severity status list

import { Section, View } from '@acme/ui/tw';
import { Badge, Card, EmptyState, Heading, LoadingSkeleton, Text, VirtualList } from '@acme/ui';
import { ShieldCheck } from '@acme/ui/icons';
import { incidentQueueItemsFrom, unassignedS4Line, type IncidentQueueItem } from './queue-view.ts';
import { useIncidentQueue } from './use-incident-queue.ts';

/** "Aug 27" — the day a triager would name in a handover. */
const day = (iso: string): string =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

function QueueRow({ item }: { item: IncidentQueueItem }) {
  return (
    <View className="flex-row items-center gap-stack border-b-2 border-border px-4 py-3">
      <Badge label={item.severity} tone={item.tone} />
      <View className="flex-1 gap-0.5">
        <Text>{item.category}</Text>
        <Text variant="caption" tone="muted">
          {item.status} · {item.assignment}
        </Text>
      </View>
      <View className="items-end gap-0.5">
        {/*
          The clock is the column a triager scans, so it carries the only colour
          in the row after the rung badge — and only when it is bad news.
        */}
        <Text variant="caption" tone={item.breached ? 'danger' : 'muted'}>
          {item.clock}
        </Text>
        <Text variant="caption" tone="muted">{day(item.occurredAt)}</Text>
      </View>
    </View>
  );
}

export function IncidentQueueContent() {
  const { queue, loading, error, denied } = useIncidentQueue();

  /*
    The clock is read at render rather than ticked. Every string this produces
    is a distance ("Due in 2h"), and a distance that updated itself once a
    second would be an animated countdown on a safety queue — pressure the
    people working it do not need and the SLA does not require.
  */
  const items = [...incidentQueueItemsFrom(queue.rows, new Date())];
  const interrupt = unassignedS4Line(queue.unassignedS4);

  return (
    <View className="flex-1 gap-group">
      <Section className="gap-stack px-4 pt-4">
        <View className="gap-0.5">
          <Heading level={1} size="display-sm">Safety</Heading>
          <Text variant="caption" tone="muted">
            {items.length === 1 ? '1 incident' : `${items.length} incidents`} · soonest deadline first
          </Text>
        </View>

        {interrupt !== null ? (
          <Card className="gap-element">
            <Badge label="Needs a person now" tone="danger" />
            <Text>{interrupt}</Text>
            <Text variant="caption" tone="muted">
              An S4 stops the child’s session until a person clears it. Assign it from the ops
              dashboard.
            </Text>
          </Card>
        ) : null}
      </Section>

      <Body loading={loading} denied={denied} error={error} items={items} />
    </View>
  );
}

interface BodyProps {
  loading: boolean;
  denied: boolean;
  error: Error | null;
  items: IncidentQueueItem[];
}

function Body({ loading, denied, error, items }: BodyProps) {
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
    A failed read gets its own answer rather than an empty list. "No incidents"
    and "we could not check" are different sentences, and printing the calm one
    when we do not know is the failure mode this whole domain is written against.
  */
  if (error !== null) {
    return (
      <Card className="mx-4 gap-element">
        <Badge label="Not loaded" tone="attention" />
        <Text>We couldn’t reach the queue.</Text>
        <Text variant="caption" tone="muted">
          This needs a connection. Nothing has changed — open the tab again in a moment.
        </Text>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={<ShieldCheck size={28} className="text-text-muted" />}
        title="Nothing waiting"
        description="No incident in this org owes anybody an answer. New reports land here as they are filed."
      />
    );
  }

  return (
    <VirtualList
      className="flex-1"
      data={items}
      keyExtractor={(item) => item.incidentId}
      estimatedItemSize={76}
      renderItem={({ item }) => <QueueRow item={item} />}
    />
  );
}
