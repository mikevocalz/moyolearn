'use client';
// guardian.alerts — incidents + acknowledgments, and NOTHING else. The
// contract's law (doc 36 §3.2): this surface never sits under a bell and
// never mixes with general notifications — the NotificationsScreen alias it
// replaces was the product's most inverted defect (J8: the guardian half of
// the incident channel was server-complete and screen-absent).
//
// What renders, in the contract's terms:
//   · "Needs your attention" — unacknowledged incidents first, each in doc 31
//     §5.2's FIXED order: What happened → What the tutor did → What happens
//     next → Talk about it. Detail is in-screen (a card), never a separate
//     inventory row.
//   · Acknowledge — the primary action, writing `guardianAcknowledged`
//     through POST /api/guardian/incidents. Acknowledged incidents stay
//     visible below (append-only), each dated with when it was acknowledged.
//   · Empty state — "Nothing needs your attention": calm, explicit, DATED.
//     An empty Alerts tab is a feature, not a blank.
//   · No count badges, no red page-frames, severity never floods a row
//     (doc 31 screen constraints) — severity is triage's vocabulary and does
//     not render here at all; the category label carries what happened.
//
// Mobbin: https://mobbin.com/screens/fc7abc9f-8fe9-42a5-a06b-f65e08ebd412
// (Garmin Connect — "Attention required" card on a child-account surface:
// calm framing, plain words, one explicit action, no red flood) ·
// https://mobbin.com/screens/c97c5b47-31cd-4424-b427-2a540705bab4
// (Cleo AI — Alerts as date-grouped cards, each with a single quiet
// action button; the date line lives beside the content, not as urgency) ·
// https://mobbin.com/screens/8c8ee591-e847-40c7-9914-9ed803b0de3c
// (NordVPN — alert card anatomy: title, body, inline resolve action on the
// card itself rather than a separate detail route) ·
// https://mobbin.com/screens/27080236-6e39-4c13-aae6-0f8f698badd8
// (Yami — an alerts empty state as icon + one calm sentence, no drama).
// Structure only. Tones, type ramp and spacing tiers are docs 02/08.
// SOT: design/screens/guardian/guardian.alerts/contract.md · docs/pack/31-grade-voice-safety-incidents.md §5.2
// SOT-KEYWORDS: guardian alerts content incidents acknowledge needs attention empty dated

import { format } from 'date-fns';
import { useRouter } from 'solito/navigation';
import { Section, View } from '@acme/ui/tw';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  FadeIn,
  Heading,
  LoadingSkeleton,
  ReadFailure,
  Text,
} from '@acme/ui';
import { ShieldCheck } from '@acme/ui/icons';
import type { GuardianIncidentView } from './incidents.service.ts';
import { CATEGORY_LABEL } from './queue-view.ts';
import { useAcknowledgeIncident, useGuardianIncidents } from './use-guardian-incidents.ts';
import { readFailureCopy } from '../../core/read-failure-copy.ts';

const dateLine = (iso: string) => format(new Date(iso), 'EEEE, MMMM d');

/** One §5.2 section — heading and body, calm ramp, no tone escalation. */
function IncidentSection({ label, body }: { label: string; body: string }) {
  return (
    <View className="gap-0.5">
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Text>{body}</Text>
    </View>
  );
}

function IncidentCard({ incident }: { incident: GuardianIncidentView }) {
  const router = useRouter();
  const ack = useAcknowledgeIncident();
  const acknowledged = incident.acknowledgedAt !== null;

  return (
    <Card className="gap-stack">
      <View className="flex-row flex-wrap items-center gap-element">
        <Badge label={CATEGORY_LABEL[incident.category]} tone="neutral" />
        <Text variant="caption" tone="muted">
          {dateLine(incident.occurredAt)}
        </Text>
      </View>

      {/* Doc 31 §5.2's four sections, always in this order. */}
      <IncidentSection label="What happened" body={incident.whatHappened} />
      <IncidentSection label="What the tutor did" body={incident.whatTheTutorDid} />
      <IncidentSection label="What happens next" body={incident.whatHappensNext} />
      <IncidentSection label="Talk about it" body={incident.talkAboutIt} />

      {ack.isError ? (
        <ErrorMessage message="Your acknowledgment wasn’t sent — nothing was lost. Try again in a moment." />
      ) : null}

      {/*
        The contract's `adjust_controls` exit, on the card rather than in a
        toolbar: "what do I do now" is asked about ONE incident, and the answer
        is that child's settings. Ghost weight keeps Acknowledge the primary act
        — reading and acknowledging come first, changing settings is optional
        and afterwards.
      */}
      <View className="flex-row flex-wrap items-center gap-stack">
        {acknowledged ? (
          <Text variant="caption" tone="muted">
            Acknowledged {dateLine(incident.acknowledgedAt ?? incident.occurredAt)}
          </Text>
        ) : (
          <Button
            title="Acknowledge"
            variant="outline"
            loading={ack.isPending}
            onPress={() => ack.mutate({ incidentId: incident.incidentId })}
          />
        )}
        <Button
          title="Adjust settings"
          variant="ghost"
          onPress={() => {
            router.push('/children');
          }}
        />
      </View>
    </Card>
  );
}

