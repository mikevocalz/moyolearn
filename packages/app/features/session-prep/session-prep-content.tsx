'use client';
// Session Prep — give the human tutor a 30-second readiness read.
// SOT: docs/pack/04-screen-briefs.md §S5
// SOT-KEYWORDS: session prep mastery misconception generate plan

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Card, Heading, PressScale, Text, FadeIn } from '@acme/ui';
import { SESSION_PREP } from './session-prep.data';

export function SessionPrepContent() {
  const studentName = SESSION_PREP.studentName;

  return (
    <View className="gap-7">
      <FadeIn>
        <Section className="gap-1">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">Session prep</Text>
          <Heading level={1} size="title">
            {studentName}
          </Heading>
        </Section>
      </FadeIn>

      <FadeIn delay={80}>
        <Card className="gap-4">
          <Text variant="label" tone="muted">Mastery</Text>
          <View className="gap-3">
            {SESSION_PREP.mastery.map((item) => {
              const delta = item.value - item.previous;
              const barColor = item.tone === 'grade' ? 'bg-grade' : 'bg-redpen';
              const textColor = item.tone === 'grade' ? 'text-grade' : 'text-redpen';
              return (
                <View key={item.skill} className="gap-1">
                  <View className="flex-row items-center justify-between">
                    <TWText className="text-base text-text">{item.skill}</TWText>
                    <View className="flex-row items-center gap-2">
                      <TWText className={`font-semibold ${textColor}`}>
                        {delta > 0 ? '+' : ''}{delta}%
                      </TWText>
                      <TWText className="text-text-muted">{item.value}%</TWText>
                    </View>
                  </View>
                  <View className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                    <View className={`h-full rounded-full ${barColor}`} style={{ width: `${item.value}%` }} />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      </FadeIn>

      <FadeIn delay={160}>
        <Card className="gap-3">
          <Text variant="label" tone="muted">Likely misconceptions</Text>
          <View className="flex-row flex-wrap gap-2">
            {SESSION_PREP.misconceptions.map((chip) => (
              <View
                key={chip}
                className="rounded-full border-2 border-border bg-surface-raised px-3 py-1.5"
              >
                <TWText className="text-sm text-text">{chip}</TWText>
              </View>
            ))}
          </View>
        </Card>
      </FadeIn>

      <FadeIn delay={240}>
        <PressScale
          className="w-full items-center rounded-card bg-primary p-4 shadow-card"
          outerClassName="w-full"
          onPress={() => { /* Wave 3: generate plan */ }}
        >
          <TWText className="font-semibold text-on-primary">Generate session plan</TWText>
        </PressScale>
        <TWText className="text-center text-sm text-text-muted">{SESSION_PREP.provenance}</TWText>
      </FadeIn>
    </View>
  );
}
