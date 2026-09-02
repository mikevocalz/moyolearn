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
//   · INTAKE FILES THROUGH ITS OWN DOOR. Filing needs a subject:
//     `subjectLearnerAuthId` is required on the collection, and
//     `submitTutorIncident` verifies the picked subject against the caller's
//     ACTIVE engagements — ADR-108's roster edge, the wards-intersection
//     shape one relationship over — so a subjectless or foreign-subject
//     filing stays unrepresentable. (This was scoping B2/B3's deferral until
//     the edge existed; the decision became this description.) The subject
//     picker is fed names only, severity appears nowhere on the form (§5.1),
//     the legal-hold categories are never pickable, and the form's state
//     survives a failed post. "My sessions" incident scope is LIVE per
//     ADR-110: the sessions collection carries the session→tutor edge, so the
//     list shows what I filed plus incidents on sessions I run.
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
// The intake form's own references are doc 31 §5.1's chosen ones: Microsoft
// Teams' report form (https://mobbin.com/screens/38fca0fb-5819-4ad4-bdd0-2743d24bd4b0
// — categories, anonymous toggle, no severity), Teachable's one-line
// plain-language definition under every category
// (https://mobbin.com/screens/5b1bb1fa-8077-47de-8114-844b0b26e0ee), and
// Substack's what-happens-next line before submit
// (https://mobbin.com/screens/b9b37490-cea6-4aef-9be6-1d1ac3f4acd0).
// Structure only. Tones, type ramp and spacing tiers are docs 02/08.
// SOT: design/screens/tutor/tutor.incidents/contract.md · docs/pack/31-grade-voice-safety-incidents.md §5.1 · docs/decisions/adr-108-tutor-learner-edge.md · docs/pack/36-role-navigation-flows.md §3.3
// SOT-KEYWORDS: tutor incidents content filed lifecycle status filter timeline append note excerpt placeholder attachments count intake form subject picker engagement anonymous

import { useState } from 'react';
import { Section, View } from '@acme/ui/tw';
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorMessage,
  FilterBar,
  Heading,
  LoadingSkeleton,
  SegmentedControl,
  Text,
  Textarea,
  notify,
} from '@acme/ui';
import { Pressable } from '@acme/ui/primitives';
import { ShieldCheck } from '@acme/ui/icons';
import type { TutorIncidentView } from './incidents.service.ts';
import { CATEGORY_LABEL, STATUS_LABEL } from './queue-view.ts';
import {
  useTutorIncidentsStore,
  type TutorIncidentStatusFilter,
} from './tutor-incidents.store.ts';
import {
  useAppendIncidentNote,
  useEngagedLearners,
  useSubmitTutorIncident,
  useTutorIncidents,
  type SubmitTutorIncidentBody,
} from './use-tutor-incidents.ts';

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

type ReportableCategory = SubmitTutorIncidentBody['category'];

/**
 * The categories a filer may pick, with §5.1's one-line plain-language
 * definition under each (the Teachable move — when policy doesn't define what
 * counts, people report inconsistently or not at all).
 *
 * `self-harm` and `abuse-disclosure` are absent on purpose, mirroring the
 * server's `TUTOR_REPORTABLE` (which is the check that holds; this list only
 * decides what is drawn). Both carry a legal hold, and neither is a box a
 * worried reporter should be able to tick from a form — a mis-tick would put
 * a permanent hold on a record about a child who is fine. A human narrows a
 * report into either of them at triage, which is also where the hold is
 * applied.
 */
const REPORTABLE_OPTIONS: readonly { value: ReportableCategory; hint: string }[] = [
  { value: 'profanity', hint: 'Swearing or crude language during a session.' },
  { value: 'sexual-content', hint: 'Sexual talk, questions, or material.' },
  { value: 'bullying', hint: 'Targeting, mocking, or threatening another child.' },
  { value: 'pii-shared', hint: 'An address, school, phone number, or other personal details were shared.' },
  { value: 'violence', hint: 'Talk of hurting someone, or violent threats.' },
  { value: 'substances', hint: 'Talk of drugs, alcohol, or other substances.' },
  { value: 'tutor-behavior', hint: 'The tutor said or did something it should not have.' },
  { value: 'safety-concern', hint: 'Something felt unsafe and nothing above fits it.' },
  { value: 'other', hint: 'Anything else worth a record.' },
];

