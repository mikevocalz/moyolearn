'use client';
// Student plan — "What do I have to do?" as one mixed timeline.
// Rendered as a LIST, not a grid: screen readers need reading order to match
// chronological order, and a grid reads column-major (S8 A11y).
// SOT: docs/pack/04-screen-briefs.md §S8
// SOT-KEYWORDS: student plan week strip agenda timeline join practice

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, Heading, PressScale, Text, FadeIn } from '@acme/ui';
import { useRouter } from 'solito/router';
import { usePlanStore } from './plan.store';
import { PLAN_WEEK, type PlanTimelineItem } from './plan.data';

export function PlanContent() {
  const selectedDayId = usePlanStore((s) => s.selectedDayId);
  const selectDay = usePlanStore((s) => s.selectDay);
  const router = useRouter();

  const activeId = selectedDayId ?? PLAN_WEEK[0]!.id;
  const day = PLAN_WEEK.find((d) => d.id === activeId) ?? PLAN_WEEK[0]!;

  return (
    <View className="gap-7">
      <FadeIn>
        <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text md:text-3xl">
          Your plan
        </Heading>
      </FadeIn>

      {/* WeekStrip */}
      <FadeIn delay={80}>
        <View className="flex-row gap-2">
          {PLAN_WEEK.map((d) => {
            const active = d.id === activeId;
            return (
              <PressScale
                key={d.id}
                className={`flex-1 items-center gap-1 rounded-card border-2 px-2 py-3 ${
                  active ? 'border-border bg-primary shadow-card' : 'border-border bg-surface-raised'
                }`}
                outerClassName="flex-1"
                aria-label={`${d.label}, ${d.items.length} items`}
                aria-selected={active}
                onPress={() => selectDay(d.id)}
              >
                <TWText className={`text-xs ${active ? 'text-on-primary/80' : 'text-text-muted'}`}>
                  {d.weekday}
                </TWText>
                <TWText className={`text-lg font-bold ${active ? 'text-on-primary' : 'text-text'}`}>
                  {d.dayOfMonth}
                </TWText>
              </PressScale>
            );
          })}
        </View>
      </FadeIn>

      {/* Agenda */}
      <FadeIn delay={160}>
        <Section className="gap-3">
          <Text variant="label" tone="muted">{day.label}</Text>
          {day.items.length > 0 ? (
            <View className="gap-2">
              {day.items.map((item) => (
                <PlanRow key={item.id} item={item} onOpen={() => router.push('/tutor')} />
              ))}
            </View>
          ) : (
            <TWText className="text-body text-text-muted">
              Nothing planned. Want to get ahead? Natalie has a 10-minute challenge.
            </TWText>
          )}
        </Section>
      </FadeIn>
    </View>
  );
}

function PlanRow({ item, onOpen }: { item: PlanTimelineItem; onOpen: () => void }) {
  return (
    <PressScale
      className="w-full flex-row items-center gap-3 rounded-card border-2 border-border bg-surface-raised p-3 shadow-card"
      outerClassName="w-full"
      aria-label={`${item.title}, ${item.dueLabel}`}
      onPress={onOpen}
    >
      {/* The child always knows who is on the other side: a human tutor's
          avatar, or the presence mark for AI practice. */}
      {item.tutorName ? (
        <Avatar name={item.tutorName} size="sm" />
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
          <TWText className="text-sm font-bold text-on-primary">N</TWText>
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <TWText className={`text-base ${item.done ? 'text-text-muted line-through' : 'text-text'}`}>
          {item.title}
        </TWText>
        <TWText className="text-sm text-text-muted">{item.dueLabel}</TWText>
      </View>
      <TWText className="text-sm font-semibold text-text">
        {item.joinable ? 'Join session' : item.kind === 'practice' ? 'Start practice' : 'Open'}
      </TWText>
    </PressScale>
  );
}
