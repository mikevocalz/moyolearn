'use client';
// The learner capture route. CaptureScreen falls back to 'teen' when no band is
// passed, so a bare re-export ran the whole band-aware capture flow at 'teen'
// for a six-year-old (A-repo-audit §Age-band). The band comes from the session
// context — the same source (tabs)/_layout.tsx reads for the tab bar.
import { CaptureScreen, useAppSession } from '@acme/app';

export default function CaptureRoute() {
  const { activeContext } = useAppSession();
  return <CaptureScreen ageBand={activeContext.gradeBand} />;
}
