'use client';
// tutor.incidents — the tutor's filed-incident lifecycle view (doc 36 §3.3,
// web-first; no mobile tab by contract). A list of what the acting user
// reported, each row opening in place to the incident's append-only timeline
// and current state, with the contract's append-note secondary action.
//
// WHAT THIS SCREEN DELIBERATELY DOES NOT DO:
//
//   · NO COUNT BADGES, anywhere — the contract carries doc 31 §5.3's
//     reasoning over from the org Safety tab, so nothing here counts
//     incidents at a glance, including the header caption.
//   · NO SEVERITY, NO RED FRAMING — severity is triage's judgment (§5.1) and
//     the S-tier vocabulary stays on the org queue; status pills here use the
//     calm tones only.
//   · NO ORG INTERRUPTS — the unassigned-S4 banner is owner/manager work and
//     does not follow the data onto a reporter's own list.
//   · TRANSCRIPT EXCERPTS RENDER AS AN HONEST PLACEHOLDER. The row carries
//     `{sessionId, messageIds}` references and there is NO permission-gated
//     resolver for a tutor read today — so the screen states that the excerpt
//     travels with the report for triage, and never fabricates the words
//     (doc 31 §4.1: "permission-gated render, never a copy").
//   · ATTACHMENTS RENDER AS A COUNT, never a link: the row stores Bunny ids
//     (doc 29's token-auth class) and no presigned read path exists for this
//     surface — a link minted here would be a token invented client-side.
//   · INTAKE IS DEFERRED, and the empty state says so instead of hiding it.
//     Filing needs a subject: `subjectLearnerAuthId` is required on the
//     collection and `submitIncident` verifies the subject against the
//     caller's own wards — a relationship a tutor does not have (scoping
//     B2/B3: no roster or guardianship edge exists to verify a tutor→learner
//     subject, and no tutorAuthId exists on tutorSessions to derive one).
//     A subjectless or self-referencing filing is unrepresentable, so the
//     door is not drawn until it can open honestly.
//
// Mobbin: https://mobbin.com/screens/869bdacb-44bf-40a7-9437-3fc11985bf50
// (Aboard — a filed report read back by its reporter: status pill leading,
// category as supporting metadata, the reply composer at the bottom of the
// case rather than a separate surface) ·
// https://mobbin.com/screens/590e4229-15d9-4d12-808b-2e5479a1d804
// (incident.io — the timeline as the incident's primary reading: dated
// entries, status-change lines in plain words, comment entry inline) ·
// https://mobbin.com/screens/a21ef4c4-38e3-475e-b8b0-2618f40df869
// (Airwallex — "Report activity" as a quiet vertical trail of actor + action
// + timestamp under the report body, status pill beside the title) ·
// https://mobbin.com/screens/45e52eec-bf60-41f6-8f4d-d783c698a6fb
// (Coda — row in a list opening a detail beside/over it while the list stays;
// comments and activity kept together on the same record).
// Structure only. Tones, type ramp and spacing tiers are docs 02/08.
// SOT: design/screens/tutor/tutor.incidents/contract.md · docs/pack/31-grade-voice-safety-incidents.md §5.1 · docs/pack/36-role-navigation-flows.md §3.3
// SOT-KEYWORDS: tutor incidents content filed lifecycle status filter timeline append note excerpt placeholder attachments count intake deferred

import { useState } from 'react';
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
import type { TutorIncidentView } from './incidents.service.ts';
import { CATEGORY_LABEL, STATUS_LABEL } from './queue-view.ts';
import {
  useTutorIncidentsStore,
  type TutorIncidentStatusFilter,
} from './tutor-incidents.store.ts';
import { useAppendIncidentNote, useTutorIncidents } from './use-tutor-incidents.ts';

type IncidentStatus = TutorIncidentView['status'];

/**
 * Calm tones only. The two settled states read as done (forest, the grade
 * mark); everything in motion stays neutral — a reporter's list has no
 * deadline column and nothing here is theirs to chase.
 */
