'use client';
// AI activity & permissions — what the AI knows, said, and keeps, and whether it
// is running at all.
//
// The calmest screen in the product by intent: no urgency, no nudge toward the
// permissive option, no dark pattern anywhere near a consent toggle. Every
// switch states its effect in the row, so consent is informed at the point of
// decision rather than in a policy the parent will never open.
//
// It is also where doc 12 §5's other half surfaces. The rule reads "tutoring
// pauses — 'Natalie is taking a break' (never an error screen at a child),
// guardian-visible status", and only the child's half was built: the paused
// state lived in `useTutorStore`, on the child's device, and ended with the tab.
// From the kitchen table a tutor that has silently stopped working and a child
// who has silently stopped trying look identical.
//
// The status leads the screen. Permissions and memory are things a parent came
// here to READ; a stopped tutor is a thing they need to be TOLD.
//
// A GUARDIAN surface, and it renders inside the same `(site)` shell a learner
// uses — so nothing here is a price, a plan, or an upgrade. The section below
// adds a status and an alert list and no action that costs money.
// SOT: docs/pack/04-screen-briefs.md §S12 · docs/pack/07-security-child-ai-safety-spec.md §S26 · docs/pack/12-systems-design-prompt.md §5
// SOT-KEYWORDS: ai activity permissions consent retention observation parent safety status paused alert crisis guardian

import { useEffect } from 'react';
import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, Dial, Heading, PressScale, Switch, Text, FadeIn } from '@acme/ui';
// Child selection rides family.store (G-8 fix) — this screen no longer owns
// "which child"; it reads the same seam home, reports, and calendar read.
import { useActiveLearnerId, useFamilyStore } from '../family/family.store';
import { CONSENTS, OBSERVATIONS, RAW_ARTEFACTS } from './ai-activity.data';
import { useAiActivityStore } from './ai-activity.store';
import { SafetySection } from './safety-section';

export function AiActivityContent() {
  const router = useRouter();
  const values = useAiActivityStore((s) => s.values);
  const setConsent = useAiActivityStore((s) => s.setConsent);
  const children = useFamilyStore((s) => s.children);
  const selectLearner = useFamilyStore((s) => s.selectLearner);
  const activeChildId = useActiveLearnerId();
  const safety = useAiActivityStore((s) => s.safety);
  const loadSafety = useAiActivityStore((s) => s.loadSafety);

  // On mount, not on an interval. A pause is read when a parent opens the
  // screen; polling a household's safety status in the background is a
  // different product with a different consent conversation.
  useEffect(() => {
    void loadSafety();
  }, [loadSafety]);

  return (
    <Dial temperature="cool" className="gap-7">
      <FadeIn>
        <Section className="gap-1">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">AI activity</Text>
          <Heading level={1} size="title">
            What Natalie knows and keeps
          </Heading>
        </Section>
      </FadeIn>

      {children.length > 1 ? (
        <FadeIn delay={80}>
          <View className="flex-row gap-element">
            {children.map((child) => {
              const active = child.id === activeChildId;
              return (
                <PressScale
                  key={child.id}
                  className={`flex-1 items-center rounded-card border-2 px-3 py-2 ${
                    active ? 'border-border bg-primary shadow-card' : 'border-border bg-surface-raised'
                  }`}
                  outerClassName="flex-1"
                  aria-label={child.name}
                  aria-selected={active}
                  onPress={() => selectLearner(child.id)}
                >
                  <TWText className={active ? 'font-semibold text-on-primary' : 'text-text'}>
                    {child.name}
                  </TWText>
                </PressScale>
              );
            })}
          </View>
        </FadeIn>
      ) : null}

      <FadeIn delay={120}>
        <SafetySection safety={safety} />
      </FadeIn>

      <FadeIn delay={160}>
        <Section className="gap-stack">
          <Text variant="label" tone="muted">Permissions</Text>
          <View className="gap-element">
            {CONSENTS.map((consent) => (
              <Card key={consent.id} className="gap-element">
                <Switch
                  label={consent.label}
                  value={values[consent.id] ?? false}
                  disabled={consent.locked}
                  onChange={(next) => setConsent(consent.id, next)}
                />
                <TWText className="text-sm text-text-muted">{consent.effect}</TWText>
              </Card>
            ))}
          </View>
        </Section>
      </FadeIn>

      <FadeIn delay={240}>
        <Section className="gap-stack">
          <Text variant="label" tone="muted">What Natalie learned</Text>
          <View className="gap-element">
            {OBSERVATIONS.map((observation) => (
              <View
                key={observation.id}
                className="gap-0.5 rounded-card border-2 border-border bg-surface-raised p-3"
              >
                <TWText className="text-base text-text">{observation.summary}</TWText>
                <TWText className="text-sm text-text-muted">{observation.source}</TWText>
              </View>
            ))}
          </View>
          {/* The preview stops here. Every line is erasable, but erasing happens
              on S27, which shows the whole model and what a delete takes with it —
              a delete offered next to three of six rows would be a delete whose
              reach the parent cannot see. */}
          <Button
            title="See everything Natalie remembers"
            variant="outline"
            onPress={() => router.push('/memory')}
          />
        </Section>
      </FadeIn>

      <FadeIn delay={320}>
        <Section className="gap-stack">
          <Text variant="label" tone="muted">What Natalie keeps</Text>
          <View className="gap-element">
            {RAW_ARTEFACTS.map((artefact) => (
              <View
                key={artefact.id}
                className="flex-row items-center justify-between rounded-card border-2 border-border bg-surface-raised p-3"
              >
                <TWText className="flex-1 text-base text-text">{artefact.label}</TWText>
                <TWText className="text-sm text-text-muted">{artefact.expiresLabel}</TWText>
              </View>
            ))}
          </View>
          <TWText className="text-sm text-text-muted">
            Transcripts are deleted on the date shown. What stays is the short summary above.
          </TWText>
        </Section>
      </FadeIn>
    </Dial>
  );
}
