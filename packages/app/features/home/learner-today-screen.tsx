'use client';
// Learner Today — the landing screen of the learner shell, band-adaptive.
// K–2 gets the hub (tiles, voice prompt, hub-and-spoke); reading bands get the
// resume-first student home whose top card is "continue where you left off"
// (doc 36 §3.1). Band-adaptive, not role-conditional: both branches are the
// same child's shell, so this is the §2-legal kind of switch.
// Mobbin: Skillshare resume-first home (mobbin.com/screens/eaa37d84-6ac3-44d2-a888-35e0198919db) ·
// Babbel learner shell (mobbin.com/screens/af715e9f-3b74-4de5-b014-55fa6748aa34)
// SOT: docs/pack/36-role-navigation-flows.md §3.1
// SOT-KEYWORDS: learner today screen band adaptive hub resume-first shell landing

import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { useAppSession } from '../../providers/session';
import { LearnerHubContent } from './learner-hub-content';
import { StudentHomeContent } from './student-home-content';

export function LearnerTodayScreen() {
  const { activeContext } = useAppSession();
  const isYoung = activeContext.gradeBand === 'young';

  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          {isYoung ? <LearnerHubContent /> : <StudentHomeContent />}
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