const STATUS_TONE = {
  new: 'neutral',
  triaged: 'neutral',
  'in-review': 'neutral',
  actioned: 'success',
  resolved: 'success',
  closed: 'neutral',
} as const satisfies Record<IncidentStatus, 'neutral' | 'success'>;

/** The contract's filter, in lifecycle order (new→…→closed). */
const STATUS_OPTIONS: readonly { value: TutorIncidentStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: STATUS_LABEL.new },
  { value: 'triaged', label: STATUS_LABEL.triaged },
  { value: 'in-review', label: STATUS_LABEL['in-review'] },
  { value: 'actioned', label: STATUS_LABEL.actioned },
  { value: 'resolved', label: STATUS_LABEL.resolved },
  { value: 'closed', label: STATUS_LABEL.closed },
];

/** "Aug 27" — the register the queue's rows already use. */
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

const ACTOR_LABEL = { you: 'You', moyo: 'MoyoLearn' } as const;

function TimelineEntry({ line }: { line: TutorIncidentView['timeline'][number] }) {
  return (
    <View className="gap-0.5 border-l-2 border-border pl-3">
      <Text variant="caption" tone="muted">
        {moment(line.at)} · {ACTOR_LABEL[line.actor]} · {line.action}
      </Text>
      {line.note !== null ? <Text variant="caption">{line.note}</Text> : null}
    </View>
  );
}

/**
 * The append-note composer, one per open incident (keyed remount clears it
 * when the tutor opens a different case). The text is screen-local state that
 * SURVIVES a failed post — the error renders beside the button and the same
 * note is what retries, because a safety note lost to a network blip is the
 * intake-failure rule ("never silently lost") applied to the smaller write.
 */
