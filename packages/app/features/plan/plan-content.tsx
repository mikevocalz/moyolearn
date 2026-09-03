'use client';
// Student plan — "What do I have to do?" as one mixed timeline.
//
// Rendered as a LIST, not a grid: screen readers need reading order to match
// chronological order, and a grid reads column-major (S8 A11y).
//
// The screen now answers all three of the contract's 5-second questions rather
// than one. "What's due, and when?" was the only one the week strip carried;
// "How big is this week?" is the sentence under the title, and "What should I
// start first?" is a single filled card above the agenda. Everything else stays
// on paper, so there is exactly one primary action
// (`max_interactions_to_primary: 1`).
//
// The read is treated as a read. Before this, a failed `/api/learner/assignments`
// merged into the fixture week as nothing at all, so a child whose homework the
// server could not return was told "Nothing due — nice." — the calm empty state
// standing in for a failure, which is the one substitution the states rules
// forbid. The failed read now says so in the place it failed — `ReadFailure`
// above the week, with the week itself still readable beneath it — and a
// failure that still has a cached list gets the offline banner instead, which
// is the contract's own offline path.
//
// Band: the contract scopes this screen to 6–8/9–12, but the route is reachable
// by URL from any band, and a dead end is worse than an out-of-band screen — so
// it scales to whoever opened it rather than refusing them.
//
// Mobbin: mobbin.com/screens/e125665b-7826-429c-bff4-5f5c805e3730 (Todoist —
// week strip over day-grouped rows, with the selected day's list beneath it) ·
// mobbin.com/screens/ba0d1fd1-f9dd-4d60-8ad2-5b475604091a (Tiimo — big day
// heading, labelled groups, calm rows with a single round completion control) ·
// mobbin.com/screens/fe05d03c-4510-4991-adb8-6b63a42c713d (Liven — the "0 of 4"
// summary line sitting beside the section label rather than as a badge) ·
// mobbin.com/screens/fba734f4-c060-4985-ae29-0e37cb086c17 (Numo — plain-speech
// day headings and time on the right of each row) ·
// mobbin.com/screens/ecb1790e-e9b8-494c-8022-224b41476d34 (ClickUp My Work —
// date strip where a day carries its own load, then the list below).
// Structure only. Type ramp, targets, dial and spacing are docs 02/08.
// SOT: docs/pack/04-screen-briefs.md §S8 · design/screens/learner/learner.plan/contract.md
// SOT-KEYWORDS: student plan week strip agenda timeline join practice due states error offline empty band

