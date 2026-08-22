'use client';
// Parent home — "Is my child on track, and what do I need to take care of?"
// SOT: docs/pack/04-screen-briefs.md §S11
// SOT-KEYWORDS: parent home guardian child summary action needed upcoming

import { ArrowRight } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, Card, Dial, Heading, PressScale, Text, FadeIn } from '@acme/ui';
import { useAppSession } from '../../providers/session';
import {
  CHILDREN,
  THIS_WEEK,
  NEEDS_ATTENTION,
  ACTION_ITEMS,
  UPCOMING,
} from './parent-home.data';

export function ParentHomeContent() {
  const { user } = useAppSession();
  const name = user?.name?.split(' ')[0] ?? 'there';

  return (
    <Dial temperature="cool" className="gap-7">
      <FadeIn>
        <Section className="flex-row flex-wrap items-baseline gap-x-2">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">Hi</Text>
          <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text md:text-3xl">
            {name}
          </Heading>
        </Section>
      </FadeIn>

      {/* Child summary cards */}
      <FadeIn delay={80}>
        <Section className="gap-3">
          <Text variant="label" tone="muted">Your children</Text>
          <View className="gap-2">
            {CHILDREN.map((child) => (
              <PressScale
                key={child.id}
                className="w-full rounded-card border-2 border-border bg-surface-raised p-4 shadow-card"
                outerClassName="w-full"
                onPress={() => { /* Wave 3: child detail */ }}
              >
                <View className="flex-row items-center gap-3">
                  <Avatar name={child.name} size="md" />
                  <View className="flex-1 gap-0.5">
                    <TWText className="text-base font-semibold text-text">{child.name}</TWText>
                    <TWText className="text-sm text-text-muted">
                      {child.gradeBand} · {child.status}
                    </TWText>
                  </View>
                  <ArrowRight size={18} className="text-text-muted" />
                </View>
              </PressScale>
            ))}
          </View>
        </Section>
      </FadeIn>

      {/* This week */}
      <FadeIn delay={160}>
        <Card className="gap-3">
          <Text variant="label" tone="muted">This week</Text>
          <View className="flex-row gap-2">
            <Stat value={THIS_WEEK.sessions} label="Sessions" />
            <Stat value={THIS_WEEK.assignments} label="Assignments" />
            <Stat value={THIS_WEEK.aiPractice} label="AI practice" />
          </View>
        </Card>
      </FadeIn>

      {/* Needs attention */}
      {NEEDS_ATTENTION.length > 0 ? (
        <FadeIn delay={240}>
          <Card className="gap-3 border-2 border-redpen/20 bg-redpen/5">
            <Text variant="label" tone="muted">Needs attention</Text>
            <View className="gap-1">
              {NEEDS_ATTENTION.map((item) => (
                <TWText key={item} className="text-base text-text">
                  • {item}
                </TWText>
              ))}
            </View>
          </Card>
        </FadeIn>
      ) : null}

      {/* Action needed */}
      <FadeIn delay={320}>
        <Section className="gap-3">
          <Text variant="label" tone="muted">Action needed</Text>
          <View className="gap-2">
            {ACTION_ITEMS.map((item) => (
              <PressScale
                key={item.id}
                className="w-full rounded-card border-2 border-border bg-surface-raised p-3 shadow-card"
                outerClassName="w-full"
                onPress={() => { /* Wave 3: resolve action */ }}
              >
                <View className="flex-row items-center justify-between">
                  <TWText className="flex-1 text-base text-text">{item.label}</TWText>
                  <TWText className="text-sm text-text-muted">{item.due}</TWText>
                </View>
              </PressScale>
            ))}
          </View>
        </Section>
      </FadeIn>

      {/* Upcoming */}
      <FadeIn delay={400}>
        <Section className="gap-3">
          <Text variant="label" tone="muted">Upcoming</Text>
          <View className="gap-2">
            {UPCOMING.map((item) => (
              <View
                key={item.id}
                className="rounded-card border-2 border-border bg-surface-raised p-3"
              >
                <View className="flex-row items-center justify-between">
                  <TWText className="text-base text-text">{item.title}</TWText>
                  <TWText className="text-sm text-text-muted">{item.time}</TWText>
                </View>
              </View>
            ))}
          </View>
        </Section>
      </FadeIn>
    </Dial>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="min-w-24 flex-1 gap-1 rounded-card border-2 border-border bg-surface-raised p-3 text-center">
      <TWText className="font-display text-2xl font-bold text-text">{value}</TWText>
      <TWText className="text-sm text-text-muted">{label}</TWText>
    </View>
  );
}
