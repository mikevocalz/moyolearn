'use client';
// Tutor Today — the pilot's run list for human tutors.
// SOT: docs/pack/04-screen-briefs.md §S4 · design/screens/tutor/tutor.today/contract.md
// SOT-KEYWORDS: tutor today next session prep start run list empty exits

import { Navigation, Video } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, Heading, PressScale, Text, FadeIn } from '@acme/ui';
import { useRouter } from 'solito/navigation';
import { useAppSession } from '../../providers/session';
import { reviewDraftsPath } from './tutor-paths';
import { TUTOR_SESSIONS, type TutorSession } from './tutor-today.data';

/*
  Decision: the run list does not navigate. It used to push '/tutor', which is
  the LEARNER's AI session (web `(session)/tutor` mounts TutorScreen) and a
  dead route on mobile — tutor.session is PARTIAL: no tutor-side room exists
  as a distinct surface (contract Status), so there is nowhere honest for a
  session row to go. Rows are plain Views until the room lands; the press
  affordance returns with it.
*/
function RunListRow({ session }: { session: TutorSession }) {
  return (
    <View className="w-full gap-1 rounded-card border-2 border-border bg-surface-raised p-3 shadow-card">
      <View className="flex-row items-center justify-between">
        <TWText className="text-base font-semibold text-text">{session.studentName}</TWText>
        <View className="flex-row items-center gap-1">
          {session.mode === 'in-person' ? (
            <Navigation size={14} className="text-text-muted" />
          ) : (
            <Video size={14} className="text-text-muted" />
          )}
          <TWText className="text-sm text-text-muted">{session.mode}</TWText>
        </View>
      </View>
      <TWText className="text-sm text-text-muted">{session.timeLabel}</TWText>
      {session.travel ? <TWText className="text-sm text-text-muted">{session.travel}</TWText> : null}
      <TWText className="font-mono text-sm text-text">AI PREP: {session.prepLine}</TWText>
    </View>
  );
}

export function TutorTodayContent() {
  const { user } = useAppSession();
  const router = useRouter();
  const name = user?.name?.split(' ')[0] ?? 'there';
  const next = TUTOR_SESSIONS.find((s) => s.isNext);
  const rest = TUTOR_SESSIONS.filter((s) => !s.isNext);
  const hasDay = TUTOR_SESSIONS.length > 0;

  return (
    <View className="gap-7">
      <FadeIn>
        <Section className="flex-row flex-wrap items-baseline gap-x-2">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">Today,</Text>
          <Heading level={1} size="title">
            {name}
          </Heading>
        </Section>
        <TWText className="text-label text-grade">Example schedule</TWText>
      </FadeIn>

      {next ? (
        <FadeIn delay={80}>
          <Card className="border-2 border-highlighter bg-highlighter/10 shadow-card">
            <View className="gap-element">
              <View className="flex-row items-center justify-between">
                <TWText className="text-xs font-semibold uppercase tracking-wider text-text-muted">Next</TWText>
                <View className="flex-row items-center gap-1">
                  {next.mode === 'in-person' ? (
                    <Navigation size={14} className="text-text-muted" />
                  ) : (
                    <Video size={14} className="text-text-muted" />
                  )}
                  <TWText className="text-sm text-text-muted">{next.mode}</TWText>
                </View>
              </View>
              <TWText className="font-display text-2xl font-bold text-text">{next.studentName}</TWText>
              <TWText className="text-base text-text-muted">{next.timeLabel}</TWText>
              {next.travel ? <TWText className="text-sm text-text-muted">{next.travel}</TWText> : null}
              <TWText className="font-mono text-sm text-text">AI PREP: {next.prepLine}</TWText>
              <View className="flex-row gap-element pt-1">
                {/*
                  Decision: disabled with its reason, not routed. Start used to
                  push '/tutor' — the learner-facing AI session — which would
                  seat the tutor in the child's chair. tutor.session is PARTIAL
                  (contract Status: "no tutor-side room exists as a distinct
                  surface"), so the honest treatment is a visibly inert control
                  and one plain sentence, per the contract's own offline law
                  ("Start session disabled with reason").
                */}
                <Button title="Start session" variant="primary" className="flex-1" disabled />
                <PressScale
                  className="flex-1 items-center rounded-md border-2 border-border bg-surface px-4 py-2"
                  onPress={() => router.push('/session-prep')}
                >
                  <TWText className="font-semibold text-text">Prep</TWText>
                </PressScale>
              </View>
              <TWText className="text-sm text-text-muted">
                The in-app session room isn&rsquo;t built yet — run the session as usual, then
                write it up in Notes.
              </TWText>
            </View>
          </Card>
        </FadeIn>
      ) : null}

      <FadeIn delay={160}>
        <Section className="gap-stack">
          <Text variant="label" tone="muted">Run list</Text>
          {hasDay ? (
            <View className="gap-element">
              {rest.map((session) => (
                <RunListRow key={session.id} session={session} />
              ))}
            </View>
          ) : (
            /* The contract's empty_day path, verbatim: two live exits, never a
               bare line — Prep (→ session prep) and the review_drafts
               secondary action (→ the notes queue, forked per platform). */
            <View className="gap-stack">
              <TWText className="text-body text-text-muted">
                No sessions today. Your availability is open — families can book you.
              </TWText>
              <View className="flex-row gap-element">
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
            </View>
          )}
        </Section>
      </FadeIn>
    </View>
  );
}
