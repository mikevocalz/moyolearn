// /upload in the guardian shell — the EXISTING CaptureScreen, mounted where a
// guardian can reach it. The learner shell's /capture sits behind
// `Stack.Protected guard={isLearner}`, so a guardian pushing it would fall to
// +not-found; this route is the same screen inside the guardian guard.
//
// Band is `adult`: the person holding the phone is the parent, so the capture
// copy reads "Share your work" at the Cool density, not a K–2 prompt. Which
// CHILD the pages are for is not a route param: CaptureScreen reads
// `useActiveLearnerId()` from family.store for `forLearnerAuthId` (B2), the
// same selection the switcher on Home wrote.
// SOT: packages/app/features/capture/capture-screen.tsx · docs/work/pr-100/contract.md §Client · packages/app/features/homework/guardian-assign-sheet.tsx
// SOT-KEYWORDS: guardian upload route mobile capture screen ward adult band
import { CaptureScreen } from '@acme/app';

export default function GuardianUploadRoute() {
  return <CaptureScreen ageBand="adult" />;
}
