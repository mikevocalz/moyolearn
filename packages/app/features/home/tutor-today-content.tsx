'use client';
// Tutor Today — the pilot's run list for human tutors.
//
// THE RUN LIST IS STRUCK, AND THE SCREEN DOES NOT CLAIM AN EMPTY DAY INSTEAD.
//
// `TUTOR_SESSIONS` invented three named learners, a travel instruction ("35 min
// travel to Brooklyn") a tutor could act on, and an "AI PREP" line making an
// AI-derived claim about a named child with no source behind it — which this
// surface's own Mobbin pass refuses in as many words ("Any AI-derived
// suggestion names its source, or it does not ship"). An "Example schedule"
// label does not make a fabricated instruction safe to read minutes before
// teaching.
//
// The contract's `empty_day` path is deliberately NOT reused for this. "No
// sessions today. Your availability is open" asserts a zero this screen cannot
// verify: the org's sessions are real rows and a tutor may well have some, so
// claiming none is the calm-zero-over-an-absent-read lie rather than an honest
// empty. The copy names the reason instead, and both of the contract's live
// exits stay.
//
// THE UNBLOCK IS ONE PREDICATE. `GET /api/ops/sessions` is org-scoped by
// design — `listSessions` gates on `ctx.orgId` and `sessions.repository.ts:38`
// filters `orgId` and the day window only, so it returns every tutor's day and
// would seat this tutor in front of colleagues' learners. The field that would
// scope it already exists on the row (`row.tutorAuthId`, read at
// `sessions.repository.ts:51,69`). A tutor-scoped read — that predicate against
// ctx, behind its own route — restores the hero and the run list against
// `Session`, minus `travel` and `prepLine`, which have no carrier at all.
//
// SOT: docs/pack/04-screen-briefs.md §S4 · design/screens/tutor/tutor.today/contract.md ·
//      docs/design/reset/03-dispositions.md §4 · docs/design/mobbin/tutor-today.md
// SOT-KEYWORDS: tutor today next session prep run list empty exits strike scoped read

import { CalendarDays } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, EmptyState, Heading, Text, FadeIn } from '@acme/ui';
import { useRouter } from 'solito/navigation';
import { useAppSession } from '../../providers/session';
import { reviewDraftsPath } from './tutor-paths';

export function TutorTodayContent() {
  const { user } = useAppSession();
  const router = useRouter();
  const name = user?.name?.split(' ')[0] ?? 'there';

  return (
    <View className="gap-7">
      <FadeIn>
        <Section className="flex-row flex-wrap items-baseline gap-x-2">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">Today,</Text>
          <Heading level={1} size="title">
            {name}
          </Heading>
        </Section>
      </FadeIn>

      <FadeIn delay={80}>
        <Section className="gap-stack">
          <Text variant="label" tone="muted">
            Run list
          </Text>
          <EmptyState
            icon={<CalendarDays size={28} className="text-text-muted" />}
            title="Your day isn't connected yet"
            description="Sessions live on the org's calendar, and this screen can't yet ask for only yours. Rather than guess at your day, it shows nothing until it can."
            action={
              <View className="flex-row flex-wrap justify-center gap-element">
                <Button
                  title="Prep a learner"
                  variant="outline"
                  onPress={() => {
                    router.push('/session-prep');
                  }}
                />
                <Button
                  title="Review drafts"
                  variant="outline"
                  onPress={() => {
                    router.push(reviewDraftsPath());
                  }}
                />
              </View>
            }
          />
          {/* The session room is a separate gap from the read, and it predates
              it: tutor.session is PARTIAL (contract Status — no tutor-side room
              exists as a distinct surface), which is why no row here ever
              offered a Start. Said once, plainly, rather than on a disabled
              control that has nothing to disable. */}
          <TWText className="text-sm text-text-muted">
            The in-app session room isn&rsquo;t built yet either — run sessions as usual, then write
            them up in Notes.
          </TWText>
        </Section>
      </FadeIn>
    </View>
  );
}
