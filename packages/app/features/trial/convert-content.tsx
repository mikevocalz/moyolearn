'use client';
// S17 · Ops trial status & convert — sell the subscription with the business's
// own trial data (doc 05 §6). Cool dial: this is an operator's screen.
//
// Mobbin: https://mobbin.com/flows/b4a00fe2-ccb6-4578-82e1-80a0ee83c8cf (Docusign
// Plan and billing — days left as a labelled FRACTION ("4/14") beside the plan,
// with the end stated as a real date rather than a bare countdown) ·
// https://mobbin.com/flows/e397d64a-e966-450c-8fb9-d1c7630c8ab7 (Juicebox — the
// gated feature states its gate ON the feature card, so a plan limit is read
// before it is hit, never discovered at the moment of use) ·
// https://mobbin.com/flows/31c813ee-6ada-4fed-945a-f72c713c01d8 (Railway — a
// persistent trial chip in the chrome plus one in-context banner with the action
// on the right; the chip informs, the banner asks). Structure only; style stays
// on docs 02/08.
// SOT: docs/pack/05-monetization-access-spec.md §6 S17 · §2.3
// SOT-KEYWORDS: trial convert s17 ops stats tiers upgrade grace export chip

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, Dial, FadeIn, Heading, Text } from '@acme/ui';
import { PLANS, plansFor, type PlanName } from '@acme/auth';
import { MILESTONES, milestoneProgress, type ActivationState } from './milestones';
import { tierGateNote, trialSentence, trialStats } from './convert';

export interface ConvertProps {
  activation: ActivationState;
  daysLeft: number | null;
  endsAt: string | null;
  onChoosePlan: (plan: PlanName) => void;
  /** Doc 05 §6: export stays visible after expiry, always. */
  onExport: () => void;
}

export function ConvertContent({
  activation,
  daysLeft,
  endsAt,
  onChoosePlan,
  onExport,
}: ConvertProps) {
  const stats = trialStats(activation);
  const { done, total } = milestoneProgress(activation);
  const expired = daysLeft !== null && daysLeft <= 0;

  return (
    <Dial temperature="cool">
      <View className="gap-group">
        <FadeIn>
          <Section className="gap-stack">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text md:text-3xl">
              {trialSentence(daysLeft, endsAt)}
            </Heading>
            {/* Docusign's fraction: "4 of 14" is a position, a bare "4" is a
                threat. The milestone count rides alongside because doc 05 §2.3
                is what actually predicts conversion. */}
            <Text variant="label" tone="muted">
              {daysLeft === null
                ? `${done} of ${total} set up`
                : `Day ${Math.max(0, 30 - daysLeft)} of 30 · ${done} of ${total} set up`}
            </Text>
          </Section>
        </FadeIn>

        {stats.length > 0 ? (
          <Card className="gap-stack">
            <Text variant="label" tone="muted">
              What you built during the trial
            </Text>
            {/* Their fortnight, above the prices. An empty metric is left out
                entirely rather than shown as a zero — see trialStats. */}
            {stats.map((stat) => (
              <View key={stat.label} className="flex-row items-baseline gap-element">
                <TWText className="font-display text-body-lg font-bold text-text">
                  {stat.value}
                </TWText>
                <TWText className="text-body text-text">{stat.label}</TWText>
              </View>
            ))}
          </Card>
        ) : null}

        <View className="gap-stack">
          {plansFor('organization').map((plan) => (
            <Card key={plan.name} className="gap-stack">
              <View className="flex-row items-baseline justify-between gap-element">
                <TWText className="text-body font-semibold text-text">{TIER_TITLES[plan.name]}</TWText>
                <TWText className="font-display text-body-lg font-bold text-text">
                  {TIER_PRICES[plan.name]}
                </TWText>
              </View>
              {/* Juicebox: the gate is stated here, not discovered at the pay run. */}
              <TWText className="text-body text-text">
                {tierGateNote(PLANS[plan.name].limits.payoutAutomation)}
              </TWText>
              <Button title={`Choose ${TIER_TITLES[plan.name]}`} onPress={() => onChoosePlan(plan.name)} />
            </Card>
          ))}
        </View>

        {/* Read-only grace + export, visible whether or not the trial has run
            out (doc 05 §6). Showing it only after expiry would make "everything
            you've set up stays" a claim a business has to take on trust. */}
        <Card className="gap-stack">
          <TWText className="text-body text-text">
            {expired
              ? 'Your account is read-only. Everything is still here, and you can export it now or after you subscribe.'
              : 'Whatever happens, your data stays and you can export it any time.'}
          </TWText>
          <Button variant="outline" title="Export everything" onPress={onExport} />
        </Card>
      </View>
    </Dial>
  );
}

const TIER_TITLES: Record<PlanName, string> = {
  'family-early-bird': 'Founding family',
  family: 'Family',
  'ops-solo': 'Solo',
  'ops-studio': 'Studio',
  'ops-scale': 'Scale',
};

/** Display copy paired with the plan the server charges — see paywall.data.ts. */
const TIER_PRICES: Record<PlanName, string> = {
  'family-early-bird': '$11/month',
  family: '$15.99/month',
  'ops-solo': '$19/month',
  'ops-studio': '$99/month',
  'ops-scale': '$299/month',
};

/**
 * The rail chip (doc 05 §6: "banner chip in the rail — days left + milestone
 * progress"). Railway keeps this in the chrome at all times; it informs, and the
 * convert screen is where the asking happens.
 */
export function TrialRailChip({
  activation,
  daysLeft,
  onOpen,
}: {
  activation: ActivationState;
  daysLeft: number | null;
  onOpen: () => void;
}) {
  const { done, total } = milestoneProgress(activation);
  const label =
    daysLeft === null
      ? `${done}/${total} set up`
      : daysLeft <= 0
        ? `Trial ended · ${done}/${total} set up`
        : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left · ${done}/${total} set up`;

  return (
    <View className="flex-row items-center justify-between gap-element rounded-card border-2 border-border bg-surface-sunken p-inset-tight">
      <TWText className="text-caption text-text">{label}</TWText>
      {/* Railway puts the action on the right of the banner; the chip is not
          itself the button, so a glance costs nothing and a tap is deliberate. */}
      <Button variant="ghost" size="sm" title="See plans" onPress={onOpen} />
    </View>
  );
}

export { MILESTONES };
