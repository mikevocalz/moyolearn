'use client';
// Student home — the child sees "what now?" in one glance.
// SOT: docs/pack/04-screen-briefs.md §S7
// SOT-KEYWORDS: student home learner continue next session today plan improvement

import { ArrowRight, FileUp, Star } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, Card, Heading, PressScale, Text, FadeIn } from '@acme/ui';
import { useRouter } from 'solito/navigation';
import { useAppSession } from '../../providers/session';
import { PLAN_ITEMS, NEXT_SESSION, CONTINUE_SKILL, IMPROVEMENT } from './student-home.data';

export function StudentHomeContent() {
  const { user } = useAppSession();
  const router = useRouter();

  return (
    <View className="gap-7">
      <FadeIn>
        <Section className="flex-row flex-wrap items-baseline gap-x-2">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">Hi</Text>
          <Heading level={1} size="title">
            {user?.name?.split(' ')[0] ?? 'there'}
          </Heading>
        </Section>
      </FadeIn>

      {/* Continue learning — resumes the skill, first tap lands in the work */}
      <FadeIn delay={80}>
        <PressScale
          className="w-full gap-4 rounded-card bg-primary p-6 shadow-card"
          outerClassName="w-full"
          onPress={() => router.push('/tutor')}
          aria-label={`Continue ${CONTINUE_SKILL.title}`}
        >
          <View className="flex-row items-start justify-between">
            <View className="gap-1">
              <TWText className="text-xs font-semibold uppercase tracking-wider text-on-primary/70">Continue</TWText>
              <TWText className="font-display text-3xl font-bold text-on-primary">{CONTINUE_SKILL.title}</TWText>
              <TWText className="text-sm text-on-primary/90">{CONTINUE_SKILL.subtitle}</TWText>
            </View>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-ink-50/10">
              <FileUp size={24} className="text-on-primary" />
            </View>
          </View>
          <View className="flex-row items-center gap-1.5">
            <TWText className="text-sm font-semibold text-on-primary">Resume</TWText>
            <ArrowRight size={14} className="text-on-primary" />
          </View>
        </PressScale>
      </FadeIn>

      {/* Next session */}
      <FadeIn delay={160}>
        <Card className="gap-3">
          <Text variant="label" tone="muted">Next session</Text>
          <View className="flex-row items-center gap-3">
            <Avatar name={NEXT_SESSION.tutorName} size="md" />
            <View className="flex-1 gap-0.5">
              <TWText className="text-base font-semibold text-text">{NEXT_SESSION.tutorName}</TWText>
              <TWText className="text-sm text-text-muted">{NEXT_SESSION.timeLabel}</TWText>
            </View>
          </View>
        </Card>
      </FadeIn>

      {/* Today's plan */}
      <FadeIn delay={240}>
        <Section className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text variant="label" tone="muted">Today&apos;s plan</Text>
            <PressScale
              className="rounded-md px-2 py-1"
              outerClassName="self-start"
              aria-label="See the whole plan"
              onPress={() => router.push('/plan')}
            >
              <Text variant="caption" className="font-bold text-text underline">See all</Text>
            </PressScale>
          </View>
          <View className="gap-2">
            {PLAN_ITEMS.map((item) => (
              <PressScale
                key={item.id}
                className="flex-row items-center gap-3 rounded-card border-2 border-border bg-surface-raised p-3 shadow-card"
                outerClassName="w-full"
                onPress={item.href ? () => router.push(item.href!) : undefined}
              >
                <View
                  className={`h-6 w-6 rounded-full border-2 ${
                    item.done ? 'border-grade bg-grade' : 'border-text-muted'
                  } items-center justify-center`}
                >
                  {item.done ? <CheckIcon /> : null}
                </View>
                <TWText className={`flex-1 text-base ${item.done ? 'text-text-muted line-through' : 'text-text'}`}>
                  {item.label}
                </TWText>
              </PressScale>
            ))}
          </View>
        </Section>
      </FadeIn>

      {/* Improvement moment */}
      <FadeIn delay={320}>
        <Card className="gap-3">
          <View className="flex-row items-center gap-2">
            <Star size={18} className="text-grade" />
            <Text variant="label" tone="muted">Improvement moment</Text>
          </View>
          <View className="flex-row items-baseline gap-2">
            <TWText className="font-display text-4xl font-bold text-grade">+{IMPROVEMENT.delta}%</TWText>
            <TWText className="text-text-muted">on {IMPROVEMENT.skill}</TWText>
          </View>
          <TWText className="text-text-muted">{IMPROVEMENT.previous}% → {IMPROVEMENT.current}%</TWText>
        </Card>
      </FadeIn>
    </View>
  );
}

function CheckIcon() {
  return <View className="h-3 w-3 rounded-full bg-on-primary" />;
}