function NoteComposer({ incidentId }: { incidentId: string }) {
  const [note, setNote] = useState('');
  const append = useAppendIncidentNote();

  return (
    <View className="gap-element">
      <Textarea
        label="Add a note"
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

function IncidentDetail({ incident }: { incident: TutorIncidentView }) {
  return (
    <View className="gap-group border-b-2 border-border bg-surface-sunken px-4 py-4">
      <View className="gap-element">
        <Text>{incident.summary}</Text>
        {incident.immediateActionTaken !== null ? (
          <Text variant="caption" tone="muted">
            At the time: {incident.immediateActionTaken}
          </Text>
        ) : null}
        {incident.resolution !== null ? (
          <Text variant="caption">Resolution: {incident.resolution}</Text>
        ) : null}
      </View>

      {incident.excerptSessionId !== null ? (
        <Card className="gap-0.5">
          <Text variant="caption">Transcript excerpt attached for triage</Text>
          <Text variant="caption" tone="muted">
            The conversation reference travels with this report and renders only for the safety
            team, under permission. It isn’t shown here.
          </Text>
        </Card>
      ) : null}

      {incident.attachmentCount > 0 ? (
        <Text variant="caption" tone="muted">
          {incident.attachmentCount === 1
            ? '1 attachment on file'
            : `${incident.attachmentCount} attachments on file`}{' '}
          — held with the report for review.
        </Text>
      ) : null}

      <View className="gap-element">
        <Heading level={2} size="title">
          Timeline
        </Heading>
        {incident.timeline.map((line) => (
          <TimelineEntry key={`${line.at}-${line.action}`} line={line} />
        ))}
      </View>

      <NoteComposer key={incident.incidentId} incidentId={incident.incidentId} />
    </View>
  );
}

function IncidentRow({ incident, open, onToggle }: {
  incident: TutorIncidentView;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <View>
      <Pressable
        onPress={onToggle}
        aria-expanded={open}
        aria-label={`${CATEGORY_LABEL[incident.category]}, ${STATUS_LABEL[incident.status]}`}
        className="min-h-14 flex-row items-center gap-stack border-b-2 border-border px-4 py-3 hover:bg-surface-raised"
      >
        <Badge label={STATUS_LABEL[incident.status]} tone={STATUS_TONE[incident.status]} />
        <View className="flex-1 gap-0.5">
          <Text>{CATEGORY_LABEL[incident.category]}</Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {incident.summary}
          </Text>
        </View>
        <Text variant="caption" tone="muted">
          {day(incident.occurredAt)}
        </Text>
      </Pressable>
      {open ? <IncidentDetail incident={incident} /> : null}
    </View>
  );
}

export function TutorIncidentsContent() {
  const { incidents, loading, error, retry } = useTutorIncidents();
  const statusFilter = useTutorIncidentsStore((s) => s.statusFilter);
  const openIncidentId = useTutorIncidentsStore((s) => s.openIncidentId);
  const setStatusFilter = useTutorIncidentsStore((s) => s.setStatusFilter);
  const toggleIncident = useTutorIncidentsStore((s) => s.toggleIncident);

  const visible =
    statusFilter === 'all'
      ? incidents
      : incidents.filter((incident) => incident.status === statusFilter);

  return (
    <View className="flex-1 gap-group">
      <Section className="gap-stack px-4 pt-4">
        <View className="gap-0.5">
          <Heading level={1} size="display-sm">
            Incidents
          </Heading>
          {/* No count in the caption — the no-badge law covers every tally. */}
          <Text variant="caption" tone="muted">
            Reports you’ve filed, and where each one stands.
          </Text>
        </View>

        {incidents.length > 0 || statusFilter !== 'all' ? (
          <FilterBar
            activeCount={statusFilter !== 'all' ? 1 : 0}
            onClearAll={() => {
              setStatusFilter('all');
            }}
          >
            <SegmentedControl
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </FilterBar>
        ) : null}
      </Section>

      <Body
        loading={loading}
        error={error}
        retry={retry}
        anyFiled={incidents.length > 0}
        visible={visible}
        openIncidentId={openIncidentId}
        toggleIncident={toggleIncident}
      />
    </View>
  );
}

interface BodyProps {
  loading: boolean;
  error: Error | null;
  retry: () => void;
  anyFiled: boolean;
  visible: readonly TutorIncidentView[];
  openIncidentId: string | null;
  toggleIncident: (incidentId: string) => void;
}

function Body({ loading, error, retry, anyFiled, visible, openIncidentId, toggleIncident }: BodyProps) {
  if (loading) {
    return (
      <View className="gap-element px-4">
        <LoadingSkeleton variant="card" count={3} />
      </View>
    );
  }

  /*
    "No incidents" and "we could not check" are different sentences — the same
    rule the org queue states — so a failed read gets the retry, never the
    calm empty state.
  */
  if (error !== null) {
    return (
      <Card className="mx-4 gap-element">
        <Badge label="Not loaded" tone="attention" />
        <Text>We couldn’t load your reports.</Text>
        <Text variant="caption" tone="muted">
          Nothing has changed on your incidents — this screen just needs a connection.
        </Text>
        <Button title="Try again" variant="outline" className="self-start" onPress={retry} />
      </Card>
    );
  }

  if (!anyFiled) {
    /*
      The intake deferral, stated to the person it affects (decision record in
      the header). The contract's empty state wants filing reachable from
      here; until a tutor filing is representable, the honest version is
      saying where reports actually enter today rather than drawing a dead
      form.
    */
    return (
      <EmptyState
        className="flex-1"
        icon={<ShieldCheck size={28} className="text-text-muted" />}
        title="Nothing filed"
        description="Reports you file will appear here with their status and full timeline. Filing from this screen is coming — today, the Safety Plane files automatically from sessions, and anything else goes to your org’s safety lead, who can file it into triage."
      />
    );
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={<ShieldCheck size={28} className="text-text-muted" />}
        title="Nothing in this state"
        description="Clear the filter to see everything you’ve filed."
      />
    );
  }

  return (
    <View className="flex-1">
      {visible.map((incident) => (
        <IncidentRow
          key={incident.incidentId}
          incident={incident}
          open={openIncidentId === incident.incidentId}
          onToggle={() => {
            toggleIncident(incident.incidentId);
          }}
        />
      ))}
    </View>
  );
}
