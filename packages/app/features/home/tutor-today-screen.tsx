'use client';
// Tutor Today — the sessions timeline as the tutor shell's landing tab.
// The ≤1-tap primary action is start/prep the next session (doc 36 §4.2).
// Wraps the EXISTING TutorTodayContent per the §0 move rule.
// Mobbin: Noom today-plan timeline (mobbin.com/screens/b3115f13-4888-4643-bdcf-bd43a916432a) ·
// pliability day-selected session list (mobbin.com/screens/d85a40ef-63f9-439e-adac-9c673e57963f) ·
// Quizlet 4-tab utility shell (mobbin.com/screens/d8bb66b8-7bae-4cc3-8241-7aab8e04be5a)
// SOT: docs/pack/36-role-navigation-flows.md §3.3
// SOT-KEYWORDS: tutor today screen sessions timeline shell landing

import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { TutorTodayContent } from './tutor-today-content';

export function TutorTodayScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <TutorTodayContent />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
