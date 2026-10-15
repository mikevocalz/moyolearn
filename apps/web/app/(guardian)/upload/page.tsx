// /upload — the EXISTING CaptureScreen inside the guardian role wall, so a
// parent can photograph or import a ward's pages. `(site)/capture` is the
// learner's door; this is the guardian's. Band is `adult` because the person
// at the keyboard is the parent; the ward comes from family.store
// (`useActiveLearnerId()` → `forLearnerAuthId`, B2), never from the URL.
// SOT: packages/app/features/capture/capture-screen.tsx · docs/work/pr-100/contract.md §Client · packages/app/features/homework/guardian-assign-sheet.tsx
// SOT-KEYWORDS: guardian upload page web route capture screen ward adult band
import type { Metadata } from 'next';
import { CaptureScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Upload work — Moyo',
  description: 'Photograph or import a worksheet for your child.',
};

export default function GuardianUploadPage() {
  return <CaptureScreen ageBand="adult" />;
}
