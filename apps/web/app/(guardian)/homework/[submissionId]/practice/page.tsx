// Guardian-shell route to the shared practice review and print surface.
// SOT: packages/app/features/homework/practice-preview.tsx; (guardian)/layout.tsx.
// SOT-KEYWORDS: guardian homework practice route web review print approval
import type { Metadata } from 'next';
import { PracticePreview } from '@acme/app';

export const metadata: Metadata = {
  title: 'Practice sheet — Moyo',
  description: 'Review math practice before approving a sheet or answer key.',
};

export default async function HomeworkPracticePage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  return <PracticePreview key={submissionId} submissionId={submissionId} />;
}
