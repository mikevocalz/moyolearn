'use client';
// Teacher Home — the classroom-teacher shell's landing tab.
// Honest empty state: this slice does not wire classes, assignments, or students
// yet, but it makes the teacher shell reachable and fail-closed. Conferences is
// a stack route per ADR-102 (demoted from the tab bar), so Home carries its
// entry point — the contract's `push_conference` exit.
// SOT: docs/pack/36-role-navigation-flows.md §3.3 · docs/decisions/adr-102-teacher-shell-ia.md
// SOT-KEYWORDS: teacher home screen classroom shell landing empty conference

import { useRouter } from 'solito/navigation';
import { ScrollView, View, Text as TWText } from '@acme/ui/tw';
import { Container, Heading, PressScale, SafeArea } from '@acme/ui';
import { ArrowRight, Video } from '@acme/ui/icons';

export function TeacherHomeScreen() {
  const router = useRouter();
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <View className="gap-stack">
            <Heading level={1} size="title">
              Teacher home
            </Heading>
            <TWText className="text-body text-text">
              Your classroom overview will list classes, assignments, and students.
            </TWText>
            <TWText className="text-body text-text-muted">
              For now, this is the teacher shell&apos;s landing screen. The planned tabs are
              Home, Classes, Assign, and You.
            </TWText>
            <PressScale
              onPress={() => router.push('/conference')}
              className="w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-4"
              outerClassName="w-full"
              aria-label="Conferences, upcoming and scheduled"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-surface-sunken">
                <Video size={20} className="text-text" />
              </View>
              <View className="flex-1 gap-0.5">
                <TWText className="text-base font-semibold text-text">Conferences</TWText>
                <TWText className="text-sm text-text-muted">Upcoming and scheduled</TWText>
              </View>
              <ArrowRight size={18} className="text-text-muted" />
            </PressScale>
          </View>
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
