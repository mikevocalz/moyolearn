'use client';
// The learner capture route. CaptureScreen falls back to 'teen' when no band is
// passed, so a bare re-export ran the whole band-aware capture flow at 'teen'
// for a six-year-old — and silently spread Next's params/searchParams into
// CaptureScreenProps (A-repo-audit §Age-band, web half). The band comes from
// the session context — the same source the mobile tab wrapper reads.
import { CaptureScreen, useAppSession } from '@acme/app';

export default function CaptureRoute() {
  const { activeContext } = useAppSession();
  return <CaptureScreen ageBand={activeContext.gradeBand} />;
}
