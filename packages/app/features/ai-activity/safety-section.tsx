'use client';
// Doc 12 §5's guardian-visible status, drawn.
//
// Two things, in the order a parent needs them: is the tutor running RIGHT NOW,
// and has anything happened that they should know about. The first is the gap
// this section exists to close — the pause was child-facing only, so an adult
// had no way to tell a stopped tutor from a child who had stopped working.
//
// The copy rules are doc 07 §S26's: plain, non-clinical, and it never blames the
// child. Every alert says what the SYSTEM did — "Stopped the session", "Showed
// crisis resources" — because a parent's first question is whether their child
// was left alone with it, and the answer is no. The wording is not written here;
// it comes from `guardianAlert()` in `@acme/safety`, which is the same content
// the crisis protocol publishes.
//
// Colour follows §S12: "cool dial; redpen reserved for crisis category only".
// A safety block is highlighter, a paused tutor is highlighter, and `danger` is
// spent on nothing but the one category where it is the truth.
// Mobbin: https://mobbin.com/screens/fc7abc9f-8fe9-42a5-a06b-f65e08ebd412 (Garmin
// Connect "Child Account" — the state of the child's account is a card ABOVE the
// settings list, not a row inside it, which is why the status leads this section
// rather than sitting under the permissions) ·
// https://mobbin.com/screens/58c1de3e-56c9-499e-8a38-bad6ad447257 (Yahoo Finance
// "Recent Activity" — a sentence of plain-language framing, then a bounded card
// of events; the framing is what stops a list of incidents reading as an
// accusation) ·
// https://mobbin.com/screens/15c79bf7-aefd-4302-9c03-fa9313bd599b (Binance
// "Account Activity" — every row led by its own status marker and dated, so a
// reader scans state first and detail second) ·
// https://mobbin.com/screens/82db51a1-86ac-4346-8b83-90512207f494 (Greenlight
// "Family" — stacked status cards for a household, and where the one-child case
// still reads as a card rather than as a banner)
// Structure only. The dial, the ink borders, the badge tones and the spacing
// tiers are docs 02/08 and are not from any of these.
// SOT: docs/pack/04-screen-briefs.md §S12 · docs/pack/07-security-child-ai-safety-spec.md §S26 · docs/pack/12-systems-design-prompt.md §5
// SOT-KEYWORDS: safety section guardian status paused alerts crisis boundary ai activity screen

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Badge, Button, Card, LoadingSkeleton, ReadFailure, Text } from '@acme/ui';
import { readFailureCopy } from '../../core/read-failure-copy.ts';
import type { SafetyAlertSummary } from './safety-status.service';
import type { SafetyStatusState } from './ai-activity.store';

/**
 * Doc 07 §S26 again: redpen is the crisis category and nothing else. `attention`
 * is the highlighter — doc 08 §4.8's needs-attention tone — because a blocked
 * reply is something to read, not something anybody got wrong.
 */
const TONE = {
  crisis: 'danger',
  safety: 'attention',
  boundary: 'neutral',
} as const satisfies Record<SafetyAlertSummary['alert']['category'], string>;

const LABEL = {
  crisis: 'Crisis',
  safety: 'Safety',
  boundary: 'Boundary',
} as const satisfies Record<SafetyAlertSummary['alert']['category'], string>;

/** "4:12 PM" — the wall clock a parent would use to ask their child about it. */
const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const day = (iso: string): string =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

export interface SafetySectionProps {
  safety: SafetyStatusState;
  /** Re-runs the status read in place. A failure without one is a dead end. */
  onRetry: () => void;
  /** The way out of an expired session, which no retry can fix. */
  onSignIn: () => void;
}

export function SafetySection({ safety, onRetry, onSignIn }: SafetySectionProps) {
  return (
    <Section className="gap-stack">
      <Text variant="label" tone="muted">Safety</Text>
      <StatusCard safety={safety} onRetry={onRetry} onSignIn={onSignIn} />
      {safety.kind === 'ready' ? <AlertList alerts={safety.status.alerts} /> : null}
    </Section>
  );
}

