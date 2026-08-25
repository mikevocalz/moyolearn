'use client';
// AI activity & permissions — what the AI knows, said, and keeps.
//
// The calmest screen in the product by intent: no urgency, no nudge toward the
// permissive option, no dark pattern anywhere near a consent toggle. Every
// switch states its effect in the row, so consent is informed at the point of
// decision rather than in a policy the parent will never open.
// SOT: docs/pack/04-screen-briefs.md §S12
// SOT-KEYWORDS: ai activity permissions consent retention observation parent

import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, Dial, Heading, PressScale, Switch, Text, FadeIn } from '@acme/ui';
import { CHILDREN } from '../home/parent-home.data';
import { CONSENTS, OBSERVATIONS, RAW_ARTEFACTS } from './ai-activity.data';
import { useAiActivityStore } from './ai-activity.store';

export function AiActivityContent() {
  const router = useRouter();
  const values = useAiActivityStore((s) => s.values);
  const setConsent = useAiActivityStore((s) => s.setConsent);
  const selectedChildId = useAiActivityStore((s) => s.selectedChildId);
  const selectChild = useAiActivityStore((s) => s.selectChild);

  const activeChildId = selectedChildId ?? CHILDREN[0]?.id;

  return (
    <Dial temperature="cool" className="gap-7">
      <FadeIn>
        <Section className="gap-1">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">AI activity</Text>
          <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text md:text-3xl">
            What Natalie knows and keeps
          </Heading>
        </Section>
      </FadeIn>

      {CHILDREN.length > 1 ? (
        <FadeIn delay={80}>
          <View className="flex-row gap-2">
            {CHILDREN.map((child) => {
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
                  onPress={() => selectChild(child.id)}
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

      <FadeIn delay={160}>
        <Section className="gap-3">
          <Text variant="label" tone="muted">Permissions</Text>
          <View className="gap-2">
            {CONSENTS.map((consent) => (
              <Card key={consent.id} className="gap-2">
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
        <Section className="gap-3">
          <Text variant="label" tone="muted">What Natalie learned</Text>
          <View className="gap-2">
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
        <Section className="gap-3">
          <Text variant="label" tone="muted">What Natalie keeps</Text>
          <View className="gap-2">
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
