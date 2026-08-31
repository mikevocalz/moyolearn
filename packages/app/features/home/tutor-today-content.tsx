'use client';
// Tutor Today — the pilot's run list for human tutors.
// SOT: docs/pack/04-screen-briefs.md §S4
// SOT-KEYWORDS: tutor today next session prep start

import { Navigation, Video } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Card, Heading, PressScale, Text, FadeIn } from '@acme/ui';
import { useRouter } from 'solito/navigation';
import { useAppSession } from '../../providers/session';
import { TUTOR_SESSIONS } from './tutor-today.data';

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
                <PressScale
                  className="flex-1 items-center rounded-md bg-primary px-4 py-2"
                  onPress={() => router.push('/tutor')}
                >
                  <TWText className="font-semibold text-on-primary">Start session</TWText>
                </PressScale>
                <PressScale
                  className="flex-1 items-center rounded-md border-2 border-border bg-surface px-4 py-2"
                  onPress={() => router.push('/session-prep')}
                >
                  <TWText className="font-semibold text-text">Prep</TWText>
                </PressScale>
              </View>
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
                <PressScale
                  key={session.id}
                  className="w-full gap-1 rounded-card border-2 border-border bg-surface-raised p-3 shadow-card"
                  outerClassName="w-full"
                  onPress={() => router.push('/tutor')}
                >
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
                </PressScale>
              ))}
            </View>
          ) : (
            <TWText className="text-body text-text-muted">
              No sessions today. Your availability is open — families can book you.
            </TWText>
          )}
        </Section>
      </FadeIn>
    </View>
  );
}
