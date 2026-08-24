'use client';
// The in-app cancellation (doc 05 §1.2's ARL standard, doc 06 §4's "in-app
// one-tap cancel"). Two steps, because doc 05 §6 measures this in seconds and
// the step count is what a second is spent on.
//
// What is deliberately absent is the design: no retention offer, no "are you
// sure you want to lose…", no survey, no downgrade ladder, no discount. Every
// one of those is a step, and the ARL standard exists because they were the
// industry norm. The only thing between a guardian and a cancelled subscription
// is one confirmation that states what they keep.
//
// Mobbin: https://mobbin.com/flows/fc0c2fbf-85c9-4d0b-be17-49d6027b23eb (KOHO —
// "Cancel any time · no penalties or fees" as a plain block; the same sentence
// appears on our paywall and here, so the promise and the act use one wording).
// Structure only; style stays on docs 02/08.
// SOT: docs/pack/05-monetization-access-spec.md §1.2 · §6
// SOT-KEYWORDS: cancel subscription arl in-app one-tap retention confirm guardian

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, Heading, Text } from '@acme/ui';
import { cancellationOutcome, cancellationSummary, type SubscriptionState } from '@acme/auth';
import { formatTrialDate } from './paywall.data';

export interface CancelProps {
  subscription: SubscriptionState;
  /** Step one of two. The caller cancels through Stripe and lands on the webhook. */
  onConfirm: () => void;
  onKeep: () => void;
  /** True once the webhook has settled — step two of two. */
  cancelled?: boolean;
}

export function CancelContent({ subscription, onConfirm, onKeep, cancelled }: CancelProps) {
  const outcome = cancellationOutcome(subscription);
  const summary = cancellationSummary(outcome, formatTrialDate);

  if (cancelled) {
    return (
      <Card className="gap-stack">
        <Heading level={2} size="display-sm" className="text-xl font-semibold text-text">
          Cancelled
        </Heading>
        {/* H1: the state changed and it says so, with the same sentence the
            confirmation used — one wording for one fact. */}
        <TWText role="status" className="text-body text-text">
          {summary}
        </TWText>
        <TWText className="text-body text-text">
          Your family&apos;s work stays here, and you can export it any time.
        </TWText>
        <Button title="Done" onPress={onKeep} />
      </Card>
    );
  }

  return (
    <Section className="gap-group">
      <Heading level={2} size="display-sm" className="text-xl font-semibold text-text">
        Cancel your subscription?
      </Heading>

      <Card className="gap-stack">
        {/* What you keep, before what you lose. The dates are the evidence. */}
        <TWText className="text-body text-text">{summary}</TWText>
        <TWText className="text-body text-text">
          Everything you&apos;ve set up stays, and your child keeps free practice.
        </TWText>
        {outcome.accessUntil ? (
          <Text variant="label" tone="muted">
            After {formatTrialDate(outcome.accessUntil)} the account is read-only, and export stays
            available.
          </Text>
        ) : null}
      </Card>

      {/* Cancel is the primary action here: it is what the guardian came to do,
          and making "Keep" the loud one is the pattern the ARL rule names. */}
      <View className="gap-stack">
        <Button variant="danger" size="lg" fullWidth title="Cancel subscription" onPress={onConfirm} />
        <Button variant="ghost" fullWidth title="Keep it for now" onPress={onKeep} />
      </View>
    </Section>
  );
}
