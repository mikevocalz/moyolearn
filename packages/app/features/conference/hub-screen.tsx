'use client';
// Conference Hub — the schedule-integrated list view.
//
// Demo data is used because the backing collection is not wired yet; the same
// swap pattern established by ScheduleScreen applies here, and the list says
// so out loud with the tutor-today "Example schedule" label — fixture rows
// never dress up as real bookings.
// SOT: Conference Room brief · docs/pack/04-screen-briefs.md (S1)
// SOT-KEYWORDS: conference hub screen schedule list demo integration example

import { ScrollView, View, Text as TWText } from '@acme/ui/tw';
import { Container, Heading, SafeArea } from '@acme/ui';
import { Video } from '@acme/ui/icons';
import { DEMO_DAY, formatTimeRange } from '../schedule/index.ts';
import type { ScheduleEvent } from '../schedule/model.ts';

/*
  Decision: a plain View, not a Pressable. There is no conference detail or
  join surface for a row to open — conference.policy governs admission but no
  room route exists — and a row that presses into nothing is a dead button.
  The press affordance returns with the room, not before.
*/
function ConferenceItem({ event }: { event: ScheduleEvent }) {
  return (
    <View className="w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-4 shadow-card">
      <Video className="h-5 w-5 text-text-muted" />
      <View className="flex-1">
        <TWText className="font-sans text-body font-semibold text-text" numberOfLines={1}>
          {event.title}
        </TWText>
        <TWText className="font-sans text-caption text-text-muted">
          {formatTimeRange(event, DEMO_DAY.timeZone)}
        </TWText>
      </View>
    </View>
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
              /*
                Decision: no "Schedule one" affordance — no conference-creation
                surface exists to route to, and a button that opens nothing is
                a dead button. The empty state states the fact and stops.
              */
              <View className="gap-1">
                <TWText className="font-sans text-body text-text-muted">
                  No conferences on today&apos;s schedule.
                </TWText>
                <TWText className="font-sans text-caption text-text-muted">
                  Scheduling conferences from here isn&apos;t built yet — booked ones appear on
                  this list.
                </TWText>
              </View>
            ) : (
              <View className="gap-stack">
                {/* The tutor-today fixture label, verbatim — this list is
                    DEMO_DAY, not the teacher's real bookings. */}
                <TWText className="text-label text-grade">Example schedule</TWText>
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
