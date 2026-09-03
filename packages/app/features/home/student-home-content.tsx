'use client';
// Student home — the child sees "what now?" in one glance.
//
// Two bands render this component and the contract gives them different
// screens (learner.home §Band variants). 3–5 gets "resume card present but
// simpler, 56px targets, no Progress entry"; 6–12 gets the resume-first home
// with due work and the see-all drill into the plan. Before this, both got the
// identical teen screen at hardcoded sizes — including an "Improvement moment"
// percentage, which is a Progress element handed to the band the contract keeps
// Progress away from.
//
// The greeting is a heading with a purpose line under it, not a bare name: the
// screen has to say what it is for in one line before it asks for a tap.
//
// The due-work read now has a visible failure. It used to be destructured for
// its list alone, so a failed `/api/learner/assignments` rendered as an empty
// strip — "you have nothing due" said on the strength of a request that never
// came back.
// Mobbin: Skillshare resume-first home (mobbin.com/screens/eaa37d84-6ac3-44d2-a888-35e0198919db) ·
// Babbel learner shell (mobbin.com/screens/af715e9f-3b74-4de5-b014-55fa6748aa34) ·
// Duolingo lead card over a quiet library (mobbin.com/screens/e2e48fe1-3128-4f46-bfc0-fedb163d7987)
// SOT: docs/pack/04-screen-briefs.md §S7 · design/screens/learner/learner.home/contract.md
// SOT-KEYWORDS: student home learner continue next session today plan improvement band child teen states

import { useMemo } from 'react';
import { ArrowRight, Check, FileUp, Star } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import {
  Avatar,
  Banner,
  Button,
  Card,
  FadeIn,
  Heading,
  LoadingSkeleton,
  PressScale,
  ReadFailure,
  Text,
} from '@acme/ui';
import { useRouter } from 'solito/navigation';
import { useAppSession } from '../../providers/session';
import { useLearnerAssignments } from '../assignments/use-learner-assignments';
import { readFailureCopy } from '../../core/read-failure-copy.ts';
import { useIsOnline } from '../../core/use-is-online.ts';
import { bandScaleFor, type AgeBand } from '../capture/age-band';
import { dueLabelFor, isDueSoon } from '../plan/plan.data';
import { NEXT_SESSION, IMPROVEMENT, studentHomeFixtureFor } from './student-home.data';

/** The purpose line under the greeting, in the band's register (doc 31 voice gate). */
const PURPOSE = {
  young: 'Pick up where you stopped.',
  child: 'Here is what to do next.',
  teen: 'Where you left off, and what is coming up.',
  adult: 'Where you left off, and what is coming up.',
} as const satisfies Record<AgeBand, string>;

