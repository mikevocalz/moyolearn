'use client';
// Session Prep — give the human tutor a 30-second readiness read.
// SOT: docs/pack/04-screen-briefs.md §S5
// SOT-KEYWORDS: session prep mastery misconception provenance example learner

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Card, Heading, Text, FadeIn } from '@acme/ui';
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
          {/* The tutor-today fixture label, verbatim — this read is demo data
              (session-prep.data), not a real learner's derived observations. */}
          <TWText className="text-label text-grade">Example learner</TWText>
        </Section>
      </FadeIn>

      <FadeIn delay={80}>
        <Card className="gap-4">
          <Text variant="label" tone="muted">Mastery</Text>
          <View className="gap-stack">
            {SESSION_PREP.mastery.map((item) => {
              const delta = item.value - item.previous;
              /*
                A dipping skill fills highlighter, never redpen: this bar is
                about a child, and red on a child's mastery reads as a verdict.
                The tutor-incidents STATUS_TONE rule generalises — calm tones
                only; attention without alarm is the highlighter's whole job
                (doc 08 §4.8, the Badge `attention` reasoning). The delta text
                stays in plain ink for the same reason.
              */
              const barColor = item.tone === 'grade' ? 'bg-grade' : 'bg-highlighter';
              const textColor = item.tone === 'grade' ? 'text-grade' : 'text-text';
              return (
                <View key={item.skill} className="gap-1">
                  <View className="flex-row items-center justify-between">
                    <TWText className="text-base text-text">{item.skill}</TWText>
                    <View className="flex-row items-center gap-element">
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
        <Card className="gap-stack">
          <Text variant="label" tone="muted">Likely misconceptions</Text>
          <View className="flex-row flex-wrap gap-element">
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
        {/*
          Decision: no "Generate session plan" button. No plan-generation
          endpoint exists (nothing in the API surface produces one), so the old
          primary rendered as the screen's biggest promise and did nothing.
          Removed rather than disabled: a permanent primary that never enables
          is a dead button wearing a reason. The read above IS the prep; the
          button returns with the endpoint.
        */}
        <TWText className="text-center text-sm text-text-muted">{SESSION_PREP.provenance}</TWText>
      </FadeIn>
    </View>
  );
}
