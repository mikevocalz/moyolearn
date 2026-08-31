'use client';
// Teacher Home — the classroom-teacher shell's landing tab.
// Honest empty state: this slice does not wire classes, assignments, or students
// yet, but it makes the teacher shell reachable and fail-closed.
// SOT: docs/pack/36-role-navigation-flows.md §3.3
// SOT-KEYWORDS: teacher home screen classroom shell landing empty

import { ScrollView, View, Text as TWText } from '@acme/ui/tw';
import { Container, Heading, SafeArea } from '@acme/ui';

export function TeacherHomeScreen() {
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
              For now, this is the teacher shell's landing screen. The planned tabs are
              Home, Classes, Assign, Calendar, and Students.
            </TWText>
          </View>
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
