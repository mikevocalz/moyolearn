'use client';
// Student plan — "What do I have to do?" as one mixed timeline.
// Rendered as a LIST, not a grid: screen readers need reading order to match
// chronological order, and a grid reads column-major (S8 A11y).
// SOT: docs/pack/04-screen-briefs.md §S8
// SOT-KEYWORDS: student plan week strip agenda timeline join practice

import { useMemo } from 'react';
import { Check } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, Heading, PressScale, Text, FadeIn } from '@acme/ui';
import { useRouter } from 'solito/navigation';
import { usePlanStore } from './plan.store';
import {
  useLearnerAssignments,
  useMarkAssignmentDone,
} from '../assignments/use-learner-assignments';
import { mergeAssignmentsIntoWeek, PLAN_WEEK, type PlanTimelineItem } from './plan.data';

export function PlanContent() {
  const selectedDayId = usePlanStore((s) => s.selectedDayId);
  const selectDay = usePlanStore((s) => s.selectDay);
  const router = useRouter();

  // Real published assignments, bucketed by dueAt into the week's mixed
  // timeline; sessions/practice are still the fixture scaffold (see plan.data).
  const { assignments } = useLearnerAssignments();
  const markDone = useMarkAssignmentDone();
  const week = useMemo(() => mergeAssignmentsIntoWeek(PLAN_WEEK, assignments), [assignments]);

  const activeId = selectedDayId ?? week[0]!.id;
  const day = week.find((d) => d.id === activeId) ?? week[0]!;

  return (
    <View className="gap-7">
      <FadeIn>
        <Heading level={1} size="title">
          Your plan
        </Heading>
      </FadeIn>

      {/* WeekStrip */}
      <FadeIn delay={80}>
        <View className="flex-row gap-element">
          {week.map((d) => {
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
        <Section className="gap-stack">
          <Text variant="label" tone="muted">{day.label}</Text>
          {day.items.length > 0 ? (
            <View className="gap-element">
              {day.items.map((item) => (
                <PlanRow
                  key={item.id}
                  item={item}
                  onOpen={() => router.push(item.kind === 'practice' ? '/practice' : '/tutor')}
                  onMarkDone={(assignmentId) => markDone.mutate(assignmentId)}
                  markPending={markDone.isPending}
                />
              ))}
            </View>
          ) : (
            // Contract copy, verbatim — calm empty state, no manufactured
            // urgency (learner.plan no_data path).
            <TWText className="text-body text-text-muted">Nothing due — nice.</TWText>
          )}
        </Section>
      </FadeIn>
    </View>
  );
}

function PlanRow({
  item,
  onOpen,
  onMarkDone,
  markPending,
}: {
  item: PlanTimelineItem;
  onOpen: () => void;
  onMarkDone: (assignmentId: string) => void;
  markPending: boolean;
}) {
  /* The child always knows who is on the other side: a human tutor's
     avatar, or the presence mark for AI practice. */
  const face = (
    <>
      {item.tutorName ? (
        <Avatar name={item.tutorName} size="sm" />
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
          <TWText className="text-sm font-bold text-on-primary">N</TWText>
        </View>
      )}
      <View className="flex-1 gap-0.5">
        {/* Done keeps the title's normal face — no strikethrough, no fading
            the child's own work out. The supporting line simply says so. */}
        <TWText className="text-base text-text">{item.title}</TWText>
        <TWText className="text-sm text-text-muted">{item.done ? 'Done' : item.dueLabel}</TWText>
      </View>
    </>
  );

  if (item.kind !== 'assignment' || item.assignmentId === undefined) {
    return (
      <PressScale
        className="w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-3 shadow-card"
        outerClassName="w-full"
        aria-label={`${item.title}, ${item.dueLabel}`}
        onPress={onOpen}
      >
        {face}
        <TWText className="text-sm font-semibold text-text">
          {item.joinable ? 'Join session' : item.kind === 'practice' ? 'Start practice' : 'Open'}
        </TWText>
      </PressScale>
    );
  }

  /*
    Assignment rows carry their own trailing action, so open and mark-done are
    SIBLING pressables inside a plain row — on web PressScale renders a real
    <button>, and a button inside a button is invalid, not just awkward.
    The done state is a quiet checkmark: a state change, never a celebration —
    no confetti, no streak, nothing that turns "I did my homework" into a
    mechanic (children's-surfaces law).
  */
  return (
    <View className="w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-3 shadow-card">
      <PressScale
        className="flex-1 flex-row items-center gap-stack"
        outerClassName="flex-1"
        aria-label={`${item.title}, ${item.done ? 'done' : item.dueLabel}`}
        onPress={onOpen}
      >
        {face}
      </PressScale>
      {item.done ? (
        <View
          className="h-6 w-6 items-center justify-center rounded-full border-2 border-grade bg-grade"
          aria-label="Done"
        >
          <Check size={14} className="text-on-primary" />
        </View>
      ) : (
        <PressScale
          className="rounded-md border-2 border-border px-3 py-1.5"
          outerClassName="self-center"
          aria-label={`Mark ${item.title} done`}
          disabled={markPending}
          onPress={() => onMarkDone(item.assignmentId!)}
        >
          <TWText className="text-sm font-semibold text-text">Mark done</TWText>
        </PressScale>
      )}
    </View>
  );
}
