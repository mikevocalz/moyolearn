'use client';
// Student home — the child sees "what now?" in one glance.
//
// Two bands render this component and the contract gives them different screens
// (learner.home §Band variants). 3–5 gets the simpler home: the hero alone, no
// due-work strip and no plan exit. 6–12 gets the hero plus due work and the
// see-all drill into the plan.
//
// The greeting is a heading with a purpose line under it, not a bare name: the
// screen has to say what it is for in one line before it asks for a tap.
//
// EVERY VALUE ON THIS SCREEN IS READ, NOT FIXTURE. The hero comes from the same
// adaptive picker the tutor session uses, and its `source` decides what the
// hero is allowed to claim — a seeded skill is a starting point for a learner
// with no facts, and describing it as work the child was doing would invent a
// history. The next-session card and the improvement percentage were removed
// rather than restyled: no learner-scoped session read exists, and mastery
// delta needs history `/api/progress` does not return, so both could only have
// gone on rendering invented numbers to a child. They return with their reads.
//
// Mobbin: Skillshare resume-first home (mobbin.com/screens/eaa37d84-6ac3-44d2-a888-35e0198919db) ·
// Babbel learner shell (mobbin.com/screens/af715e9f-3b74-4de5-b014-55fa6748aa34) ·
// Duolingo lead card over a quiet library (mobbin.com/screens/e2e48fe1-3128-4f46-bfc0-fedb163d7987)
// SOT: docs/pack/04-screen-briefs.md §S7 · design/screens/learner/learner.home/contract.md ·
//      docs/design/reset/03-dispositions.md BUILD 1
// SOT-KEYWORDS: student home learner next skill due work band child teen states hero seeded

