'use client';
// GuardianHomeworkScreen — the Parent Daily Work route (/homework): the child
// switcher, the upload entry, and the full dated timeline for the active ward.
// The home feed mounts the same three pieces with the list capped; this route
// is where "All homework" lands.
//
// The wards read is synced into `family.store` here as well as on home, so a
// deep link straight to /homework has a switcher to show rather than an empty
// store, and the same selection the parent made on home, because it is the
// same store.
// Mobbin: https://mobbin.com/screens/0f44880e-aa99-4055-89e2-056c52867c8f (Careem — a row of scope tabs at the top, the dated activity list beneath it) ·
//   https://mobbin.com/screens/5fdd2ed7-756a-484b-87f1-4e55c496208c (Fi — a segmented scope control above a date-headed timeline) ·
//   https://mobbin.com/screens/e779c6a0-bcdf-47e5-ad1b-77d69d21efa0 (Headspace — history page: back chevron, title, then the date-grouped list). Structure only.
// SOT: docs/work/pr-100/contract.md §Routes · docs/design/homework-end-to-end-2026.md §Screen contract (Parent Daily Work) · docs/design/mobbin/homework-timeline.md
// SOT-KEYWORDS: guardian homework screen route switcher timeline upload entry wards sync

import { useRouter } from 'solito/navigation';
import { Container, Heading } from '@acme/ui';
import { ScrollView, View } from '@acme/ui/tw';
import { useActiveChild } from '../family/family.store.ts';
import { GUARDIAN_UPLOAD_PATH } from './guardian-assign-sheet.tsx';
import { GuardianFamilyHeader } from './guardian-family-header.tsx';
import { GuardianHomeworkTimeline } from './guardian-homework-timeline.tsx';

export function GuardianHomeworkScreen() {
  const router = useRouter();
  const child = useActiveChild();

  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="gap-group py-4 pb-48">
          <Heading level={1} size="title">
            Homework
          </Heading>
          <GuardianFamilyHeader child={child} />
          <GuardianHomeworkTimeline
            learnerAuthId={child?.id}
            childName={child?.name}
            onUpload={() => router.push(GUARDIAN_UPLOAD_PATH)}
          />
        </Container>
      </ScrollView>
    </View>
  );
}