import { useMemo } from 'react';
import { Check, CalendarDays } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import {
  Avatar,
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
import { usePlanStore } from './plan.store';
import {
  useLearnerAssignments,
  useMarkAssignmentDone,
} from '../assignments/use-learner-assignments';
import { readFailureCopy } from '../../core/read-failure-copy.ts';
import { useIsOnline } from '../../core/use-is-online.ts';
import { useAppSession } from '../../providers/session';
import { bandScaleFor, type AgeBand } from '../capture/age-band';
import { mergeAssignmentsIntoWeek, PLAN_WEEK, type PlanTimelineItem } from './plan.data';

/**
 * Plain speech all the way down (the copy law): the week's size is a sentence a
 * child reads, not a number badge they are being measured by. Past ten it falls
 * back to the digit — at that point the count is the honest thing to say.
 */
const NUMBER_WORDS = [
  'Nothing',
  'One thing',
  'Two things',
  'Three things',
  'Four things',
  'Five things',
  'Six things',
  'Seven things',
  'Eight things',
  'Nine things',
  'Ten things',
] as const;

function weekSizeSentence(open: number): string {
  if (open === 0) return 'Nothing left this week.';
  const words = NUMBER_WORDS[open];
  return words === undefined ? `${String(open)} things left this week.` : `${words} left this week.`;
}

export function PlanContent() {
  const selectedDayId = usePlanStore((s) => s.selectedDayId);
  const selectDay = usePlanStore((s) => s.selectDay);
  const router = useRouter();
  const { activeContext } = useAppSession();
  const ageBand: AgeBand = activeContext.gradeBand ?? 'teen';
  const scale = bandScaleFor(ageBand);
  const online = useIsOnline();

  // Real published assignments, bucketed by dueAt into the week's mixed
  // timeline; sessions/practice are still the fixture scaffold (see plan.data).
  const { assignments, loading, error, retry } = useLearnerAssignments();
  const markDone = useMarkAssignmentDone();
  const week = useMemo(() => mergeAssignmentsIntoWeek(PLAN_WEEK, assignments), [assignments]);

  const activeId = selectedDayId ?? week[0]!.id;
  const day = week.find((d) => d.id === activeId) ?? week[0]!;

  const openThisWeek = week.reduce(
    (total, d) => total + d.items.filter((item) => !item.done).length,
    0,
  );
  // "What should I start first?" — the first unfinished thing on the day being
  // looked at, falling back to the week so the card never disappears on a
  // finished day while work remains elsewhere.
  const lead =
    day.items.find((item) => !item.done) ??
    week.flatMap((d) => d.items).find((item) => !item.done);

  const openItem = (item: PlanTimelineItem) =>
    router.push(item.kind === 'practice' ? '/practice' : '/tutor');

  // A cold failure: the read did not land and there is nothing cached behind
  // it, so every count on this screen would be a claim about data we do not
  // have. The size sentence is dropped rather than guessed.
  const readFailed = error !== null && assignments.length === 0;

  const failure = readFailureCopy(
    error,
    'your plan',
    'Nothing has changed about your work — we just could not read it.',
  );

  return (
    <View className={scale.gap}>
      <FadeIn>
        <Section className="gap-element">
          <Heading level={1} size={scale.title}>
            Your plan
          </Heading>
          <Text tone="muted" className={scale.lead}>
            {/* The purpose line, then the week's size — never framed as behind
                or late; past-due work simply still names its day (plan.data). */}
            Everything you have coming up.{readFailed ? '' : ` ${weekSizeSentence(openThisWeek)}`}
          </Text>
        </Section>
      </FadeIn>

      {/* Stale beats blank: a failed refetch with a cached week keeps the week
          on screen and labels it, which is the contract's offline path. The
          banner only renders WITH something to label. */}
      {(error !== null || !online) && !loading && assignments.length > 0 ? (
        <FadeIn>
          <Banner
            tone="offline"
            title="Out of sync"
            description="Showing the last plan we saved. It may be missing something new."
          />
        </FadeIn>
      ) : null}

      {loading ? (
        <Section className="gap-stack">
          <LoadingSkeleton variant="card" className="h-24" />
          <LoadingSkeleton variant="card" count={3} className="h-16" />
        </Section>
      ) : (
        <>

          {/* WeekStrip — each day is a target in the band's own size. */}
          <FadeIn delay={80}>
            <View className="flex-row gap-element">
              {week.map((d) => {
                const active = d.id === activeId;
                const openCount = d.items.filter((item) => !item.done).length;
                return (
                  <PressScale
                    key={d.id}
                    className={`flex-1 items-center justify-center gap-1 rounded-card border-2 px-2 ${scale.target} ${
                      active ? 'border-border bg-primary shadow-card' : 'border-border bg-surface-raised'
                    }`}
                    outerClassName="flex-1"
                    aria-label={`${d.label}, ${weekSizeSentence(openCount).toLowerCase()}`}
                    aria-selected={active}
                    onPress={() => selectDay(d.id)}
                  >
                    <TWText className={`text-caption ${active ? 'text-on-primary/80' : 'text-text-muted'}`}>
                      {d.weekday}
                    </TWText>
                    <TWText
                      className={`font-display text-title font-bold ${active ? 'text-on-primary' : 'text-text'}`}
                    >
                      {d.dayOfMonth}
                    </TWText>
                  </PressScale>
                );
              })}
            </View>
          </FadeIn>

          {lead ? (
            <FadeIn delay={120}>
              <Section className="gap-stack">
                <Text variant="label" tone="muted">
                  Start with this
                </Text>
                <PressScale
                  outerClassName="w-full"
                  className={`w-full gap-stack rounded-card border-2 border-border bg-primary shadow-card ${scale.target} ${scale.inset}`}
                  aria-label={`Start ${lead.title}, ${lead.dueLabel}`}
                  onPress={() => openItem(lead)}
                >
                  <TWText className={`font-display font-bold text-on-primary ${scale.rowTitle}`}>
                    {lead.title}
                  </TWText>
                  <TWText className="text-body text-on-primary/80">{lead.dueLabel}</TWText>
                  <TWText className="text-label font-semibold text-on-primary">
                    {lead.joinable ? 'Join session' : lead.kind === 'practice' ? 'Start practice' : 'Open it'}
                  </TWText>
                </PressScale>
              </Section>
            </FadeIn>
          ) : null}

          {/* Agenda */}
          <FadeIn delay={160}>
            <Section className="gap-stack">
              <Text variant="label" tone="muted">
                {day.label}
              </Text>
              {/* Error wins over empty, and only over the region that failed.
                  The week scaffold is local and still true, so the failure
                  lives inside the agenda — the one place assignments would
                  have appeared — rather than taking the screen with it. */}
              {readFailed ? (
                <ReadFailure
                  className="p-inset"
                  title={failure.title}
                  description={failure.description}
                  onRetry={retry}
                  action={
                    <Button
                      variant="outline"
                      title={failure.signedOut ? 'Sign in' : 'Snap homework instead'}
                      onPress={() => router.push(failure.signedOut ? '/' : '/capture')}
                    />
                  }
                />
              ) : null}
              {day.items.length > 0 ? (
                <View className="gap-element">
                  {day.items.map((item) => (
                    <PlanRow
                      key={item.id}
                      item={item}
                      ageBand={ageBand}
                      onOpen={() => openItem(item)}
                      onMarkDone={(assignmentId) => markDone.mutate(assignmentId)}
                      markPending={markDone.isPending}
                    />
                  ))}
                </View>
              ) : readFailed ? (
                /* A day that looks empty while the read is down is NOT empty,
                   and must never wear the calm sentence. The failure block
                   above has already said so, so nothing more is owed here. */
                null
              ) : (
                /* Contract copy, verbatim — an ANSWERED zero, so it is calm and
                   carries no manufactured urgency. Both ways forward are live:
                   snap something new, or pick the work back up with Natalie. */
                <EmptyState
                  icon={<CalendarDays size={28} className="text-text-muted" />}
                  title="Nothing due — nice."
                  description="When something is due it shows up here."
                  action={
                    <View className="flex-row flex-wrap items-center justify-center gap-stack">
                      <Button
                        variant="primary"
                        title="Snap homework"
                        onPress={() => router.push('/capture')}
                      />
                      <Button
                        variant="outline"
                        title="Pick up where you left off"
                        onPress={() => router.push('/tutor')}
                      />
                    </View>
                  }
                />
              )}
            </Section>
          </FadeIn>
        </>
      )}
    </View>
  );
}

function PlanRow({
  item,
  ageBand,
  onOpen,
  onMarkDone,
  markPending,
}: {
  item: PlanTimelineItem;
  ageBand: AgeBand;
  onOpen: () => void;
  onMarkDone: (assignmentId: string) => void;
  markPending: boolean;
}) {
  const scale = bandScaleFor(ageBand);
  /* The child always knows who is on the other side: a human tutor's
     avatar, or the presence mark for AI practice. */
  const face = (
    <>
      {item.tutorName ? (
        <Avatar name={item.tutorName} size="sm" />
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
          <TWText className="text-label font-bold text-on-primary">N</TWText>
        </View>
      )}
      <View className="flex-1 gap-0.5">
        {/* Done keeps the title's normal face — no strikethrough, no fading
            the child's own work out. The supporting line simply says so. */}
        <TWText className={`text-text ${scale.rowTitle}`}>{item.title}</TWText>
        <TWText className="text-body text-text-muted">{item.done ? 'Done' : item.dueLabel}</TWText>
      </View>
    </>
  );

  if (item.kind !== 'assignment' || item.assignmentId === undefined) {
    return (
      <PressScale
        className={`w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised shadow-card ${scale.target} ${scale.inset}`}
        outerClassName="w-full"
        aria-label={`${item.title}, ${item.dueLabel}`}
        onPress={onOpen}
      >
        {face}
        <TWText className="text-label font-semibold text-text">
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
    <View
      className={`w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised shadow-card ${scale.target} ${scale.inset}`}
    >
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
          className="min-h-target-adult justify-center rounded-md border-2 border-border px-3"
          outerClassName="self-center"
          aria-label={`Mark ${item.title} done`}
          disabled={markPending}
          onPress={() => onMarkDone(item.assignmentId!)}
        >
          <TWText className="text-label font-semibold text-text">Mark done</TWText>
        </PressScale>
      )}
    </View>
  );
}