export function GuardianAlertsContent() {
  const router = useRouter();
  const { incidents, loading, error, retry } = useGuardianIncidents();
  const open = incidents.filter((i) => i.acknowledgedAt === null);
  const acknowledged = incidents.filter((i) => i.acknowledgedAt !== null);

  if (loading) {
    return (
      <View className="gap-group">
        <Heading level={1} size="display-sm">Alerts</Heading>
        <LoadingSkeleton count={3} />
      </View>
    );
  }

  /*
    Error before empty, and on this surface it is the load-bearing rule: the
    calm state below says "nothing needs your attention", which on a SAFETY
    screen is the single most consequential sentence in the product. It may only
    be said about an answered read. A failed one says so, keeps the retry one
    press away, and points at the surface that still answers questions about a
    child (Family reads a different endpoint), so the screen is never a wall.
  */
  if (error !== null) {
    const copy = readFailureCopy(
      error,
      'your alerts',
      'This is a problem with the screen, not with your child: nothing on their record changed, and no alert was missed or cleared.',
    );
    return (
      <View className="gap-group">
        <Heading level={1} size="display-sm">Alerts</Heading>
        <ReadFailure
          title={copy.title}
          description={copy.description}
          onRetry={retry}
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
                title="Go to Family"
                variant="ghost"
                onPress={() => {
                  router.push('/children');
                }}
              />
            )
          }
        />
      </View>
    );
  }

  if (incidents.length === 0) {
    // The contract's no_data state, verbatim: calm, explicit, dated.
    return (
      <View className="gap-group">
        <Heading level={1} size="display-sm">Alerts</Heading>
        <EmptyState
          className="flex-1"
          icon={<ShieldCheck size={28} className="text-text-muted" />}
          title="Nothing needs your attention"
          description={`As of ${dateLine(new Date().toISOString())}, there are no incidents on your children’s records. If something serious ever happens in a session, it appears here first.`}
          /* An empty safety screen still owes somewhere to go — the settings
             that decide what a session may do are the useful next step when
             there is nothing to read. */
          action={
            <Button
              title="Review your children’s settings"
              variant="outline"
              onPress={() => {
                router.push('/children');
              }}
            />
          }
        />
      </View>
    );
  }

  return (
    <View className="gap-group">
      <FadeIn>
        <Heading level={1} size="display-sm">Alerts</Heading>
      </FadeIn>

      {open.length > 0 ? (
        <FadeIn delay={60}>
          <Section className="gap-stack">
            <Text variant="label" tone="muted">Needs your attention</Text>
            <View className="gap-stack">
              {open.map((incident) => (
                <IncidentCard key={incident.incidentId} incident={incident} />
              ))}
            </View>
          </Section>
        </FadeIn>
      ) : (
        <FadeIn delay={60}>
          <Text variant="caption" tone="muted">
            Nothing needs your attention as of {dateLine(new Date().toISOString())}. Everything
            below has been acknowledged.
          </Text>
        </FadeIn>
      )}

      {acknowledged.length > 0 ? (
        <FadeIn delay={120}>
          <Section className="gap-stack">
            <Text variant="label" tone="muted">Acknowledged</Text>
            <View className="gap-stack">
              {acknowledged.map((incident) => (
                <IncidentCard key={incident.incidentId} incident={incident} />
              ))}
            </View>
          </Section>
        </FadeIn>
      ) : null}
    </View>
  );
}