/**
 * Doc 31 §5.1's intake, in a sheet over the list (the contract's own word for
 * it; `BottomSheet` is the kit's sheet — the profile switcher's precedent —
 * and it scrolls, which a nine-category form needs).
 *
 * NO SEVERITY AND NO RED FRAMING anywhere on the form: severity is triage's
 * call and every submission opens at S3 (§5.1 — "not a color the reporter
 * must choose under stress"). Every field is plain `useState` that SURVIVES a
 * failed post — the error renders inline beside the same button, and the same
 * state is what retries, because "a safety report must never be silently
 * lost" is the contract's failure path. Discarding the draft is the one thing
 * only closing the sheet does.
 *
 * The subject picker is fed by the engaged-learner read — names only, and a
 * tutor with no active engagements is told where reports enter instead of
 * being handed a picker with nothing to pick.
 */
function IntakeForm({ onDone }: { onDone: () => void }) {
  const { learners, loading, error } = useEngagedLearners();
  const submit = useSubmitTutorIncident();

  const [subjectLearnerId, setSubjectLearnerId] = useState('');
  const [category, setCategory] = useState<ReportableCategory | null>(null);
  const [summary, setSummary] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const ready = subjectLearnerId !== '' && category !== null && summary.trim().length > 0;

  return (
    <View className="gap-group pb-6">
      <View className="gap-element">
        <Text className="text-sm font-medium text-text">Who is this about?</Text>
        {loading ? <LoadingSkeleton variant="line" count={2} /> : null}
        {error !== null ? (
          <ErrorMessage message="We couldn’t load your learners. Close and reopen to try again." />
        ) : null}
        {!loading && error === null && learners.length === 0 ? (
          <Text variant="caption" tone="muted">
            No engaged learners are on your roster yet, so there is nobody to file about from
            here — anything urgent goes to your org’s safety lead, who can file it into triage.
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-element">
          {learners.map((learner) => {
            const active = learner.learnerId === subjectLearnerId;
            return (
              <Pressable
                key={learner.learnerId}
                onPress={() => {
                  setSubjectLearnerId(learner.learnerId);
                }}
                accessibilityState={{ selected: active }}
                className={`min-h-11 items-center justify-center rounded-md border-2 border-border px-3 py-2 ${
                  active ? 'bg-primary' : 'bg-surface'
                }`}
              >
                <Text className={`text-sm font-medium ${active ? 'text-on-primary' : 'text-text'}`}>
                  {learner.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-element">
        <Text className="text-sm font-medium text-text">What kind of concern?</Text>
        {REPORTABLE_OPTIONS.map((option) => {
          const active = option.value === category;
          return (
            <Pressable
              key={option.value}
              role="radio"
              aria-checked={active}
              onPress={() => {
                setCategory(option.value);
              }}
              accessibilityState={{ selected: active }}
              className={`min-h-11 gap-0.5 rounded-md border-2 px-3 py-2 ${
                active ? 'border-text bg-surface-raised' : 'border-border bg-surface'
              }`}
            >
              <Text className="text-sm font-medium text-text">{CATEGORY_LABEL[option.value]}</Text>
              <Text variant="caption" tone="muted">
                {option.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Textarea
        label="What did you see or hear?"
        hint="Just the facts you observed — no guesses about why."
        value={summary}
        onChangeText={setSummary}
        containerClassName="min-h-24"
      />

      <Textarea
        label="What did you do at the time? (optional)"
        value={actionTaken}
        onChangeText={setActionTaken}
        containerClassName="min-h-16"
      />

      <View className="gap-0.5">
        <Checkbox checked={anonymous} onChange={setAnonymous} label="File without my name" />
        {/*
          The warning is owed BEFORE the tick: an anonymous row drops the
          reporter id entirely (the stored promise), so it can never match the
          filed-list query — invisibility to the filer is the promise working,
          and finding out afterwards would read as a lost report.
        */}
        <Text variant="caption" tone="muted">
          An anonymous report keeps no link back to you — it won’t appear in this list, and
          nobody can restore that link later.
        </Text>
      </View>

      {/* §5.1's what-happens-next, stated before submit. */}
      <Text variant="caption" tone="muted">
        Reviewed by your org’s safety staff. How serious it is gets decided there, not here.
      </Text>

      {submit.error !== null ? (
        <ErrorMessage message="Your report wasn’t filed — everything you wrote is still here. Try again in a moment." />
      ) : null}

      <View className="flex-row gap-stack">
        <Button title="Cancel" variant="outline" className="flex-1" onPress={onDone} />
        <Button
          title="File report"
          className="flex-[2]"
          loading={submit.isPending}
          disabled={!ready}
          onPress={() => {
            if (category === null) return;
            submit.mutate(
              {
                subjectLearnerId,
                category,
                /*
                  Filed from the surface, timed at filing: the kit ships no
                  date control, and the SLA clock this feeds starts from a
                  moment triage can amend — a wrong "now" errs toward
                  answering SOONER, never later.
                */
                occurredAt: new Date().toISOString(),
                summary: summary.trim(),
                immediateActionTaken: actionTaken.trim().length > 0 ? actionTaken.trim() : null,
                anonymous,
              },
              {
                onSuccess: () => {
                  notify.success('Report filed', {
                    description: anonymous
                      ? 'It enters triage now. Filed anonymously, it won’t appear in your list.'
                      : 'It enters triage now and appears in your list below.',
                  });
                  onDone();
                },
              },
            );
          }}
        />
      </View>
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
  const intakeOpen = useTutorIncidentsStore((s) => s.intakeOpen);
  const setStatusFilter = useTutorIncidentsStore((s) => s.setStatusFilter);
  const toggleIncident = useTutorIncidentsStore((s) => s.toggleIncident);
  const openIntake = useTutorIncidentsStore((s) => s.openIntake);
  const closeIntake = useTutorIncidentsStore((s) => s.closeIntake);

  const visible =
    statusFilter === 'all'
      ? incidents
      : incidents.filter((incident) => incident.status === statusFilter);

  return (
    <View className="flex-1 gap-group">
      <Section className="gap-stack px-4 pt-4">
        <View className="flex-row items-start justify-between gap-stack">
          <View className="flex-1 gap-0.5">
            <Heading level={1} size="display-sm">
              Incidents
            </Heading>
            {/* No count in the caption — the no-badge law covers every tally.
                Scope is mine + my-sessions (ADR-110), and the caption says so:
                "you've filed" alone would deny half the list. */}
            <Text variant="caption" tone="muted">
              Reports you’ve filed and incidents on your sessions, and where each one stands.
            </Text>
          </View>
          {/* The contract's secondary action — outline weight, so opening a
              case stays the screen's primary act and nothing here shouts. */}
          <Button title="File a report" variant="outline" onPress={openIntake} />
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
        openIntake={openIntake}
      />

      {/*
        Mounted only while open, so closing is the one thing that discards a
        draft (store's own note) and reopening starts clean — a failed post
        keeps the sheet up and the state with it.
      */}
      {intakeOpen ? (
        <BottomSheet open onClose={closeIntake} title="Report a concern">
          <IntakeForm onDone={closeIntake} />
        </BottomSheet>
      ) : null}
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
  openIntake: () => void;
}

function Body({
  loading,
  error,
  retry,
  anyFiled,
  visible,
  openIncidentId,
  toggleIncident,
  openIntake,
}: BodyProps) {
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
      The contract's real empty state — "filing stays reachable from the empty
      state." ADR-108 opened the door the earlier deferral notice recorded, so
      the notice retires and the affordance takes its place.
    */
    return (
      <EmptyState
        className="flex-1"
        icon={<ShieldCheck size={28} className="text-text-muted" />}
        title="Nothing here yet"
        description="Reports you file and incidents on sessions you run appear here with their status and full timeline. If something crossed a line in a session, file it — how serious it is gets decided at triage, not by you."
        action={<Button title="File a report" variant="outline" onPress={openIntake} />}
      />
    );
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={<ShieldCheck size={28} className="text-text-muted" />}
        title="Nothing in this state"
        description="Clear the filter to see every report on your list."
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