export function StudentHomeContent() {
  const { user, activeContext } = useAppSession();
  const router = useRouter();
  const ageBand: AgeBand = activeContext.gradeBand ?? 'teen';
  const scale = bandScaleFor(ageBand);
  const online = useIsOnline();
  // Demo content is band-scoped too: a 3–5 home showing "Continue: Factoring"
  // is the band bug wearing fixture clothes (student-home.data).
  const { continueSkill, planItems } = studentHomeFixtureFor(ageBand);

  /*
    Due work is a 6–12 surface. The gate is the EXPLICIT teen|adult pair, not
    `!isYoung`: 3–5 (`child`) renders this same component — learner-today only
    forks K–2 off to the hub — and the learner.home band variants give 3–5 a
    simpler home with no due-work strip and no `see_all_plan` exit (plan is
    6–12 only). The hook takes the gate as `enabled`, so the bands that must
    not see due work never even fetch it.
  */
  const showsDueWork = ageBand === 'teen' || ageBand === 'adult';
  const { assignments, loading, error, retry } = useLearnerAssignments(showsDueWork);
  // Done work leaves the due-soon strip entirely: this strip answers "what do
  // I still owe?", and a finished item is no longer due work. Its calm done
  // state lives on the plan, where the whole week stays visible.
  const dueWork = useMemo(
    () => (showsDueWork ? assignments.filter((a) => a.doneAt === null && isDueSoon(a.dueAt)) : []),
    [assignments, showsDueWork],
  );

  const failure = readFailureCopy(
    error,
    'what is due',
    'Nothing has changed about your work.',
  );

  return (
    <View className={scale.gap}>
      <FadeIn>
        <Section className="gap-element">
          <Heading level={1} size={scale.title}>
            Hi {user?.name?.split(' ')[0] ?? 'there'}
          </Heading>
          <Text tone="muted" className={scale.lead}>
            {PURPOSE[ageBand]}
          </Text>
        </Section>
      </FadeIn>

      {!online ? (
        <FadeIn>
          <Banner
            tone="offline"
            title="No connection"
            description="You can still pick up where you left off. New work arrives when you are back online."
          />
        </FadeIn>
      ) : null}

      {/* Continue learning — the one primary action. First tap lands in the
          work, which is what `max_interactions_to_primary: 1` means here. */}
      <FadeIn delay={80}>
        <PressScale
          className={`w-full gap-stack rounded-card bg-primary shadow-card ${scale.target} ${scale.inset}`}
          outerClassName="w-full"
          onPress={() => router.push('/tutor')}
          aria-label={`Continue ${continueSkill.title}`}
        >
          <View className="flex-row items-start justify-between gap-stack">
            <View className="flex-1 gap-1">
              <TWText className="text-caption font-semibold uppercase tracking-wider text-on-primary/70">
                Continue
              </TWText>
              <TWText className="font-display text-display-sm font-bold text-on-primary">
                {continueSkill.title}
              </TWText>
              <TWText className="text-body text-on-primary/90">{continueSkill.subtitle}</TWText>
            </View>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-ink-50/10">
              <FileUp size={24} className="text-on-primary" />
            </View>
          </View>
          <View className="flex-row items-center gap-1.5">
            <TWText className="text-label font-semibold text-on-primary">Resume</TWText>
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
              <TWText className={`font-semibold text-text ${scale.rowTitle}`}>
                {NEXT_SESSION.tutorName}
              </TWText>
              <TWText className="text-body text-text-muted">{NEXT_SESSION.timeLabel}</TWText>
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
                className="min-h-target-adult justify-center rounded-md px-2"
                outerClassName="self-start"
                aria-label="See the whole plan"
                onPress={() => router.push('/plan')}
              >
                <Text variant="caption" className="font-bold text-text underline">See all</Text>
              </PressScale>
            ) : null}
          </View>

          {showsDueWork && loading ? (
            <LoadingSkeleton count={2} className="h-12" />
          ) : showsDueWork && error !== null && assignments.length === 0 ? (
            /* A failed read is not an empty strip. The fixture rows below still
               render, so this labels the part that did not arrive rather than
               taking over the screen. */
            <ReadFailure
              className="p-inset"
              title={failure.title}
              description={failure.description}
              onRetry={retry}
              action={
                failure.signedOut ? (
                  <Button variant="outline" title="Sign in" onPress={() => router.push('/')} />
                ) : undefined
              }
            />
          ) : null}

          <View className="gap-element">
            {/* Real published assignments due today/soon, first in the same
                mixed list as the fixture rows — never a segregated
                "assignments" block (plan.data's one-timeline law). Past-due
                renders the same calm row; the label never says "late". */}
            {dueWork.map((assignment) => (
              <PressScale
                key={`assignment-${assignment.id}`}
                className={`flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised shadow-card ${scale.target} ${scale.inset}`}
                outerClassName="w-full"
                aria-label={`${assignment.title}, ${dueLabelFor(assignment.dueAt)}`}
                onPress={() => router.push('/tutor')}
              >
                <View className="h-6 w-6 items-center justify-center rounded-full border-2 border-text-muted" />
                <View className="flex-1 gap-0.5">
                  <TWText className={`text-text ${scale.rowTitle}`}>{assignment.title}</TWText>
                  <TWText className="text-body text-text-muted">{dueLabelFor(assignment.dueAt)}</TWText>
                </View>
              </PressScale>
            ))}
            {planItems.map((item) => (
              <PressScale
                key={item.id}
                className={`flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised shadow-card ${scale.target} ${scale.inset}`}
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
                <TWText className={`flex-1 text-text ${scale.rowTitle} ${item.done ? 'text-text-muted' : ''}`}>
                  {item.label}
                </TWText>
              </PressScale>
            ))}
          </View>
        </Section>
      </FadeIn>

      {/* Improvement moment — a Progress element, and the contract gives
          Progress to 6–12 alone. A percentage delta on a 3–5 home is a score
          shown to the band that has no Progress surface to read it in. */}
      {showsDueWork ? (
        <FadeIn delay={320}>
          <Card className="gap-stack">
            <View className="flex-row items-center gap-element">
              <Star size={18} className="text-grade" />
              <Text variant="label" tone="muted">Improvement moment</Text>
            </View>
            <View className="flex-row items-baseline gap-element">
              <TWText className="font-display text-display-md font-bold text-grade">
                +{IMPROVEMENT.delta}%
              </TWText>
              <TWText className="text-text-muted">on {IMPROVEMENT.skill}</TWText>
            </View>
            <TWText className="text-text-muted">
              {IMPROVEMENT.previous}% → {IMPROVEMENT.current}%
            </TWText>
          </Card>
        </FadeIn>
      ) : null}
    </View>
  );
}

function CheckIcon() {
  return <Check size={14} className="text-on-primary" />;
}