import { useMemo } from 'react';
import { ArrowRight, FileUp } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import {
  Banner,
  Button,
  EmptyState,
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
import { useNextSkill } from './use-next-skill.ts';

/** The purpose line under the greeting, in the band's register (doc 31 voice gate). */
const PURPOSE = {
  young: 'Here is what to do next.',
  child: 'Here is what to do next.',
  teen: 'What is next, and what is coming up.',
  adult: 'What is next, and what is coming up.',
} as const satisfies Record<AgeBand, string>;

/**
 * The hero's eyebrow, per band and per `source`.
 *
 * A derived skill came off the child's own facts, so the screen may name it as
 * theirs. A seeded one may not: it is an offer, and the copy has to read as one
 * or the hero is claiming the child was working on something they were not.
 */
const HERO_LABEL = {
  derived: { young: 'Next', child: 'Next', teen: 'Up next', adult: 'Up next' },
  seeded: { young: 'Try this', child: 'Try this', teen: 'Start here', adult: 'Start here' },
} as const satisfies Record<'derived' | 'seeded', Record<AgeBand, string>>;

const HERO_SUBTITLE = {
  derived: {
    young: 'You have been working on this.',
    child: 'You have been working on this.',
    teen: 'Picked from what you have been working on.',
    adult: 'Picked from what you have been working on.',
  },
  seeded: {
    young: 'A good place to start.',
    child: 'A good place to start.',
    teen: 'A starting point until you have some work behind you.',
    adult: 'A starting point until you have some work behind you.',
  },
} as const satisfies Record<'derived' | 'seeded', Record<AgeBand, string>>;

export function StudentHomeContent() {
  const { user, activeContext } = useAppSession();
  const router = useRouter();
  const ageBand: AgeBand = activeContext.gradeBand ?? 'teen';
  const scale = bandScaleFor(ageBand);
  const online = useIsOnline();

  const {
    skill,
    derived,
    loading: skillLoading,
    error: skillError,
    retry: retrySkill,
  } = useNextSkill();

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

  const failure = readFailureCopy(error, 'what is due', 'Nothing has changed about your work.');
  const skillFailure = readFailureCopy(
    skillError,
    'what is next',
    'Nothing has changed about your work.',
  );
  const tone = derived ? 'derived' : 'seeded';

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
            description="What is next is still here. New work arrives when you are back online."
          />
        </FadeIn>
      ) : null}

      {/* The one primary action. First tap lands in the work, which is what
          `max_interactions_to_primary: 1` means here. */}
      <FadeIn delay={80}>
        {skillLoading ? (
          <LoadingSkeleton count={1} className={scale.target} />
        ) : skillError !== null && skill === undefined ? (
          /* A hero that cannot say what is next says so. Silently rendering a
             generic "open the tutor" slab would be the failure wearing the
             success state, and the child would not know their work was
             unreachable rather than absent. */
          <ReadFailure
            className="p-inset"
            title={skillFailure.title}
            description={skillFailure.description}
            onRetry={retrySkill}
            action={
              skillFailure.signedOut ? (
                <Button variant="outline" title="Sign in" onPress={() => router.push('/')} />
              ) : undefined
            }
          />
        ) : skill !== undefined ? (
          <PressScale
            className={`w-full gap-stack rounded-card bg-primary shadow-card ${scale.target} ${scale.inset}`}
            outerClassName="w-full"
            onPress={() => router.push('/tutor')}
            aria-label={`${HERO_LABEL[tone][ageBand]}: ${skill.skillTitle}`}
          >
            <View className="flex-row items-start justify-between gap-stack">
              <View className="flex-1 gap-1">
                <TWText className="text-caption font-semibold uppercase tracking-wider text-on-primary/70">
                  {HERO_LABEL[tone][ageBand]}
                </TWText>
                <TWText className="font-display text-display-sm font-bold text-on-primary">
                  {skill.skillTitle}
                </TWText>
                <TWText className="text-body text-on-primary/90">
                  {HERO_SUBTITLE[tone][ageBand]}
                </TWText>
              </View>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-ink-50/10">
                <FileUp size={24} className="text-on-primary" />
              </View>
            </View>
            <View className="flex-row items-center gap-1.5">
              <TWText className="text-label font-semibold text-on-primary">Start</TWText>
              <ArrowRight size={14} className="text-on-primary" />
            </View>
          </PressScale>
        ) : null}
      </FadeIn>

      {/* Due work — 6–12 only, per the band variants. 3–5's home ends at the
          hero, which is the "simpler home" the contract asks for rather than a
          section that would have nothing lawful to put in it. */}
      {showsDueWork ? (
        <FadeIn delay={160}>
          <Section className="gap-stack">
            <View className="flex-row items-center justify-between">
              <Text variant="label" tone="muted">
                Due soon
              </Text>
              <PressScale
                className="min-h-target-adult justify-center rounded-md px-2"
                outerClassName="self-start"
                aria-label="See the whole plan"
                onPress={() => router.push('/plan')}
              >
                <Text variant="caption" className="font-bold text-text underline">
                  See all
                </Text>
              </PressScale>
            </View>

            {loading ? (
              <LoadingSkeleton count={2} className="h-12" />
            ) : error !== null && assignments.length === 0 ? (
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
            ) : dueWork.length === 0 ? (
              /* An answered zero, and only ever reached when the read landed —
                 the failure branch above owns the other sentence. The exit is
                 live: the plan holds the rest of the week. */
              <EmptyState
                icon={<FileUp size={24} className="text-text-muted" />}
                title="Nothing due right now"
                description="Your whole week is on the plan."
                action={
                  <Button
                    variant="outline"
                    title="See the plan"
                    onPress={() => router.push('/plan')}
                  />
                }
              />
            ) : (
              <View className="gap-element">
                {/* Past-due renders the same calm row; the label never says
                    "late". */}
                {dueWork.map((assignment) => (
                  <PressScale
                    key={assignment.id}
                    className={`flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised shadow-card ${scale.target} ${scale.inset}`}
                    outerClassName="w-full"
                    aria-label={`${assignment.title}, ${dueLabelFor(assignment.dueAt)}`}
                    onPress={() => router.push('/tutor')}
                  >
                    <View className="h-6 w-6 items-center justify-center rounded-full border-2 border-text-muted" />
                    <View className="flex-1 gap-0.5">
                      <TWText className={`text-text ${scale.rowTitle}`}>{assignment.title}</TWText>
                      <TWText className="text-body text-text-muted">
                        {dueLabelFor(assignment.dueAt)}
                      </TWText>
                    </View>
                  </PressScale>
                ))}
              </View>
            )}
          </Section>
        </FadeIn>
      ) : null}
    </View>
  );
}
