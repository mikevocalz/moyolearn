'use client';
// S16 · Family paywall / trial start — convert at the Day-0 value moment without
// a single dark pattern (doc 05 §6).
//
// Mobbin: https://mobbin.com/flows/5ecff1f1-28a5-4473-b73b-9d908acf7d8e (Quizlet
// — two plan cards, then a DATED timeline of how the trial works: instant access
// today, a reminder email on a named date, the charge on a named date. It is the
// structure that turns "30-day free trial" from a slogan into a disclosure) ·
// https://mobbin.com/flows/fc0c2fbf-85c9-4d0b-be17-49d6027b23eb (KOHO — "Cancel
// any time · no penalties or fees" sits as its own block under the CTA, not as
// fine print beside it) · https://mobbin.com/flows/917b11e2-a362-4d82-8cc4-f62a4b81419a
// (Sunlitt — "No Payment Now" and "$0.00 today" state the charge as a number
// rather than an absence; what we borrow is the honesty, not the toggle it wraps).
// Structure only; style stays on docs 02/08.
// SOT: docs/pack/05-monetization-access-spec.md §6 S16
// SOT-KEYWORDS: paywall s16 trial start plan family early bird terms cancel guardian

import { useState } from 'react';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, Dial, FadeIn, Heading, PressScale, Text } from '@acme/ui';
import { trialSchedule, TRIAL_REMINDER_DAYS_BEFORE, type PlanName } from '@acme/auth';
import { formatTrialDate, PAYWALL_OFFERS } from './paywall.data';

export interface PaywallProps {
  /** Starts the trial for the chosen plan. Resolves once the plugin's wrapped
   *  success URL has settled the subscription (doc 06 §4's race hygiene). */
  onStartTrial: (plan: PlanName) => void;
  /** Doc 05 §6: "Continue with free practice" — the child's floor is never hostage. */
  onContinueFree: () => void;
}

export function PaywallContent({ onStartTrial, onContinueFree }: PaywallProps) {
  const [selected, setSelected] = useState<PlanName>(PAYWALL_OFFERS[0]!.plan);
  const schedule = trialSchedule(selected);

  return (
    <Dial temperature="hot">
      <View className="gap-group">
        <Section className="gap-stack">
          <Heading level={1} size="display-sm" className="font-display text-3xl font-bold text-text">
            Try the whole thing free for {schedule.days} days
          </Heading>
          <TWText className="text-body-lg text-text">
            Every child in your family, the full tutor, nothing held back. Cancel in the app in two
            taps.
          </TWText>
        </Section>

        <View className="gap-stack">
          {PAYWALL_OFFERS.map((offer) => {
            const on = selected === offer.plan;
            return (
              <PressScale
                key={offer.plan}
                onPress={() => setSelected(offer.plan)}
                accessibilityState={{ selected: on }}
                className={[
                  'min-h-target-adult rounded-card border-2 p-inset',
                  on ? 'border-strong bg-surface-raised' : 'border-border bg-surface-raised',
                ].join(' ')}
              >
                <View className="flex-row items-baseline justify-between gap-element">
                  <TWText className="text-body font-semibold text-text">{offer.title}</TWText>
                  <TWText className="font-display text-body-lg font-bold text-text">
                    {offer.monthly}
                  </TWText>
                </View>
                <TWText className="text-body text-text">{offer.promise}</TWText>
                {/* Billing frequency is never the thing left out. */}
                <TWText className="text-caption text-text-muted">{offer.billed}</TWText>
                {offer.terms ? (
                  // Real text at body size, not gray fine print (doc 05 §6 A11y).
                  <TWText className="text-body text-text">{offer.terms}</TWText>
                ) : null}
              </PressScale>
            );
          })}
        </View>

        <TrialTimeline schedule={schedule} />

        <Section className="gap-stack">
          {/* The button says what happens. One primary action on the screen. */}
          <Button
            size="xl"
            fullWidth
            title={`Start ${schedule.days}-day free trial`}
            onPress={() => onStartTrial(selected)}
          />
          {/* KOHO gives this its own block under the CTA rather than burying it
              beside the price. It is also the ARL promise, so it is stated at
              full contrast where the commitment is made. */}
          <TWText className="text-body text-text">
            Cancel any time in the app. No penalties, no phone call, no fees.
          </TWText>
          {/* Doc 05 §6: the child's free practice floor is always the way out,
              and it is a real action, not a dismissible sheet. */}
          <Button variant="ghost" fullWidth title="Continue with free practice" onPress={onContinueFree} />
        </Section>
      </View>
    </Dial>
  );
}

/**
 * Quizlet's dated timeline, which is the difference between a slogan and a
 * disclosure. Every row is a date the system will actually act on — the reminder
 * is scheduled, not promised — and the charge is stated as a date and a number
 * so nobody has to count 30 days from today in their head.
 */
function TrialTimeline({ schedule }: { schedule: ReturnType<typeof trialSchedule> }) {
  return (
    <Card className="gap-stack">
      <Text variant="label" tone="muted">
        How the free trial works
      </Text>

      <View className="gap-element">
        <TWText className="text-body font-semibold text-text">Today</TWText>
        <TWText className="text-body text-text">
          Everything unlocks. Nothing is charged — you pay $0.00 now.
        </TWText>
      </View>

      <View className="gap-element">
        <TWText className="text-body font-semibold text-text">
          {formatTrialDate(schedule.reminderAt)}
        </TWText>
        <TWText className="text-body text-text">
          We email you {TRIAL_REMINDER_DAYS_BEFORE} days before it ends, so the date never arrives
          as a surprise.
        </TWText>
      </View>

      {/* Doc 05 §6: the trial end date is the ONE highlighter block on this
          screen — the thing regulators and parents both care about. */}
      <View className="gap-element rounded-card bg-highlighter p-inset-tight">
        <TWText className="text-body font-semibold text-text">
          {formatTrialDate(schedule.endsAt)}
        </TWText>
        <TWText className="text-body text-text">
          Your trial ends and the first payment is taken, unless you cancel before this date.
        </TWText>
      </View>
    </Card>
  );
}
