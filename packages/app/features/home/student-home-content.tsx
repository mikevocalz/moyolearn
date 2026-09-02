'use client';
// Student home — the child sees "what now?" in one glance.
// SOT: docs/pack/04-screen-briefs.md §S7
// SOT-KEYWORDS: student home learner continue next session today plan improvement

import { useMemo } from 'react';
import { ArrowRight, Check, FileUp, Star } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, Card, Heading, PressScale, Text, FadeIn } from '@acme/ui';
import { useRouter } from 'solito/navigation';
import { useAppSession } from '../../providers/session';
import { useLearnerAssignments } from '../assignments/use-learner-assignments';
import { dueLabelFor, isDueSoon } from '../plan/plan.data';
import { PLAN_ITEMS, NEXT_SESSION, CONTINUE_SKILL, IMPROVEMENT } from './student-home.data';

export function StudentHomeContent() {
  const { user, activeContext } = useAppSession();
  const router = useRouter();

  /*
    Due work is a 6–12 surface. The gate is the EXPLICIT teen|adult pair, not
    `!isYoung`: 3–5 (`child`) renders this same component — learner-today only
    forks K–2 off to the hub — and the learner.home band variants give 3–5 a
    simpler home with no due-work strip and no `see_all_plan` exit (plan is
    6–12 only). The hook takes the gate as `enabled`, so the bands that must
    not see due work never even fetch it.
  */
  const showsDueWork = activeContext.gradeBand === 'teen' || activeContext.gradeBand === 'adult';
  const { assignments } = useLearnerAssignments(showsDueWork);
  // Done work leaves the due-soon strip entirely: this strip answers "what do
  // I still owe?", and a finished item is no longer due work. Its calm done
  // state lives on the plan, where the whole week stays visible.
  const dueWork = useMemo(
    () => (showsDueWork ? assignments.filter((a) => a.doneAt === null && isDueSoon(a.dueAt)) : []),
    [assignments, showsDueWork],
  );

  return (
    <View className="gap-7">
      <FadeIn>
        <Section className="flex-row flex-wrap items-baseline gap-x-2">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">Hi</Text>
          <Heading level={1} size="title">
            {user?.name?.split(' ')[0] ?? 'there'}
          </Heading>
        </Section>
        <TWText className="text-label text-grade">Example day</TWText>
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
        <Card className="gap-stack">
          <Text variant="label" tone="muted">Next session</Text>
          <View className="flex-row items-center gap-stack">
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
        <Section className="gap-stack">
          <View className="flex-row items-center justify-between">
            <Text variant="label" tone="muted">Today&apos;s plan</Text>
            {/* See-all drills into /plan, a 6–12-only route — same gate as the
                due-work rows above it, so 3–5 never grows a dead exit. */}
            {showsDueWork ? (
              <PressScale
                className="rounded-md px-2 py-1"
                outerClassName="self-start"
                aria-label="See the whole plan"
                onPress={() => router.push('/plan')}
              >
                <Text variant="caption" className="font-bold text-text underline">See all</Text>
              </PressScale>
            ) : null}
          </View>
          <View className="gap-element">
            {/* Real published assignments due today/soon, first in the same
                mixed list as the fixture rows — never a segregated
                "assignments" block (plan.data's one-timeline law). Past-due
                renders the same calm row; the label never says "late". */}
            {dueWork.map((assignment) => (
              <PressScale
                key={`assignment-${assignment.id}`}
                className="flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-3 shadow-card"
                outerClassName="w-full"
                aria-label={`${assignment.title}, ${dueLabelFor(assignment.dueAt)}`}
                onPress={() => router.push('/tutor')}
              >
                <View className="h-6 w-6 items-center justify-center rounded-full border-2 border-text-muted" />
                <View className="flex-1 gap-0.5">
                  <TWText className="text-base text-text">{assignment.title}</TWText>
                  <TWText className="text-sm text-text-muted">{dueLabelFor(assignment.dueAt)}</TWText>
                </View>
              </PressScale>
            ))}
            {PLAN_ITEMS.map((item) => (
              <PressScale
                key={item.id}
                className="flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-3 shadow-card"
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
        <Card className="gap-stack">
          <View className="flex-row items-center gap-element">
            <Star size={18} className="text-grade" />
            <Text variant="label" tone="muted">Improvement moment</Text>
          </View>
          <View className="flex-row items-baseline gap-element">
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
  return <Check size={14} className="text-on-primary" />;
}
