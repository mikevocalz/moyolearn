'use client';
// Moyo Science Lab: a real subject hub, not a menu of external simulation iframes.
// All activities share the app's design tokens and work on web, native and tablets.
// SOT: docs/compute/moyo-science-lab.md
// SOT-KEYWORDS: science lab subjects chemistry biology physics earth cross-platform learner curriculum

import { useState } from 'react';
import { useRouter } from 'solito/navigation';
import { Button, Card, Container, FadeIn, Heading, PressScale, Text } from '@acme/ui';
import { View, ScrollView, Section, Text as TWText } from '@acme/ui/tw';
import { useAppSession } from '../../providers/session';
import { bandScaleFor, type AgeBand } from '../capture/age-band';
import { SCIENCE_SUBJECTS, type ScienceSubject } from './science.models';
import { ChemistryExperiment, BiologyExperiment, PhysicsExperiment, EarthExperiment } from './science-experiments';

export function ScienceLabScreen() {
  const { activeContext, status } = useAppSession();
  const router = useRouter();
  const [subject, setSubject] = useState<ScienceSubject>('chemistry');
  const ageBand: AgeBand = activeContext.gradeBand ?? 'teen';
  const scale = bandScaleFor(ageBand);
  const advanced = ageBand === 'teen' || ageBand === 'adult';

  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="gap-group py-6 pb-48">
          {status === 'loading' ? (
            <Card><Text tone="muted">Opening your science lab…</Text></Card>
          ) : (
            <>
              <FadeIn>
                <Section className="gap-element">
                  <Text variant="label" tone="muted">DISCOVER · EXPERIMENT · EXPLAIN</Text>
                  <Heading level={1} size={scale.title}>Moyo Science Lab</Heading>
                  <Text tone="muted">
                    {ageBand === 'young'
                      ? 'Choose a science question. See what happens.'
                      : 'Make a prediction, change one thing, observe the evidence and explain what changed.'}
                  </Text>
                </Section>
              </FadeIn>
              <Section className="gap-stack">
                <Heading level={2} size="title">Choose a subject</Heading>
                <View className="flex-row flex-wrap gap-element">
                  {SCIENCE_SUBJECTS.map((item) => (
                    <PressScale
                      key={item.id}
                      outerClassName="min-w-40 flex-1 basis-[42%]"
                      className={`w-full ${scale.target} ${scale.inset} gap-element rounded-card border-2 border-border ${subject === item.id ? 'bg-primary shadow-card' : 'bg-surface-raised'}`}
                      aria-label={`Explore ${item.title}`}
                      aria-selected={subject === item.id}
                      onPress={() => setSubject(item.id)}
                    >
                      <TWText className={`font-display text-xl ${subject === item.id ? 'text-on-primary' : 'text-text'}`}>
                        {item.symbol}
                      </TWText>
                      <TWText className={`font-semibold ${subject === item.id ? 'text-on-primary' : 'text-text'}`}>
                        {item.title}
                      </TWText>
                      <TWText className={subject === item.id ? 'text-on-primary' : 'text-text-muted'}>
                        {item.subtitle}
                      </TWText>
                    </PressScale>
                  ))}
                </View>
              </Section>

              <FadeIn key={subject}>
                <Section className="gap-stack">
                  {subject === 'chemistry' ? <ChemistryExperiment ageBand={ageBand} /> : null}
                  {subject === 'biology' ? <BiologyExperiment ageBand={ageBand} /> : null}
                  {subject === 'physics' ? <PhysicsExperiment ageBand={ageBand} /> : null}
                  {subject === 'earth' ? <EarthExperiment ageBand={ageBand} /> : null}
                </Section>
              </FadeIn>

              {subject === 'chemistry' && advanced ? (
                <FadeIn>
                  <Card className="gap-stack">
                    <Text variant="label" tone="muted">ADVANCED MOLECULAR COMPUTING</Text>
                    <Heading level={2} size="title">From atoms to electronic energies</Heading>
                    <Text tone="muted">
                      Use Microsoft QDK/Chemistry to compare calculated energies
                      for two hydrogen bond lengths. This is a classical scientific
                      calculation, not a quantum computer.
                    </Text>
                    <Button variant="outline" title="Open QDK Chemistry Lab" onPress={() => router.push('/chemistry-lab')} />
                  </Card>
                </FadeIn>
              ) : null}

              <Card className="gap-element">
                <Heading level={2} size="title">Think like a scientist</Heading>
                <Text>
                  Notice what you changed, what stayed the same, and what the
                  experiment does not prove. Natalie can help you reason through
                  your homework in Tutor Room without doing it for you.
                </Text>
                <Button variant="outline" title="Ask Natalie about my science work" onPress={() => router.push('/tutor')} />
              </Card>
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}
