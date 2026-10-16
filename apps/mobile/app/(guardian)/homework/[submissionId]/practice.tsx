'use client';
// Guardian-only practice review; the service rechecks the ward and approval.
// SOT: packages/app/features/homework/practice-preview.tsx; apps/mobile/app/(guardian)/_layout.tsx.
// SOT-KEYWORDS: guardian homework practice route native review print approval
import { useLocalSearchParams } from 'expo-router';
import { PracticePreview } from '@acme/app';

export default function HomeworkPracticeRoute() {
  const { submissionId } = useLocalSearchParams<{ submissionId: string }>();
  // Mutation previews belong to this worksheet, never a previously visited child.
  return <PracticePreview key={submissionId} submissionId={submissionId ?? ''} />;
}