function StatusCard({ safety, onRetry, onSignIn }: SafetySectionProps) {
  if (safety.kind === 'idle' || safety.kind === 'loading') {
    return <LoadingSkeleton variant="card" />;
  }

  /*
    "We could not check" is its own answer and gets its own card.

    The tempting shape is to render the calm state whenever there is no bad news,
    and it is wrong here in a way it is not wrong anywhere else on this screen: a
    parent reading "Tutoring is running normally" has been TOLD something, and if
    the read failed we did not know it.
  */
  if (safety.kind === 'unreachable') {
    /*
      The retry is the point. This card said "pull it up again in a moment" and
      gave the reader nothing to pull with, so the honest state still ended in a
      dead end — and when the cause was an expired session, "in a moment" was
      advice that fails identically forever. `readFailureCopy` picks the sentence
      from the status; `ReadFailure` supplies the marker and the retry.
    */
    const failure = readFailureCopy(
      safety.error,
      'Natalie’s status',
      'Nothing has changed for your child.',
    );
    return (
      <ReadFailure
        title={failure.title}
        description={failure.description}
        onRetry={onRetry}
        action={
          failure.signedOut ? (
            <Button variant="primary" title="Sign in" onPress={onSignIn} />
          ) : undefined
        }
      />
    );
  }

  const { paused, pausedSince } = safety.status;

  if (!paused) {
    return (
      <Card className="gap-element">
        <Badge label="Running" tone="success" />
        <TWText className="text-base text-text">Natalie is working normally.</TWText>
        <TWText className="text-sm text-text-muted">
          Every message your child sends is checked before it reaches her, and every reply is checked
          before it reaches them.
        </TWText>
      </Card>
    );
  }

  return (
    <Card className="gap-element">
      <Badge label="On a break" tone="attention" />
      <TWText className="text-base text-text">
        Natalie has stopped tutoring{pausedSince ? ` since ${clock(pausedSince)}` : ''}.
      </TWText>
      {/*
        The reason, in the terms doc 12 §5 puts it: this is the one place in the
        product where availability is traded for safety on purpose, and a parent
        is owed that sentence rather than an apology for an outage.
      */}
      <TWText className="text-sm text-text-muted">
        One of the checks that reads her messages isn’t answering, so she stops rather than reply
        unchecked. Your child sees “Natalie is taking a break” — not an error — and their work is
        saved. Nothing they did caused this.
      </TWText>
    </Card>
  );
}

function AlertList({ alerts }: { alerts: readonly SafetyAlertSummary[] }) {
  if (alerts.length === 0) {
    return (
      <TWText className="text-sm text-text-muted">
        Nothing has needed your attention. Everyday off-topic chat isn’t listed here — a curious kid
        is a normal kid.
      </TWText>
    );
  }

  return (
    <View className="gap-element">
      {alerts.map((entry) => (
        <Card key={entry.eventId} className="gap-element">
          <View className="flex-row items-center gap-element">
            <Badge label={LABEL[entry.alert.category]} tone={TONE[entry.alert.category]} />
            <TWText className="text-sm text-text-muted">
              {day(entry.alert.at)} · {clock(entry.alert.at)}
            </TWText>
          </View>
          {/*
            What WE did, never what the child did. The list is the protocol's own
            steps, so a parent reading it is reading the thing that actually ran.
          */}
          <View className="gap-element">
            {entry.alert.whatWeDid.map((step) => (
              <TWText key={step} className="text-base text-text">
                {step}
              </TWText>
            ))}
          </View>
          {entry.alert.excerptAvailable ? (
            <TWText className="text-sm text-text-muted">
              The conversation is saved, and you can read it even while transcript privacy is on.
            </TWText>
          ) : null}
        </Card>
      ))}
    </View>
  );
}
