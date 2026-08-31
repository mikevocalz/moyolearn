'use client';
// Conference Hub — the schedule-integrated list view.
//
// Demo data is used because the backing collection is not wired yet; the same
// swap pattern established by ScheduleScreen applies here.
// SOT: Conference Room brief · docs/pack/04-screen-briefs.md (S1)
// SOT-KEYWORDS: conference hub screen schedule list demo integration

import { ScrollView, View, Text as TWText, Pressable } from '@acme/ui/tw';
import { Container, Heading, SafeArea } from '@acme/ui';
import { Video } from '@acme/ui/icons';
import { DEMO_DAY, formatTimeRange } from '../schedule/index.ts';
import type { ScheduleEvent } from '../schedule/model.ts';

function ConferenceItem({ event }: { event: ScheduleEvent }) {
  return (
    <Pressable className="w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-4 shadow-card">
      <Video className="h-5 w-5 text-text-muted" />
      <View className="flex-1">
        <TWText className="font-sans text-body font-semibold text-text" numberOfLines={1}>
          {event.title}
        </TWText>
        <TWText className="font-sans text-caption text-text-muted">
          {formatTimeRange(event, DEMO_DAY.timeZone)}
        </TWText>
      </View>
    </Pressable>
  );
}

export function ConferenceHubScreen() {
  const conferences = DEMO_DAY.events.filter((e) => e.kind === 'conference');
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <View className="gap-stack">
            <Heading level={1} size="title">
              Conferences
            </Heading>
            {conferences.length === 0 ? (
              <TWText className="font-sans text-body text-text-muted">
                No conferences on today&apos;s schedule.
              </TWText>
            ) : (
              <View className="gap-stack">
                {conferences.map((event) => (
                  <ConferenceItem key={event.id} event={event} />
                ))}
              </View>
            )}
          </View>
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
