'use client';
// Conference Hub — the teacher's guardian-conference schedule, answering the
// contract's two five-second questions: which conferences are booked, and which
// one is next.
//
// The backing collection is NOT wired (contract status: PARTIAL), so this list
// is DEMO_DAY. That fact is a Banner, not a footnote: a teacher who reads these
// as real bookings misses a real conference, so the fixture label sits above the
// list at the same weight as the list itself rather than as the small caption
// this screen used to carry.
//
// Every control here is either live or absent — never live-and-going-nowhere.
// There is no Join (no room route exists), no Schedule (no booking surface
// exists) and no per-row press target; each omission is stated on screen in
// plain words so the absence reads as "not built yet" rather than "broken".
// The exits that ARE live are the contract's `back_home` and `student_context`.
//
// Mobbin: https://mobbin.com/screens/177f7dff-bab7-42ea-9d53-92fc89f9affa (Lyssna —
//   a pinned "next session" summary above the dated upcoming list, which is the
//   contract's "which is next?" answer given its own block) ·
//   https://mobbin.com/screens/e054455c-eaf5-4d55-8e02-15e2c295804b (Calendly —
//   scheduled events under a date group header, one row per event carrying its
//   time range) ·
//   https://mobbin.com/screens/ce574b1c-702b-44b1-bc3e-a8f14abe169f (Cal.com —
//   TODAY/NEXT section headers over booking rows) ·
//   https://mobbin.com/screens/10e8676d-bffb-4b93-8051-eb037cb4384f (Riverside —
//   scheduled-session row: leading time block, title and range stacked beside
//   it, count stated in the header). Structure only.
// SOT: design/screens/teacher/teacher.conference/contract.md · packages/app/features/conference/conference.types.ts
// SOT-KEYWORDS: conference hub screen schedule list demo example fixture next policy cap recording exits

import { useRouter } from 'solito/navigation';
import { ScrollView, View, Text as TWText } from '@acme/ui/tw';
import { Banner, Button, Card, Container, Heading, Text } from '@acme/ui';
import { Video } from '@acme/ui/icons';
import { classesRootPath } from '../classes/classes-paths';
import { DEMO_DAY, formatTimeRange } from '../schedule/index.ts';
import type { ScheduleEvent } from '../schedule/model.ts';

/*
  The two policy invariants the contract requires the surface to state as FACTS
  rather than settings: both are literal types on ConferencePolicy
  (`maxDurationMinutes: 30`, `recordingAllowed: false`), so no room in this
  build can differ from them and no control may imply otherwise.
*/
const POLICY_FACTS = [
  'Conferences end automatically after 30 minutes.',
  'Nothing is recorded — this build has no recording at all.',
] as const;

/*
  Decision: a plain View, not a Pressable. There is no conference detail or
  join surface for a row to open — conference.policy governs admission but no
  room route exists — and a row that presses into nothing is a dead button.
  The press affordance returns with the room, not before.
*/
function ConferenceItem({ event, leading }: { event: ScheduleEvent; leading: string }) {
  return (
    <View className="w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-4 shadow-card">
      <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-surface-sunken">
        <Video className="h-5 w-5 text-text-muted" />
      </View>
      <View className="flex-1 gap-0.5">
        <TWText className="font-sans text-body font-semibold text-text" numberOfLines={1}>
          {event.title}
        </TWText>
        <TWText className="font-sans text-caption text-text-muted">{leading}</TWText>
      </View>
    </View>
  );
}

export function ConferenceHubScreen() {
  const router = useRouter();
  // Sorted so "next" is a position, not a guess — the hub re-sorts to the next
  // upcoming conference, which is the contract's completion behaviour.
  const conferences = DEMO_DAY.events
    .filter((e) => e.kind === 'conference')
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const [next, ...later] = conferences;

  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <View className="gap-section">
            <View className="gap-element">
              <Heading level={1} size="title">
                Conferences
              </Heading>
              <Text variant="body" tone="muted">
                Guardian conferences you have booked, next one first.
              </Text>
            </View>

            {conferences.length === 0 ? (
              /*
                Decision: no "Schedule one" affordance — no conference-creation
                surface exists to route to, and a button that opens nothing is
                a dead button. The empty state states the fact and offers the
                exit that IS live, so it is still not a dead end.
              */
              <Card className="gap-element">
                <Text>No conferences are booked.</Text>
                <Text variant="caption" tone="muted">
                  Booking a conference from here isn&rsquo;t built yet — conferences booked with
                  you appear on this list. To look a student up in the meantime, open their class.
                </Text>
                <Button
                  title="Go to Classes"
                  variant="outline"
                  className="self-start"
                  onPress={() => {
                    router.push(classesRootPath());
                  }}
                />
              </Card>
            ) : (
              <>
                {/* The fixture label, at the weight the risk deserves: these
                    rows are DEMO_DAY, not the teacher's real bookings. */}
                <Banner
                  tone="warning"
                  title="Example data"
                  description="These are sample conferences shown while the schedule is being connected. They are not your real bookings, and nothing here is scheduled with a guardian."
                />

                <View className="gap-group">
                  <Text variant="label" tone="muted">
                    Next
                  </Text>
                  {next ? (
                    <ConferenceItem
                      event={next}
                      leading={formatTimeRange(next, DEMO_DAY.timeZone)}
                    />
                  ) : null}
                  <Text variant="caption" tone="muted">
                    Joining a conference isn&rsquo;t built yet — run it on your usual call link.
                  </Text>
                </View>

                {later.length > 0 ? (
                  <View className="gap-group">
                    <Text variant="label" tone="muted">
                      Later
                    </Text>
                    {later.map((event) => (
                      <ConferenceItem
                        key={event.id}
                        event={event}
                        leading={formatTimeRange(event, DEMO_DAY.timeZone)}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            )}

            <Card className="gap-element">
              <Text variant="label" tone="muted">
                How conferences work here
              </Text>
              {POLICY_FACTS.map((fact) => (
                <Text key={fact} variant="caption" tone="muted">
                  {fact}
                </Text>
              ))}
            </Card>
          </View>
        </Container>
      </ScrollView>
    </View>
  );
}
